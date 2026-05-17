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

/** Every gated capability across the admin surface. The WHOLE admin
 *  panel — legacy pages + APIs included — is gated against these via
 *  the central route-permission map (lib/admin-route-permissions.ts).
 *  Adding a permission here without mapping a route just means no
 *  route requires it yet. */
export type AdminPermission =
  | "view_operations" // dashboard, analytics, live trips, ride monitoring
  | "manage_routes" // edit the route-taxi catalogue
  | "manage_users" // view + act on rider / driver accounts
  | "view_incidents" // incident reports + safety queue + messaging
  | "manage_incidents" // update / resolve / close incidents
  | "suspend_user" // temporary rider/driver suspension
  | "ban_user" // permanent account ban
  | "view_finance" // wallets, transactions, QR charges
  | "freeze_payout" // payouts, payout holds, wallet adjustments
  | "view_fraud" // see risk scores + fraud dashboards
  | "manage_fraud" // open/resolve fraud investigations, raise flags
  | "export_evidence" // export consent / incident / fraud evidence
  | "review_drivers" // driver verification, vehicle changes, violations
  | "edit_policies" // edit + publish legal policies
  | "manage_security" // audit logs + admin security console
  | "manage_admins"; // add admins, change roles, suspend admins

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
  // Support: read-only operational + incident visibility, nothing more.
  support_agent: ["view_operations", "view_incidents"],
  // Moderator: works incidents, suspends users, reviews drivers + fraud
  // signals — no finance, no permanent bans, no security/admin config.
  moderator: [
    "view_operations",
    "view_incidents",
    "manage_incidents",
    "manage_users",
    "suspend_user",
    "view_fraud",
    "review_drivers",
  ],
  // Compliance / investigator: full fraud + financial + evidence reach.
  compliance: [
    "view_operations",
    "view_incidents",
    "manage_incidents",
    "manage_users",
    "suspend_user",
    "view_finance",
    "freeze_payout",
    "view_fraud",
    "manage_fraud",
    "export_evidence",
    "review_drivers",
  ],
  // Technical admin: operations + routes + security config; minimal
  // user-data access (no finance, no fraud-management, no bans).
  technical_admin: [
    "view_operations",
    "view_incidents",
    "manage_routes",
    "manage_security",
  ],
  // Super admin: everything — listed explicitly, no implicit wildcard.
  super_admin: [
    "view_operations",
    "manage_routes",
    "manage_users",
    "view_incidents",
    "manage_incidents",
    "suspend_user",
    "ban_user",
    "view_finance",
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

/** Permissions granted to a safety officer (profiles.role =
 *  'safety_officer'). Officers aren't `admin` tier — they get a fixed,
 *  narrow set: the safety queue, incidents, and operational trip
 *  visibility so they can intervene on a live ride. */
const SAFETY_OFFICER_PERMISSIONS: AdminPermission[] = [
  "view_operations",
  "view_incidents",
  "manage_incidents",
];

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

/**
 * The effective permission set for a user, resolved from BOTH their
 * `profiles.role` and (for admins) their `admin_role` tier.
 *
 *   - safety_officer → the fixed officer set
 *   - admin          → their RBAC tier's set (none if no tier assigned)
 *   - anyone else    → nothing (riders/drivers have no admin reach)
 */
export function userPermissions(
  role: string | null | undefined,
  adminRole: AdminRole | null | undefined,
): AdminPermission[] {
  if (role === "safety_officer") return SAFETY_OFFICER_PERMISSIONS;
  if (role === "admin") return permissionsFor(adminRole);
  return [];
}

/** Whether a user (by profile role + admin tier) holds a permission. */
export function userHasPermission(
  role: string | null | undefined,
  adminRole: AdminRole | null | undefined,
  permission: AdminPermission,
): boolean {
  return userPermissions(role, adminRole).includes(permission);
}
