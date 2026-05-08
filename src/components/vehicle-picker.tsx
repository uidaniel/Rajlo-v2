"use client";

import { useMemo } from "react";
import { Icon } from "./icons";
import {
  VEHICLE_BRANDS,
  VEHICLE_COLORS,
  VEHICLE_TYPES,
  modelsForBrand,
  vehicleYearOptions,
} from "@/lib/vehicle-catalog";

/**
 * Cascading vehicle picker — type → brand → model → year → colour.
 *
 * The catalog drives every dropdown's options, so a driver can only
 * pick combinations that exist in our list. Changing a parent
 * field auto-clears its dependents (e.g. switching brand resets
 * model) so the form can never end up with a brand/model mismatch.
 *
 * Used by:
 *   - Driver onboarding wizard (initial vehicle entry)
 *   - Driver vehicle-change request flow (registering a new car)
 *
 * Controlled component — caller owns the state. Pass current values
 * + setters; we render the UI and the cascading-clear logic.
 */

export type VehicleSpec = {
  type: string;
  brand: string;
  model: string;
  year: string; // string in form state; convert to number on submit
  color: string;
};

export const EMPTY_VEHICLE_SPEC: VehicleSpec = {
  type: "",
  brand: "",
  model: "",
  year: "",
  color: "",
};

export function VehiclePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: VehicleSpec;
  onChange: (next: VehicleSpec) => void;
  disabled?: boolean;
}) {
  const models = useMemo(
    () => modelsForBrand(value.brand || null),
    [value.brand],
  );
  const years = useMemo(() => vehicleYearOptions(), []);

  // Each setter folds in the cascading-clear: changing the brand
  // wipes the model (it's no longer guaranteed to exist under the
  // new brand), changing the type doesn't wipe anything since
  // type is informational metadata not a constraint.
  const setType = (type: string) => onChange({ ...value, type });
  const setBrand = (brand: string) =>
    onChange({ ...value, brand, model: "" });
  const setModel = (model: string) => onChange({ ...value, model });
  const setYear = (year: string) => onChange({ ...value, year });
  const setColor = (color: string) => onChange({ ...value, color });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        label="Type"
        value={value.type}
        onChange={setType}
        disabled={disabled}
        placeholder="Pick a body type"
        options={VEHICLE_TYPES.map((t) => ({ value: t, label: t }))}
      />
      <SelectField
        label="Brand"
        value={value.brand}
        onChange={setBrand}
        disabled={disabled}
        placeholder="Pick a brand"
        options={VEHICLE_BRANDS.map((b) => ({ value: b, label: b }))}
      />
      <SelectField
        label="Model"
        value={value.model}
        onChange={setModel}
        disabled={disabled || !value.brand}
        placeholder={value.brand ? "Pick a model" : "Choose brand first"}
        options={models.map((m) => ({ value: m, label: m }))}
      />
      <SelectField
        label="Year"
        value={value.year}
        onChange={setYear}
        disabled={disabled}
        placeholder="Pick a year"
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
      />
      <div className="sm:col-span-2">
        {/* Colour picker — visual swatches matching the catalog
           values. A SelectField would work too but the swatches
           are quicker to scan and match the existing colour-pill
           style on the live trip card. */}
        <p className="text-xs font-semibold text-muted">
          Colour
          <span className="ml-0.5 text-rajlo-red">*</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {VEHICLE_COLORS.map((c) => {
            const active = value.color === c;
            return (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => setColor(c)}
                className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? "border-rajlo-red bg-rajlo-red text-white"
                    : "border-line bg-surface text-muted hover:border-rajlo-red/40 hover:text-foreground"
                }`}
              >
                <span
                  className="grid h-4 w-4 place-items-center rounded-full border border-line"
                  style={{ backgroundColor: COLOR_HEX[c] }}
                  aria-hidden
                />
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Internal subcomponents ─────────── */

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted">
        {label}
        <span className="ml-0.5 text-rajlo-red">*</span>
      </span>
      <div className="relative mt-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required
          className="w-full appearance-none rounded-xl border border-line bg-surface px-4 py-3 pr-10 text-sm outline-none transition-all focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-60"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-right"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted"
        />
      </div>
    </label>
  );
}

const COLOR_HEX: Record<string, string> = {
  White: "#ffffff",
  Silver: "#c8c9cc",
  Grey: "#6b7077",
  Black: "#1a1a1a",
  Red: "#f10100",
  Blue: "#1d4ed8",
  Green: "#15803d",
  Gold: "#d4af37",
  Beige: "#d6c8a8",
  Brown: "#7c4f1d",
  Maroon: "#800000",
  Orange: "#f97316",
  Yellow: "#facc15",
  Navy: "#1e3a8a",
};
