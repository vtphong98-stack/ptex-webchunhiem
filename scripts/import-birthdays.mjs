/**
 * Nạp ngày sinh vào sổ lớp từ một file JSON.
 *
 *   node scripts/import-birthdays.mjs <file.json> [--apply]
 *
 * Không có --apply thì chỉ đối chiếu và in ra, không ghi gì. File JSON là một
 * mảng: [{ "tt": 1, "name": "Võ Nhật Anh", "d": 20, "m": 10, "y": 2009 }, …]
 *
 * Khớp theo họ tên (bỏ hoa thường và khoảng trắng thừa); tên nào không khớp
 * đúng một em, hoặc số thứ tự lệch với sổ, thì báo ra và bỏ qua chứ không đoán.
 */
import { MongoClient } from "mongodb";
import { readFileSync, writeFileSync } from "node:fs";

const [file, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");
if (!file) {
  console.error("Thiếu đường dẫn file JSON.");
  process.exit(1);
}

const rows = JSON.parse(readFileSync(file, "utf8"));
const env = readFileSync(".env.local", "utf8");
const uri = env.match(/MONGODB_URI=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const norm = (s) => (s || "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

const client = new MongoClient(uri);
await client.connect();
const db = client.db("ptex_webchunhiem");
const col = db.collection("students");
const year = await db.collection("schoolYears").findOne({ isCurrent: true });
const projection = { fullName: 1, profileTt: 1, birthDay: 1, birthMonth: 1, birthYear: 1 };
const students = await col.find({ schoolYearId: String(year._id) }).project(projection).toArray();

const backup = `${file.replace(/\.json$/, "")}-backup.json`;
writeFileSync(backup, JSON.stringify(students, null, 1), "utf8");

const byName = new Map();
for (const s of students) {
  const key = norm(s.fullName);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(s);
}

const problems = [];
const plan = [];
for (const r of rows) {
  const hits = byName.get(norm(r.name)) || [];
  if (hits.length !== 1) {
    problems.push(`${r.tt}. ${r.name} → khớp ${hits.length} em, bỏ qua`);
    continue;
  }
  const s = hits[0];
  if (s.profileTt && s.profileTt !== r.tt) {
    problems.push(`${r.tt}. ${r.name} → số thứ tự trong sổ là ${s.profileTt}, bỏ qua`);
    continue;
  }
  const same = s.birthDay === r.d && s.birthMonth === r.m && s.birthYear === r.y;
  plan.push({ id: s._id, name: s.fullName, from: `${s.birthDay}/${s.birthMonth}/${s.birthYear}`, to: `${r.d}/${r.m}/${r.y}`, same, r });
}

const used = new Set(rows.map((r) => norm(r.name)));
for (const s of students) if (!used.has(norm(s.fullName))) problems.push(`Không có trong file: ${s.fullName}`);

const willChange = plan.filter((p) => !p.same);
console.log(`Sổ ${students.length} em · file ${rows.length} dòng · khớp ${plan.length} · sẽ đổi ${willChange.length}`);
console.log(`Bản lưu trước khi ghi: ${backup}`);
for (const p of problems) console.log("  ⚠", p);

if (!apply) {
  console.log("\nMới chỉ đối chiếu. Thêm --apply để ghi thật.");
} else {
  const now = new Date().toISOString();
  for (const p of willChange) {
    await col.updateOne(
      { _id: p.id },
      { $set: { birthDay: p.r.d, birthMonth: p.r.m, birthYear: p.r.y, updatedAt: now } },
    );
  }
  const after = await col.find({ schoolYearId: String(year._id) }).project(projection).toArray();
  const missing = after.filter((s) => !(s.birthDay > 0 && s.birthMonth > 0 && s.birthYear > 1900));
  console.log(`\nĐã ghi ${willChange.length} em. Còn thiếu ngày sinh: ${missing.length}`);
  for (const s of missing) console.log("  -", s.fullName);
}

await client.close();
