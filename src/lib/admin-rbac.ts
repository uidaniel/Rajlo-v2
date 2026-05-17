/**
 * RAJLO internal admin RBAC — the 5-tier privilege model.
 *
 * Each admin (a user with `profiles.role = 'admin'`) also carries a
 * granular `admin_role`. The permission each tier grants is defined
 * HERE, in code — not in the database — so the matrix is
 * version-controlled, reviewable, and can't be widened by tampering
 * with a DB row.
 *
 * Enforcement: API routes call `requirePermission(<permission>)` from
 * admin-auth.ts. A tier that lacks the permission gets a 403.
 */

/** The 5 internal admin tiers, least → most privileged. */
export const ADMIN_ROLES = [
  "support_agent",
  "moderator",
  "compliance",
  "technical_admin",
  "super_admin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Every gated capability across the admin surface. New subsystems
 *  (fraud, moderation, incidents) add their checks against these. */
export type AdminPermission =
  | "view_incidents" // see incident reports + safety queue
  | "manage_incidents" // update / resolve / close incidents
  | "suspend_user" // temporary rider/driver suspension
  | "ban_user" // permanent account ban
  | "freeze_payout" // place / release payout holds
  | "view_fraud" // see risk scores + fraud dashboards
  | "manage_fraud" // open/resolve fraud investigations, raise flags
  | "export_evidence" // export consent / incident / fraud evidence
  | "review_drivers" // approve / reject driver verification
  | "edit_policies" // edit + publish legal policies
  | "manage_security" // infrastructure + security configuration
  | "manage_admins"; // change admin roles, suspend admins

/** Human labels for the tiers — used in the admin UI. */
export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  support_agent: "Support agent",
  moderator: "Moderator",
  compliance: "Compliance / investigator",
  technical_admin: "Technical admin",
  super_admin: "Super admin",
};

/** One-line description of each tier — shown in the role picker. */
export const ADMIN_ROLE_DESCRIPTION: Record<AdminRole, string> = {
  support_agent: "Read-only incident review and basic support tools.",
  moderator:
    "Handles incidents, issues temporary suspensions, reviews fraud signals.",
  compliance:
    "Fraud investigations, payout holds, evidence exports, driver review.",
  technical_admin:
    "Infrastructure + security configuration; minimal user-data access.",
  super_admin: "Full access, including admin management and bans.",
};

/**
 * The permission matrix. `super_admin` is granted everything
 * explicitly below so the set is auditable at a glance — no implicit
 * "and also everything else".
 */
const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  support_agent: ["view_incidents"],
  moderator: [
    "view_incidents",
    "manage_incidents",
    "suspend_user",
    "view_fraud",
    "review_drivers",
  ],
  compliance: [
    "view_incidents",
    "manage_incidents",
    "suspend_user",
    "view_fraud",
    "manage_fraud",
    "freeze_payout",
    "export_evidence",
    "review_drivers",
  ],
  technical_admin: ["view_incidents", "view_fraud", "manage_security"],
  super_admin: [
    "view_incidents",
    "manage_incidents",
    "suspend_user",
    "ban_user",
    "freeze_payout",
    "view_fraud",
    "manage_fraud",
    "export_evidence",
    "review_drivers",
    "edit_policies",
    "manage_security",
    "manage_admins",
  ],
};

/**
 * Does an admin tier grant a permission?
 *
 * A null role (an `admin` profile that predates RBAC assignment, or
 * one never given a tier) grants NOTHING — least privilege. A
 * super_admin then assigns the proper tier from the admin panel.
 */
export function hasPermission(
  role: AdminRole | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** All permissions a tier holds — handy for the admin UI. */
export function permissionsFor(role: AdminRole | null | undefined): AdminPermission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Narrow an arbitrary string to a valid AdminRole, or null. */
export function asAdminRole(value: string | null | undefined): AdminRole | null {
  return value && (ADMIN_ROLES as readonly string[]).includes(value)
    ? (value as AdminRole)
    : null;
}
