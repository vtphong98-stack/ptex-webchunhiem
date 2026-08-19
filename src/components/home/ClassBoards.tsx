import type { HomeBoard, HomeStarStudent, HomeTeamRank } from "@/lib/home-board";

const TEAM_TONE = ["gold", "sky", "rose", "mint"] as const;

function teamTone(teamNumber: number) {
  return TEAM_TONE[(teamNumber - 1) % TEAM_TONE.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const last = parts.at(-1)?.[0] ?? "";
  const mid = parts.at(-2)?.[0] ?? parts[0]?.[0] ?? "";
  return `${mid}${last}`.toUpperCase();
}

function medal(place: number) {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return `${place}`;
}

function podiumSlot(place: number) {
  if (place === 2) return 1;
  if (place === 1) return 2;
  return 3;
}

function TeamPodium({ teams }: { teams: HomeTeamRank[] }) {
  const top = [...teams]
    .filter((item) => item.submitted)
    .slice(0, 3)
    .sort((a, b) => podiumSlot(a.place) - podiumSlot(b.place) || a.teamNumber - b.teamNumber);

  if (!top.length) {
    return (
      <div className="home-board-empty">
        Các tổ chưa nộp báo cáo tuần này. Nộp xong là bảng vàng hiện ngay trên trang chủ.
      </div>
    );
  }

  return (
    <div className={`home-podium count-${top.length}`}>
      {top.map((team) => (
        <article className={`home-podium-card is-${Math.min(team.place, 3)} tone-${teamTone(team.teamNumber)}`} key={team.teamNumber}>
          <span className="home-podium-medal">{medal(team.place)}</span>
          <strong>Tổ {team.teamNumber}</strong>
          <em>{team.score}</em>
          <span>điểm thi đua</span>
        </article>
      ))}
    </div>
  );
}

function TeamList({ teams }: { teams: HomeTeamRank[] }) {
  const max = Math.max(...teams.filter((item) => item.submitted).map((item) => item.score), 1);
  return (
    <ol className="home-rank-list">
      {teams.map((team) => (
        <li className={`home-rank-row tone-${teamTone(team.teamNumber)}`} key={team.teamNumber}>
          <span className="home-rank-place">{team.submitted ? medal(team.place) : "—"}</span>
          <div className="home-rank-main">
            <div className="home-rank-top">
              <strong>Tổ {team.teamNumber}</strong>
              <b>{team.submitted ? `${team.score} điểm` : "Chưa nộp"}</b>
            </div>
            <div className="home-rank-bar">
              <span style={{ width: team.submitted ? `${Math.max(8, Math.round((team.score / max) * 100))}%` : "0%" }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StarCard({ student }: { student: HomeStarStudent }) {
  return (
    <article className={`home-star-card is-${Math.min(student.place, 4)} tone-${teamTone(student.teamNumber || 1)}`}>
      <div className="home-star-head">
        <span className="home-star-avatar">{initials(student.fullName)}</span>
        <span className="home-star-medal">{medal(student.place)}</span>
      </div>
      <h3>{student.fullName}</h3>
      <p>Tổ {student.teamNumber || "?"}</p>
      <ul>
        <li>
          <b>{student.goodPoints}</b>
          <span>điểm tốt</span>
        </li>
        <li>
          <b>{student.participation}</b>
          <span>phát biểu</span>
        </li>
      </ul>
    </article>
  );
}

export function ClassBoards({ board }: { board: HomeBoard }) {
  const kicker = board.weekNumber
    ? `${board.ended ? "Tuần qua" : "Tuần đang thi đua"} · ${board.weekLabel}${board.dateRange ? ` · ${board.dateRange}` : ""}`
    : "Chờ báo cáo tổ trưởng";

  return (
    <>
      <section className="site-section home-board-section block-amber">
        <h2>Bảng xếp hạng các tổ</h2>
        <div className="home-board home-board-rank">
          <p className="home-board-kicker">{kicker}</p>
          {board.firstPlace ? <p className="home-board-lead">Hạng nhất: {board.firstPlace}</p> : null}
          <TeamPodium teams={board.teams} />
          <TeamList teams={board.teams} />
        </div>
      </section>

      <section className="site-section home-board-section block-rose">
        <h2>Học sinh tiêu biểu tuần qua</h2>
        <div className="home-board home-board-stars">
          <p className="home-board-kicker">Điểm tốt và phát biểu nhiều nhất được ghi nhận lên bảng vàng lớp.</p>
          {board.stars.length ? (
            <div className="home-star-grid">
              {board.stars.map((student) => (
                <StarCard key={`${student.fullName}-${student.teamNumber}`} student={student} />
              ))}
            </div>
          ) : (
            <div className="home-board-empty">
              Chưa có em nào được ghi điểm tốt hoặc phát biểu tuần này. Tổ trưởng ghi nhận để lên trang chủ.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
