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

export function canSubmitReport(role: AppRole) {
  return role !== "admin";
}

export function canReviewReports(role: AppRole) {
  return role === "admin" || role === "gvcn" || role === "lopTruong";
}

export function getAllowedViews(role: AppRole): NavView[] {
  const views: NavView[] = ["overview", "reports"];

  if (canManageStudents(role)) views.push("students");
  if (canManageParents(role)) views.push("parents");
  if (canManageSchoolYears(role)) views.push("school-years");
  if (canManageAccounts(role)) views.push("accounts");
  if (canViewAudit(role)) views.push("audit");

  return views;
}
