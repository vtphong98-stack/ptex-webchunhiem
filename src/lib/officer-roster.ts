export type RosterStudent = { _id: string; fullName: string };

export function flattenTeamRosters(teams: Record<string, RosterStudent[]>) {
  return [1, 2, 3, 4].flatMap((teamNumber) =>
    (teams[String(teamNumber)] ?? []).map((student) => ({
      ...student,
      teamNumber,
    })),
  );
}

export function alignRowsByStudents<T extends { studentId: string; fullName: string }>(
  students: RosterStudent[],
  saved: T[],
  emptyRow: (student: RosterStudent) => T,
) {
  const byKey = new Map(saved.map((row) => [row.studentId || row.fullName, row]));
  return students.map((student) => {
    const hit = byKey.get(student._id) ?? byKey.get(student.fullName);
    return hit ? { ...emptyRow(student), ...hit, studentId: student._id, fullName: student.fullName } : emptyRow(student);
  });
}
