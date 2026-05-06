export const riderNav = [
  { label: "Dashboard", href: "/rider" },
  { label: "Request", href: "/rider/request" },
  { label: "Fare", href: "/rider/fare-breakdown" },
  { label: "Matching", href: "/rider/matching" },
  { label: "Live Trip", href: "/rider/live-trip" },
  { label: "Trip Details", href: "/rider/trip-details" },
  { label: "Payments", href: "/rider/payments" },
  { label: "Confirmation", href: "/rider/confirmation" },
  { label: "History", href: "/rider/history" },
  { label: "Ratings", href: "/rider/ratings" },
  { label: "Settings", href: "/rider/settings" },
  { label: "Notifications", href: "/rider/notifications" },
  { label: "Support", href: "/rider/support" },
  { label: "Safety", href: "/rider/safety" },
];

export const driverNav = [
  { label: "Dashboard", href: "/driver" },
  { label: "Onboarding", href: "/driver/onboarding" },
  { label: "Documents", href: "/driver/documents" },
  { label: "TA Verification", href: "/driver/verification" },
  { label: "Ride Requests", href: "/driver/requests" },
  { label: "Active Trip", href: "/driver/active-trip" },
  { label: "Seat Management", href: "/driver/seats" },
  { label: "Trip Complete", href: "/driver/trip-complete" },
  { label: "Earnings", href: "/driver/earnings" },
  { label: "Payouts", href: "/driver/payouts" },
  { label: "History", href: "/driver/history" },
  { label: "Ratings", href: "/driver/ratings" },
  { label: "Profile", href: "/driver/profile" },
  { label: "Notifications", href: "/driver/notifications" },
  { label: "Support + Safety", href: "/driver/support-safety" },
];

export const adminNav = [
  { label: "Admin Home", href: "/admin" },
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Verification Queue", href: "/admin/verification-queue" },
  { label: "Verification Detail", href: "/admin/verification-detail" },
  { label: "Parishes", href: "/admin/parishes" },
  { label: "Fare Rules", href: "/admin/fare-rules" },
  { label: "Fare Overrides", href: "/admin/fare-overrides" },
  { label: "Ride Monitoring", href: "/admin/ride-monitoring" },
  { label: "Disputes", href: "/admin/disputes" },
  { label: "Users", href: "/admin/users" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Audit Logs", href: "/admin/audit-logs" },
  { label: "Templates", href: "/admin/notification-templates" },
  { label: "Risk Alerts", href: "/admin/risk-alerts" },
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
    id: "drivers_licence",
    label: "Valid Jamaica Driver's Licence",
    description: "Appropriate licence class for PPV / taxi operation.",
    required: true,
    renewalPeriodDays: 1825, // 5 years typical
    expiryDate: "2028-03-10",
    status: "approved",
  },
  {
    id: "trn",
    label: "TRN (Taxpayer Registration Number)",
    description: "Required for all TA fee payments and government processing.",
    required: true,
    renewalPeriodDays: 0, // permanent
    status: "approved",
  },
  {
    id: "nis",
    label: "NIS Number",
    description: "National Insurance Scheme registration number.",
    required: true,
    renewalPeriodDays: 0,
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