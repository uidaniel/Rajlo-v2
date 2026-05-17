"use client";

import { useEffect } from "react";
import { computeDeviceFingerprint } from "@/lib/device-fingerprint";

/**
 * Computes this device's fingerprint once on mount and submits it to
 * /api/device/fingerprint. Mounted in the rider and driver portal
 * shells so every authenticated session contributes a fingerprint to
 * the multi-account / fraud-ring detection signal. Renders nothing.
 */
export function DeviceFingerprintBeacon() {
  useEffect(() => {
    let cancelled = false;
    computeDeviceFingerprint()
      .then((fp) => {
        if (cancelled || !fp) return;
        return fetch("/api/device/fingerprint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fp),
        });
      })
      .catch(() => {
        /* best-effort — a missed fingerprint is not worth surfacing */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
