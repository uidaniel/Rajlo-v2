"use client";

/**
 * Disabled — used to render a "LIVE · Just now" pill on every live
 * surface, but we now refresh silently so the user never thinks
 * about freshness. Kept as a no-op component so the 17 call sites
 * across the app don't have to be edited; deleting them later is
 * fine but cosmetic.
 *
 * If you ever want it back, the original implementation lives in
 * git history.
 */

type Variant = "default" | "dark";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function LiveIndicator(_props: LiveIndicatorProps): null {
  return null;
}

type LiveIndicatorProps = {
  lastUpdated: Date | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  variant?: Variant;
};
