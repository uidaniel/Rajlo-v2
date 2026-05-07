import type { IconName } from "@/components/icons";

export type NavItem = { label: string; href: string; icon: IconName };

export const riderNav: NavItem[] = [
  { label: "Dashboard", href: "/rider", icon: "home" },
  { label: "Request a ride", href: "/rider/request", icon: "plus-circle" },
  { label: "Live trip", href: "/rider/live-trip", icon: "navigation" },
  { label: "Trip details", href: "/rider/trip-details", icon: "file-text" },
  { label: "Fare breakdown", href: "/rider/fare-breakdown", icon: "calculator" },
  { label: "Payments", href: "/rider/payments", icon: "credit-card" },
  { label: "History", href: "/rider/history", icon: "clock" },
  { label: "Ratings", href: "/rider/ratings", icon: "star" },
  { label: "Notifications", href: "/rider/notifications", icon: "bell" },
  { label: "Settings", href: "/rider/settings", icon: "settings" },
  { label: "Support", href: "/rider/support", icon: "help-circle" },
  { label: "Safety", href: "/rider/safety", icon: "shield" },
];

export const driverNav: NavItem[] = [
  { label: "Dashboard", href: "/driver", icon: "home" },
  { label: "Documents", href: "/driver/documents", icon: "file-text" },
  { label: "TA verification", href: "/driver/verification", icon: "shield-check" },
  { label: "Ride requests", href: "/driver/requests", icon: "inbox" },
  { label: "Active trip", href: "/driver/active-trip", icon: "navigation" },
  { label: "Seats", href: "/driver/seats", icon: "users" },
  { label: "Earnings", href: "/driver/earnings", icon: "trending-up" },
  { label: "Payouts", href: "/driver/payouts", icon: "wallet" },
  { label: "History", href: "/driver/history", icon: "clock" },
  { label: "Ratings", href: "/driver/ratings", icon: "star" },
  { label: "Notifications", href: "/driver/notifications", icon: "bell" },
  { label: "Profile", href: "/driver/profile", icon: "user" },
  { label: "Support & safety", href: "/driver/support-safety", icon: "shield" },
];

export const adminNav: NavItem[] = [
  { label: "Operations", href: "/admin", icon: "home" },
  { label: "Verification queue", href: "/admin/verification-queue", icon: "clipboard-check" },
  { label: "Ride monitoring", href: "/admin/ride-monitoring", icon: "activity" },
  { label: "Parishes", href: "/admin/parishes", icon: "map" },
  { label: "Fare rules", href: "/admin/fare-rules", icon: "scale" },
  { label: "Fare overrides", href: "/admin/fare-overrides", icon: "trending-up" },
  { label: "Disputes", href: "/admin/disputes", icon: "alert-triangle" },
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Payouts", href: "/admin/payouts", icon: "wallet" },
  { label: "Audit logs", href: "/admin/audit-logs", icon: "history" },
  { label: "Templates", href: "/admin/notification-templates", icon: "mail" },
  { label: "Risk alerts", href: "/admin/risk-alerts", icon: "shield-alert" },
];

export const parishes = [
  "Kingston",
  "St. Andrew",
  "St. Catherine",
  "Clarendon",
  "Manchester",
  "St. James",
  "St. Ann",
  "Portland",
];

export const sampleRides = [
  { title: "Half-Way Tree to Papine", meta: "2 seats • 14 mins • JMD 520", status: "info" as const },
  { title: "May Pen to Mandeville", meta: "1 seat • 39 mins • JMD 1,260", status: "good" as const },
  { title: "Montego Bay to Negril", meta: "3 seats • 1h 10m • JMD 2,850", status: "warn" as const },
];

export const verificationQueue = [
  { title: "DRV-1024 • Andre Lewis", meta: "Red Plate 5812 GK • Submitted 34 mins ago", status: "warn" as const },
  { title: "DRV-1031 • Kemar Blake", meta: "Missing COF • Submitted 12 mins ago", status: "info" as const },
  { title: "DRV-0998 • Natalie Brown", meta: "All docs submitted • Awaiting admin review", status: "good" as const },
];

// All required TA documents for red plate PPV drivers
export type DocStatus = "approved" | "pending" | "rejected" | "missing" | "expiring_soon" | "expired";
export type TADocument = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  renewalPeriodDays: number; // 365 = annual
  expiryDate?: string;
  status: DocStatus;
  note?: string;
};

export const requiredTADocuments: TADocument[] = [
  {
    id: "franchise_cert",
    label: "TA Franchise Certificate",
    description: "Route-specific PPV franchise issued by Jamaica Transport Authority. Renewed annually.",
    required: true,
    renewalPeriodDays: 365,
    expiryDate: "2026-08-14",
    status: "approved",
  },
  {
    id: "driver_badge",
    label: "TA Driver Badge / Photo ID",
    description: "Official TA-issued photo identification badge. Must be visibly displayed in vehicle. Renewed annually.",
    required: true,
    renewalPeriodDays: 365,
    expiryDate: "2026-06-30",
    status: "expiring_soon",
    note: "Expires in 94 days — renewal recommended now",
  },
  {
    id: "cof",
    label: "Certificate of Fitness (COF)",
    description: "Annual vehicle inspection pass issued by the TA. Vehicle must pass physical inspection.",
    required: true,
    renewalPeriodDays: 365,
    expiryDate: "2026-05-01",
    status: "expiring_soon",
    note: "Expires in 34 days — book inspection immediately",
  },
  {
    id: "insurance",
    label: "Comprehensive Insurance (PPV)",
    description: "Must cover public passenger vehicle / commercial use, not just third party.",
    required: true,
    renewalPeriodDays: 365,
    expiryDate: "2026-12-01",
    status: "approved",
  },
  {
    id: "drivers_licence_front",
    label: "Driver's Licence — Front",
    description: "Front of the Jamaica driver's licence. Class must permit PPV / taxi operation.",
    required: true,
    renewalPeriodDays: 1825, // 5 years typical
    expiryDate: "2028-03-10",
    status: "approved",
  },
  {
    id: "drivers_licence_back",
    label: "Driver's Licence — Back",
    description: "Back of the Jamaica driver's licence. Same expiry as the front.",
    required: true,
    renewalPeriodDays: 1825,
    expiryDate: "2028-03-10",
    status: "approved",
  },
  {
    id: "police_record",
    label: "Police Record / Good Conduct Certificate",
    description: "Required at initial application and periodically at admin discretion.",
    required: true,
    renewalPeriodDays: 730, // every 2 years
    expiryDate: "2027-01-15",
    status: "approved",
  },
  {
    id: "red_plate_reg",
    label: "Red Plate Vehicle Registration",
    description: "Vehicle registration document confirming PPV red plates.",
    required: true,
    renewalPeriodDays: 365,
    expiryDate: "2026-11-20",
    status: "approved",
  },
  {
    id: "selfie",
    label: "Identity Selfie",
    description: "Live selfie matched against driver licence and TA badge photo.",
    required: true,
    renewalPeriodDays: 0,
    status: "pending",
    note: "Under review",
  },
];

// Compliance timeline for renewal reminders
export const complianceThresholds = {
  warningDays: 60,
  urgentDays: 30,
  criticalDays: 7,
};