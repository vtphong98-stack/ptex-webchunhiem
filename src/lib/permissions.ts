import type { AppRole, NavView } from "@/lib/types";

export function canManageStudents(role: AppRole) {
  return role === "admin" || role === "gvcn";
}

export function canManageParents(role: AppRole) {
  return role === "admin" || role === "gvcn" || role === "lopTruong";
}

export function canManageSchoolYears(role: AppRole) {
  return role === "admin" || role === "gvcn";
}

export function canManageAccounts(role: AppRole) {
  return role === "admin";
}

export function canViewAudit(role: AppRole) {
  return role === "admin" || role === "gvcn";
}

/**
 * Officers submit their own weekly report; gvcn/admin submit through the desk's
 * "view as" mode. Spelled out rather than `return true` so an unknown role added
 * later does not silently inherit write access.
 */
export function canSubmitReport(role: AppRole) {
  return isClassOfficer(role) || role === "gvcn" || role === "admin";
}

export function isClassOfficer(role: AppRole) {
  return role !== "admin" && role !== "gvcn";
}

export function canReviewReports(role: AppRole) {
  return role === "admin" || role === "gvcn";
}

export function getAllowedViews(role: AppRole): NavView[] {
  if (isClassOfficer(role)) {
    return ["reports"];
  }

  const views: NavView[] = ["reports", "overview"];

  if (canManageStudents(role)) views.push("students");
  if (canManageParents(role)) views.push("parents");
  if (canManageSchoolYears(role)) views.push("school-years");
  if (canManageAccounts(role)) views.push("accounts");
  if (canViewAudit(role)) views.push("audit");

  return views;
}
