import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

import type { LegacySeedData } from "@/lib/types";

export async function loadLegacySeedData(): Promise<LegacySeedData> {
  const dataFile = await fs.readFile(path.join(process.cwd(), "data.js"), "utf8");
  const parentFile = await fs.readFile(path.join(process.cwd(), "api", "parents.js"), "utf8");

  const sandbox: Record<string, unknown> = {};
  vm.createContext(sandbox);
  vm.runInContext(`${dataFile}
this.__exports = { CLASS_INFO, GVCN_INFO, EXAM_INFO, STUDENTS };`, sandbox);

  const parentArrayMatch = parentFile.match(/return\s*(\[[\s\S]*?\]);/);
  if (!parentArrayMatch) {
    throw new Error("Cannot parse legacy parent data.");
  }

  const parentSandbox: Record<string, unknown> = {};
  vm.createContext(parentSandbox);
  vm.runInContext(`this.__parents = ${parentArrayMatch[1]}`, parentSandbox);

  const exported = sandbox.__exports as {
    CLASS_INFO: LegacySeedData["classInfo"];
    GVCN_INFO: LegacySeedData["gvcnInfo"];
    EXAM_INFO: LegacySeedData["examInfo"];
    STUDENTS: LegacySeedData["students"];
  };
  const parents = parentSandbox.__parents as LegacySeedData["parents"];

  return {
    classInfo: exported.CLASS_INFO,
    gvcnInfo: exported.GVCN_INFO,
    examInfo: exported.EXAM_INFO,
    students: exported.STUDENTS,
    parents,
  };
}
