type Stat = { label: string; value: string };
type Item = { title: string; meta: string; status?: "good" | "warn" | "info" };
type Action = { label: string; href: string };

export type ScreenConfig = {
  title: string;
  description: string;
  stats?: Stat[];
  items?: Item[];
  actions?: Action[];
};

export const riderScreens: Record<string, ScreenConfig> = {
  request: {
    title: "Ride Request Form",
    description: "Select pickup, destination, parish pair, and seat count before dispatch.",
    stats: [
      { label: "Pickup", value: "Cross Roads" },
      { label: "Dropoff", value: "Papine" },
      { label: "Seats", value: "2" },
    ],
    actions: [
      { label: "Estimate Fare", href: "/rider/fare-breakdown" },
      { label: "Find Driver", href: "/rider/matching" },
    ],
  },
  "fare-breakdown": {
    title: "Fare Breakdown",
    description: "Transparent parish-based pricing with peak and service multipliers.",
    items: [
      { title: "Base Fare", meta: "JMD 320", status: "info" },
      { title: "Distance + Time", meta: "JMD 180", status: "info" },
      { title: "Parish Multiplier", meta: "Kingston to St. Andrew x1.05", status: "warn" },
      { title: "Total", meta: "JMD 525", status: "good" },
    ],
  },
  matching: {
    title: "Driver Match",
    description: "Live matching queue for nearby verified red plate drivers.",
    items: [
      { title: "Driver: Karl M.", meta: "Toyota Axio • ETA 3 mins", status: "good" },
      { title: "Driver: Tameka R.", meta: "Nissan AD Wagon • ETA 5 mins", status: "info" },
    ],
  },
  "live-trip": {
    title: "Live Trip Tracking",
    description: "Track route, ETA, and seat occupancy in real time.",
    stats: [
      { label: "ETA", value: "11 mins" },
      { label: "Speed", value: "42 km/h" },
      { label: "Seats Occupied", value: "3/4" },
    ],
  },
  payments: {
    title: "Wallet & Payments",
    description: "Top up your Rajlo wallet — every trip auto-debits, no cash.",
    items: [
      { title: "Visa ending 2204", meta: "Saved for top-ups", status: "good" },
      { title: "Wallet balance", meta: "Auto-debited per trip", status: "info" },
    ],
  },
  confirmation: {
    title: "Booking Confirmation",
    description: "Receipt, driver assignment, and estimated pickup details.",
    stats: [
      { label: "Booking ID", value: "JR-98201" },
      { label: "Total", value: "JMD 525" },
      { label: "Seats", value: "2" },
    ],
  },
  history: {
    title: "Ride History",
    description: "Past rides with fare receipts and quick rebook actions.",
    items: [
      { title: "Kingston to Portmore", meta: "JMD 1,340 • 21 Mar", status: "info" },
      { title: "Papine to Downtown", meta: "JMD 620 • 20 Mar", status: "good" },
    ],
    actions: [{ label: "Open Ride JR-98201", href: "/rider/history/JR-98201" }],
  },
  ratings: {
    title: "Ratings and Feedback",
    description: "Review completed rides and share detailed driver feedback.",
    stats: [
      { label: "Pending Reviews", value: "2" },
      { label: "Submitted", value: "14" },
      { label: "Avg Given", value: "4.6" },
    ],
  },
  settings: {
    title: "Profile and Settings",
    description: "Manage profile, trusted contacts, language, and notification preferences.",
    items: [
      { title: "Trusted Contacts", meta: "2 saved", status: "good" },
      { title: "Parish Preference", meta: "Kingston and St. Andrew", status: "info" },
    ],
  },
  notifications: {
    title: "Notifications Center",
    description: "Ride updates, promos, payment confirmations, and safety alerts.",
    items: [
      { title: "Driver arrived", meta: "2 mins ago", status: "good" },
      { title: "Receipt available", meta: "14 mins ago", status: "info" },
    ],
  },
  support: {
    title: "Help and Support",
    description: "Open support tickets and follow dispute status.",
    items: [
      { title: "Ticket #SR-204", meta: "Fare discrepancy • in review", status: "warn" },
      { title: "Ticket #SR-188", meta: "Resolved", status: "good" },
    ],
  },
  safety: {
    title: "Safety",
    description: "Quick access to SOS, trusted contacts, and trip sharing.",
    actions: [
      { label: "Start SOS", href: "/rider/safety" },
      { label: "Share Live Trip", href: "/rider/live-trip" },
    ],
  },
};

export const driverScreens: Record<string, ScreenConfig> = {
  onboarding: {
    title: "Driver Onboarding",
    description: "Step-by-step setup for red plate PPV drivers. All 10 TA documents required before activation.",
    stats: [
      { label: "Steps Completed", value: "3/7" },
      { label: "Documents Uploaded", value: "4/10" },
      { label: "Status", value: "In Progress" },
    ],
    actions: [
      { label: "Continue Onboarding", href: "/driver/onboarding" },
    ],
  },
  documents: {
    title: "TA Document Hub",
    description: "All 10 Jamaica Transport Authority required documents for red plate PPV operation.",
    items: [
      { title: "TA Franchise Certificate", meta: "Expires 14 Aug 2026 • Approved", status: "good" },
      { title: "TA Driver Badge", meta: "Expires 30 Jun 2026 • Expiring soon", status: "warn" },
      { title: "Certificate of Fitness (COF)", meta: "Expires 1 May 2026 • Book inspection", status: "warn" },
      { title: "PPV Insurance", meta: "Expires 1 Dec 2026 • Approved", status: "good" },
      { title: "Driver's Licence", meta: "Expires Mar 2028 • Approved", status: "good" },
      { title: "TRN & NIS Numbers", meta: "On file • Permanent", status: "good" },
      { title: "Police Record", meta: "Issued Jan 2025 • Expires 2027", status: "good" },
      { title: "Red Plate Registration", meta: "Expires 20 Nov 2026 • Approved", status: "good" },
      { title: "Identity Selfie", meta: "Under Admin Review", status: "info" },
    ],
    actions: [
      { label: "Upload or Update Documents", href: "/driver/documents" },
      { label: "View Full Compliance Status", href: "/driver/verification" },
    ],
  },
  verification: {
    title: "TA Compliance Status",
    description: "Transport Authority compliance overview with renewal countdowns for all mandatory documents.",
    items: [
      { title: "TA Franchise Certificate", meta: "Approved • Next renewal Aug 2026", status: "good" },
      { title: "TA Driver Badge", meta: "Expiring in 94 days — renew now", status: "warn" },
      { title: "Certificate of Fitness (COF)", meta: "Expiring in 34 days — book inspection", status: "warn" },
      { title: "PPV Insurance", meta: "Approved • Valid until Dec 2026", status: "good" },
      { title: "Driver's Licence", meta: "Approved • Valid until Mar 2028", status: "good" },
      { title: "TRN", meta: "Approved — permanent", status: "good" },
      { title: "NIS", meta: "Approved — permanent", status: "good" },
      { title: "Police Record", meta: "Approved • Valid until 2027", status: "good" },
      { title: "Red Plate Registration", meta: "Approved • Valid until Nov 2026", status: "good" },
      { title: "Identity Selfie", meta: "Pending admin review", status: "info" },
    ],
    actions: [
      { label: "Upload Missing Documents", href: "/driver/documents" },
    ],
  },
  requests: {
    title: "Incoming Ride Requests",
    description: "Accept or decline requests by ETA, seat count, and fare value.",
    items: [
      { title: "Cross Roads to New Kingston", meta: "2 seats • JMD 540", status: "good" },
      { title: "Downtown to Half-Way Tree", meta: "1 seat • JMD 430", status: "info" },
    ],
  },
  "active-trip": {
    title: "Active Trip Navigation",
    description: "Turn-by-turn route summary and passenger pickup progression.",
    stats: [
      { label: "ETA", value: "9 mins" },
      { label: "Current Stop", value: "Liguanea" },
      { label: "Passengers", value: "3" },
    ],
  },
  seats: {
    title: "Seat Management",
    description: "Control available seats and prevent overbooking with lock windows.",
    stats: [
      { label: "Capacity", value: "4" },
      { label: "Reserved", value: "2" },
      { label: "Open", value: "2" },
    ],
  },
  "trip-complete": {
    title: "Trip Completion",
    description: "Finalize fare, rider confirmations, and payout eligibility.",
    stats: [
      { label: "Trip Fare", value: "JMD 1,180" },
      { label: "Platform Fee", value: "JMD 118" },
      { label: "Net", value: "JMD 1,062" },
    ],
  },
  earnings: {
    title: "Earnings Dashboard",
    description: "Daily and weekly earnings with route-level breakdowns.",
    stats: [
      { label: "Today", value: "JMD 7,240" },
      { label: "This Week", value: "JMD 32,180" },
      { label: "Completed Trips", value: "28" },
    ],
  },
  payouts: {
    title: "Payout Settings",
    description: "Manage settlement accounts and payout schedules.",
    items: [
      { title: "Bank Account", meta: "NCB ending 4802", status: "good" },
      { title: "Next Payout", meta: "Monday 9:00 AM", status: "info" },
    ],
  },
  history: {
    title: "Driver Trip History",
    description: "Past trips with rider ratings and settlement records.",
    items: [
      { title: "Papine Loop", meta: "JMD 890 • 5 riders", status: "good" },
      { title: "Portmore Evening", meta: "JMD 1,460 • 6 riders", status: "info" },
    ],
  },
  ratings: {
    title: "Driver Ratings",
    description: "View rider feedback trends and quality score impact.",
    stats: [
      { label: "Current Score", value: "4.8" },
      { label: "Last 30 Days", value: "132 reviews" },
      { label: "5-Star Rate", value: "91%" },
    ],
  },
  profile: {
    title: "Driver and Vehicle Profile",
    description: "Maintain contact details, vehicle records, and service areas.",
    items: [
      { title: "Vehicle", meta: "Toyota Axio • 2018", status: "info" },
      { title: "Service Area", meta: "Kingston, St. Andrew", status: "good" },
    ],
  },
  notifications: {
    title: "Driver Notifications",
    description: "Ride alerts, TA compliance reminders, and payout notices.",
    items: [
      { title: "COF Expiry Warning", meta: "Your Certificate of Fitness expires in 34 days. Book inspection now.", status: "warn" },
      { title: "TA Badge Renewal Due", meta: "TA Driver Badge expires in 94 days. Visit transportauthority.gov.jm.", status: "warn" },
      { title: "New ride request nearby", meta: "Cross Roads → New Kingston • 1 min ago", status: "good" },
      { title: "Payout processed", meta: "JMD 7,240 deposited — NCB ending 4802", status: "good" },
      { title: "Selfie under review", meta: "Admin is reviewing your identity selfie submission", status: "info" },
    ],
    actions: [
      { label: "View Compliance Status", href: "/driver/verification" },
    ],
  },
  "support-safety": {
    title: "Support and Safety",
    description: "Submit incidents, access emergency support, and resolve rider issues.",
    items: [
      { title: "Incident #DS-44", meta: "Open", status: "warn" },
      { title: "Support #DS-30", meta: "Resolved", status: "good" },
    ],
  },
};

export const adminScreens: Record<string, ScreenConfig> = {
  dashboard: {
    title: "Operations Dashboard",
    description: "Realtime KPIs across rides, verifications, and incident response.",
    stats: [
      { label: "Active Rides", value: "418" },
      { label: "Pending Verifications", value: "53" },
      { label: "Open Disputes", value: "17" },
    ],
  },
  "verification-queue": {
    title: "Driver Verification Queue",
    description: "Review incoming driver profiles and document compliance.",
    items: [
      { title: "DRV-1024", meta: "Awaiting TA match", status: "warn" },
      { title: "DRV-1017", meta: "Ready for approval", status: "good" },
    ],
  },
  "verification-detail": {
    title: "Verification Detail",
    description: "Detailed inspection screen for driver verification decisions.",
    items: [
      { title: "TRN + Identity", meta: "Matched", status: "good" },
      { title: "Insurance", meta: "Expiring soon", status: "warn" },
    ],
  },
  parishes: {
    title: "Parish and Zone Management",
    description: "Maintain parish geofences and route zone relationships.",
    stats: [
      { label: "Active Parishes", value: "14" },
      { label: "Custom Zones", value: "33" },
      { label: "Needs Review", value: "4" },
    ],
  },
  "fare-rules": {
    title: "Fare Rules",
    description: "Parish-to-parish base fare and per-unit pricing table.",
    items: [
      { title: "Kingston -> St. Andrew", meta: "Base JMD 300", status: "good" },
      { title: "St. James -> Hanover", meta: "Base JMD 420", status: "info" },
    ],
  },
  "fare-overrides": {
    title: "Fare Overrides",
    description: "Apply temporary multipliers for demand or weather conditions.",
    items: [
      { title: "Downtown Rain Surge", meta: "x1.22 • ends 8:30 PM", status: "warn" },
      { title: "Airport Lane Promo", meta: "x0.95 • ends 11:00 PM", status: "info" },
    ],
  },
  "ride-monitoring": {
    title: "Ride Monitoring",
    description: "Live map view of trips with anomaly and delay signals.",
    stats: [
      { label: "Monitored Rides", value: "418" },
      { label: "At-Risk Trips", value: "6" },
      { label: "Average ETA Drift", value: "+2.1 min" },
    ],
  },
  disputes: {
    title: "Disputes and Support Tickets",
    description: "Triage rider and driver issues and assign priority.",
    items: [
      { title: "DSP-320", meta: "Payment mismatch", status: "warn" },
      { title: "DSP-318", meta: "Resolved", status: "good" },
    ],
  },
  users: {
    title: "User Management",
    description: "Role management and account status controls.",
    stats: [
      { label: "Riders", value: "61,204" },
      { label: "Drivers", value: "2,831" },
      { label: "Suspended", value: "39" },
    ],
  },
  payouts: {
    title: "Payout and Settlement Review",
    description: "Validate payout batches, failures, and reconciliation trails.",
    items: [
      { title: "Batch P-2201", meta: "JMD 3.2M • processing", status: "info" },
      { title: "Batch P-2200", meta: "Completed", status: "good" },
    ],
  },
  "audit-logs": {
    title: "Audit Logs",
    description: "Immutable timeline of verification, fare, and access changes.",
    items: [
      { title: "Fare Rule Updated", meta: "Admin YH-03 • 12:31 PM", status: "info" },
      { title: "Driver Approved", meta: "Admin RB-17 • 12:14 PM", status: "good" },
    ],
  },
  "notification-templates": {
    title: "Notification Templates",
    description: "Manage SMS, email, and web push communication templates.",
    items: [
      { title: "Ride Assigned", meta: "SMS + Push", status: "good" },
      { title: "Verification Rejected", meta: "Email", status: "info" },
    ],
  },
  "risk-alerts": {
    title: "Risk and Fraud Alerts",
    description: "Monitor suspicious device, payment, and trip behavior patterns.",
    items: [
      { title: "AL-998", meta: "Seat overbooking pattern", status: "warn" },
      { title: "AL-992", meta: "Resolved", status: "good" },
    ],
  },
};