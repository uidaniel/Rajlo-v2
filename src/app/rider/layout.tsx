import { PortalLayout } from "@/components/portal-layout";
import { SessionGuard } from "@/components/session-guard";
import { PreferencesProvider } from "@/components/preferences-provider";
import { LegalConsentGate } from "@/components/legal-consent-gate";
import { DeviceFingerprintBeacon } from "@/components/device-fingerprint-beacon";
import { riderNav } from "@/lib/mock-data";

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout
      title="Rider Portal"
      subtitle="Book rides, track trips, and manage safety settings."
      nav={riderNav}
    >
      <SessionGuard />
      <PreferencesProvider />
      {/* Blocks the rider with a consent modal if they owe acceptance
         of any new or updated policy. API routes enforce the same
         gate server-side. */}
      <LegalConsentGate />
      {/* Submits this device's fraud fingerprint once per session. */}
      <DeviceFingerprintBeacon />
      {children}
    </PortalLayout>
  );
}