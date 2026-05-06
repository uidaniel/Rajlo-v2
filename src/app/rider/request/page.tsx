"use client";

import { useState } from "react";
import Link from "next/link";
import { LocationInput, SeatSelector } from "@/components/location-inputs";
import { RideRequestCard } from "@/components/ride-request-card";

export default function RiderRequestPage() {
  const [step, setStep] = useState<"location" | "destination" | "confirm">("location");
  const [currentLocation, setCurrentLocation] = useState("Cross Roads, Kingston");
  const [destination, setDestination] = useState("");
  const [seats, setSeats] = useState(1);
  const [rideRequested, setRideRequested] = useState(false);

  const handleUseGeo = () => {
    setCurrentLocation("📍 Your Location (Auto-detected)");
  };

  const handleRequestRide = () => {
    if (destination && seats > 0) {
      setRideRequested(true);
    }
  };

  if (rideRequested) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-line bg-primary/5 p-6 text-center">
          <svg className="h-12 w-12 text-primary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold mt-2">Finding Closest Driver</h2>
          <p className="text-sm text-muted mt-1">
            Notifications sent. We're matching you with the best available driver.
          </p>
        </div>

        <RideRequestCard
          ride={{
            id: "ride-001",
            from: currentLocation.replace("📍 Your Location (Auto-detected)", "Your Location"),
            to: destination,
            eta: "3-5 mins",
            price: "JMD 520",
            seats: seats,
            status: "searching",
          }}
        />

        <div className="grid gap-2 md:grid-cols-2">
          <button
            onClick={() => {
              setRideRequested(false);
              setDestination("");
              setCurrentLocation("Cross Roads, Kingston");
              setSeats(1);
              setStep("location");
            }}
            className="rounded-lg border border-line py-3 font-medium text-sm hover:bg-surface-soft transition-colors"
          >
            Cancel Request
          </button>
          <Link
            href="/rider/live-trip"
            className="rounded-lg bg-primary py-3 font-medium text-sm text-white hover:opacity-90 transition-opacity text-center"
          >
            Driver Accepted - View Trip
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:max-w-2xl">
      {/* Progress Indicator */}
      <div className="flex gap-3">
        {(["location", "destination", "confirm"] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              step === s || (step === "destination" && (s === "location" || s === "destination")) || (step === "confirm" && s !== "confirm")
                ? "bg-primary"
                : "bg-line"
            }`}
          />
        ))}
      </div>

      {/* Step: Pick Location */}
      {step === "location" && (
        <div className="space-y-6 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">Where are you?</h1>
            <p className="text-sm text-muted mt-2">We'll use this as your pickup location.</p>
          </div>

          <LocationInput
            label="Current Location"
            placeholder="Enter pickup location"
            value={currentLocation}
            onChange={setCurrentLocation}
            onUseGeo={handleUseGeo}
          />

          <button
            onClick={() => setStep("destination")}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Confirm Location
          </button>
        </div>
      )}

      {/* Step: Enter Destination */}
      {step === "destination" && (
        <div className="space-y-6 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">Where to?</h1>
            <p className="text-sm text-muted mt-2">
              From: <span className="font-medium">{currentLocation.replace("📍 Your Location (Auto-detected)", "Your Location")}</span>
            </p>
          </div>

          <LocationInput
            label="Destination"
            placeholder="Enter destination"
            value={destination}
            onChange={setDestination}
          />

          <SeatSelector value={seats} onChange={setSeats} />

          <div className="rounded-lg bg-surface-soft p-4 border border-line">
            <p className="text-xs text-muted mb-3 font-medium">ESTIMATED FARE</p>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-primary">JMD 520</span>
              <span className="text-sm text-muted">Approx. 8-12 mins</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("location")}
              className="flex-1 rounded-lg border border-line py-3 font-medium text-sm hover:bg-surface-soft transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep("confirm")}
              disabled={!destination}
              className="flex-1 rounded-lg bg-primary py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm & Request */}
      {step === "confirm" && (
        <div className="space-y-6 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">Review Your Ride</h1>
            <p className="text-sm text-muted mt-2">Everything look good?</p>
          </div>

          <div className="space-y-4 rounded-xl border border-line p-4 bg-surface-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted">Pickup</p>
                <p className="font-medium truncate">{currentLocation.replace("📍 Your Location (Auto-detected)", "Your Location")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-primary text-sm font-semibold border border-primary">
                B
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted">Dropoff</p>
                <p className="font-medium truncate">{destination}</p>
              </div>
            </div>

            <div className="border-t border-line pt-3 mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Seats:</span>
                <span className="font-medium">{seats} passenger{seats !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted">Est. Fare:</span>
                <span className="font-semibold text-primary text-lg">JMD 520</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("destination")}
              className="flex-1 rounded-lg border border-line py-3 font-medium text-sm hover:bg-surface-soft transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleRequestRide}
              className="flex-1 rounded-lg bg-primary py-3 font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Request Ride
            </button>
          </div>

          <p className="text-xs text-muted text-center">
            By requesting, you agree to our{" "}
            <Link href="/legal/terms" className="font-medium text-primary hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
