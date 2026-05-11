/**
 * Pre-canned safety tips an officer can send to a rider with one tap
 * from the alert detail page. Each tip is a short, calm, actionable
 * sentence — the goal is to defuse a stressful moment, not to lecture.
 *
 * `category` groups them in the UI: `reassure` for "you're safe", `act`
 * for "do this now", `share` for "tell us / share location".
 */

export type SafetyTip = {
  id: string;
  category: "reassure" | "act" | "share";
  label: string;
  body: string;
};

export const SAFETY_TIPS: SafetyTip[] = [
  {
    id: "officer-watching",
    category: "reassure",
    label: "Officer is watching",
    body: "A Rajlo safety officer is now monitoring your trip in real time. We can see the driver's location and we'll stay with you until you arrive.",
  },
  {
    id: "stay-calm",
    category: "reassure",
    label: "Stay calm",
    body: "You're not alone — we're here. Stay calm, keep your phone with you, and tell us anything you notice (street name, landmarks, what the driver is doing).",
  },
  {
    id: "share-location",
    category: "share",
    label: "Share your live location",
    body: "If you can, share your live location with a family member or friend right now. Many phones have a one-tap option for this in the maps or messaging app.",
  },
  {
    id: "describe-surroundings",
    category: "share",
    label: "Describe surroundings",
    body: "Can you describe what's around you right now? Street name, business signs, landmarks — anything helps us pinpoint your exact location.",
  },
  {
    id: "stay-in-car",
    category: "act",
    label: "Stay in the vehicle",
    body: "Unless you feel directly threatened, please stay inside the vehicle. It's usually safer than stepping out in an unfamiliar area. We're tracking you.",
  },
  {
    id: "call-police",
    category: "act",
    label: "Call 119 if unsafe",
    body: "If you feel unsafe at any moment, call 119 (Jamaica Police) immediately. Don't wait for us — your safety comes first. We'll keep tracking and assisting.",
  },
  {
    id: "find-public-place",
    category: "act",
    label: "Head to a public place",
    body: "If you're able to leave the vehicle, head to the nearest well-lit public place — a gas station, a hotel lobby, a hospital — and wait there. Stay on the line.",
  },
];
