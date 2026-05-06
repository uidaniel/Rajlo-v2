"use client";

import { useState } from "react";

type LocationInputProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onUseGeo?: () => void;
};

export function LocationInput({
  label,
  placeholder,
  value,
  onChange,
  onUseGeo,
}: LocationInputProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
        {onUseGeo && (
          <button
            onClick={onUseGeo}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-surface-soft hover:text-primary"
            title="Use current location"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

type SeatSelectorProps = {
  value: number;
  onChange: (value: number) => void;
};

export function SeatSelector({ value, onChange }: SeatSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Seats Needed</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((seat) => (
          <button
            key={seat}
            onClick={() => onChange(seat)}
            className={`flex-1 rounded-lg py-2.5 font-medium transition-colors ${
              value === seat
                ? "bg-primary text-white"
                : "border border-line bg-surface-soft hover:bg-surface hover:border-primary"
            }`}
          >
            {seat}
          </button>
        ))}
      </div>
    </div>
  );
}
