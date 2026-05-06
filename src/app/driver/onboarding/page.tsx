"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  { id: 1, title: "Personal Info", subtitle: "TRN, NIS, and contact details" },
  { id: 2, title: "Licence & Badge", subtitle: "Driver's licence and TA Driver Badge" },
  { id: 3, title: "Vehicle Details", subtitle: "Red plate registration and COF" },
  { id: 4, title: "TA Franchise", subtitle: "TA Franchise Certificate" },
  { id: 5, title: "Insurance", subtitle: "PPV comprehensive insurance" },
  { id: 6, title: "Police Record & Selfie", subtitle: "Good conduct certificate and identity photo" },
  { id: 7, title: "Review & Submit", subtitle: "Confirm and send for TA verification" },
];

type UploadField = {
  id: string;
  label: string;
  hint: string;
  required: boolean;
};

type FileState = Record<string, File | null>;

function FileUploadField({
  field,
  files,
  onChange,
}: {
  field: UploadField;
  files: FileState;
  onChange: (id: string, file: File | null) => void;
}) {
  const file = files[field.id];
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {field.label}
        {field.required && <span style={{ color: "#e74c3c" }}> *</span>}
      </label>
      <p className="text-xs" style={{ color: "var(--muted)" }}>{field.hint}</p>
      <label
        className="flex items-center gap-3 rounded-xl border-2 border-dashed cursor-pointer px-4 py-3 transition-colors"
        style={{
          borderColor: file ? "var(--primary)" : "var(--line)",
          background: file ? "var(--primary-soft)" : "var(--surface-soft)",
        }}
      >
        <span style={{ color: file ? "var(--primary)" : "var(--muted)", fontSize: 20 }}>
          {file ? "✅" : "📎"}
        </span>
        <span className="text-sm truncate" style={{ color: file ? "var(--primary)" : "var(--muted)" }}>
          {file ? file.name : "Click to upload file (PDF, JPG, PNG)"}
        </span>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => onChange(field.id, e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

function TextInput({
  label,
  placeholder,
  value,
  onChange,
  hint,
  required,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {label}
        {required && <span style={{ color: "#e74c3c" }}> *</span>}
      </label>
      {hint && <p className="text-xs" style={{ color: "var(--muted)" }}>{hint}</p>}
      <input
        className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2"
        style={{
          borderColor: "var(--line)",
          background: "var(--surface-soft)",
          color: "var(--foreground)",
        }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function DriverOnboardingPage() {
  const router = useRouter();
  const [driverId] = useState("DRV-1031");
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<FileState>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    trn: "",
    nis: "",
    licenceNumber: "",
    licenceExpiry: "",
    badgeNumber: "",
    plateNumber: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    franchiseNumber: "",
    franchiseExpiry: "",
  });

  const handleFile = (id: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [id]: file }));
  };

  const setField = (key: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const submitOnboarding = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const uploadedDocs = Object.entries(files)
        .filter((entry) => Boolean(entry[1]))
        .map(([id, file]) => ({ id, fileName: file?.name ?? "unknown" }));

      const response = await fetch("/api/driver/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driverId,
          form,
          uploadedDocs,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit onboarding");
      }

      setStep(STEPS.length + 1);
    } catch {
      setSubmitError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="First Name" placeholder="e.g. Andre" value={form.firstName} onChange={setField("firstName")} required />
              <TextInput label="Last Name" placeholder="e.g. Thompson" value={form.lastName} onChange={setField("lastName")} required />
            </div>
            <TextInput label="Mobile Number" placeholder="e.g. 876-XXX-XXXX" value={form.phone} onChange={setField("phone")} hint="Must match the number on your TA Badge application" required />
            <TextInput label="Email Address" placeholder="e.g. driver@example.com" value={form.email} onChange={setField("email")} required />
            <TextInput label="TRN (Taxpayer Registration Number)" placeholder="9-digit TRN" value={form.trn} onChange={setField("trn")} hint="Required for all TA fee processing" required />
            <TextInput label="NIS Number" placeholder="NIS number" value={form.nis} onChange={setField("nis")} hint="National Insurance Scheme registration number" required />
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <TextInput label="Driver's Licence Number" placeholder="e.g. DL-123456" value={form.licenceNumber} onChange={setField("licenceNumber")} hint="Must be a valid Jamaican licence class that permits PPV / taxi operation" required />
            <TextInput label="Licence Expiry Date" placeholder="YYYY-MM-DD" value={form.licenceExpiry} onChange={setField("licenceExpiry")} required />
            <FileUploadField
              field={{ id: "drivers_licence", label: "Driver's Licence (front + back)", hint: "Upload a clear photo or scanned copy of both sides", required: true }}
              files={files}
              onChange={handleFile}
            />
            <TextInput label="TA Driver Badge Number" placeholder="Badge number from Transport Authority" value={form.badgeNumber} onChange={setField("badgeNumber")} hint="The annual badge issued by the TA — must be displayed visibly in vehicle" required />
            <FileUploadField
              field={{ id: "driver_badge", label: "TA Driver Badge (front)", hint: "Must be current and in-date. Renewed annually at the TA.", required: true }}
              files={files}
              onChange={handleFile}
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div
              className="rounded-xl px-4 py-3 text-sm border"
              style={{ background: "var(--primary-soft)", borderColor: "var(--primary)", color: "var(--primary)" }}
            >
              <strong>Red Plate Only</strong> — RAJLO is exclusively for vehicles carrying official Jamaican red (Public Passenger Vehicle) plates. Private or commercial white-plate vehicles are not eligible.
            </div>
            <TextInput label="Red Plate Number" placeholder="e.g. 5812 GK" value={form.plateNumber} onChange={setField("plateNumber")} hint="Must be a registered PPV red plate as shown on your TA docs" required />
            <FileUploadField
              field={{ id: "red_plate_reg", label: "Vehicle Registration (PPV Red Plate)", hint: "Official registration document confirming red plate status", required: true }}
              files={files}
              onChange={handleFile}
            />
            <TextInput label="Vehicle Make" placeholder="e.g. Toyota" value={form.vehicleMake} onChange={setField("vehicleMake")} required />
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Vehicle Model" placeholder="e.g. Axio" value={form.vehicleModel} onChange={setField("vehicleModel")} required />
              <TextInput label="Vehicle Year" placeholder="e.g. 2019" value={form.vehicleYear} onChange={setField("vehicleYear")} required />
            </div>
            <FileUploadField
              field={{ id: "cof", label: "Certificate of Fitness (COF)", hint: "Annual vehicle fitness inspection pass from the TA. Book at transportauthority.gov.jm or call 876-926-9937.", required: true }}
              files={files}
              onChange={handleFile}
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              The TA Franchise Certificate grants the right to operate on a specific route or zone. It is renewed annually and is the primary authorization for PPV operation in Jamaica.
            </p>
            <TextInput label="Franchise Certificate Number" placeholder="e.g. FC-2025-XXXXXX" value={form.franchiseNumber} onChange={setField("franchiseNumber")} required />
            <TextInput label="Franchise Expiry Date" placeholder="YYYY-MM-DD" value={form.franchiseExpiry} onChange={setField("franchiseExpiry")} hint="Annual renewal — we'll remind you 60 days before expiry" required />
            <FileUploadField
              field={{ id: "franchise_cert", label: "TA Franchise Certificate", hint: "Upload the certificate as issued by the Jamaica Transport Authority", required: true }}
              files={files}
              onChange={handleFile}
            />
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Your insurance must explicitly cover Public Passenger Vehicle (PPV) / commercial use. Standard private motor vehicle insurance is not acceptable.
            </p>
            <FileUploadField
              field={{ id: "insurance", label: "Comprehensive PPV Insurance Certificate", hint: "Upload your current insurance policy or cover note showing PPV/commercial coverage", required: true }}
              files={files}
              onChange={handleFile}
            />
          </div>
        );
      case 6:
        return (
          <div className="space-y-5">
            <FileUploadField
              field={{ id: "police_record", label: "Police Record / Good Conduct Certificate", hint: "Obtained from any police station in Jamaica. Required at first application; periodically thereafter.", required: true }}
              files={files}
              onChange={handleFile}
            />
            <FileUploadField
              field={{ id: "selfie", label: "Live Identity Selfie", hint: "Clear photo of your face against a plain background. Used to match against your licence and TA badge. JPG or PNG only.", required: true }}
              files={files}
              onChange={handleFile}
            />
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Review your submission summary below. Once submitted, our operations team will verify your documents against Jamaica Transport Authority records. This typically takes 1–2 business days.
            </p>
            <div className="space-y-2">
              {[
                { label: "Full Name", value: `${form.firstName} ${form.lastName}`.trim() || "—" },
                { label: "Mobile", value: form.phone || "—" },
                { label: "TRN", value: form.trn || "—" },
                { label: "NIS", value: form.nis || "—" },
                { label: "Driver's Licence", value: form.licenceNumber || "—" },
                { label: "TA Badge Number", value: form.badgeNumber || "—" },
                { label: "Red Plate", value: form.plateNumber || "—" },
                { label: "Vehicle", value: form.vehicleMake && form.vehicleModel ? `${form.vehicleYear} ${form.vehicleMake} ${form.vehicleModel}` : "—" },
                { label: "Franchise Cert", value: form.franchiseNumber || "—" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center rounded-lg px-3 py-2" style={{ background: "var(--surface-soft)" }}>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>{row.label}</span>
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border px-4 py-3 text-sm space-y-1" style={{ borderColor: "var(--line)", background: "var(--surface-soft)" }}>
              <p className="font-medium" style={{ color: "var(--foreground)" }}>Documents ready</p>
              {Object.entries(files).map(([key, file]) =>
                file ? (
                  <p key={key} className="text-xs" style={{ color: "var(--muted)" }}>
                    ✅ {file.name}
                  </p>
                ) : null
              )}
              {Object.keys(files).length === 0 && (
                <p className="text-xs" style={{ color: "#e74c3c" }}>⚠️ No documents uploaded yet</p>
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              By submitting, you confirm that all information and documents are authentic. Providing false information will result in permanent account suspension and may be reported to the Jamaica Transport Authority.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  if (step > STEPS.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-4">
        <div style={{ fontSize: 48 }}>🎉</div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Application Submitted!</h1>
        <p className="text-sm max-w-sm" style={{ color: "var(--muted)" }}>
          Your documents are under review by our operations team against Jamaica Transport Authority records. You will be notified by SMS and email within 1–2 business days.
        </p>
        <button
          onClick={() => router.push("/driver")}
          className="mt-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
          style={{ background: "var(--primary)" }}
        >
          Back to Driver Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-3 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push("/driver")}
            className="text-sm"
            style={{ color: "var(--muted)" }}
          >
            ✕
          </button>
          <div className="flex-1">
            <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Step {step} of {STEPS.length}
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {STEPS[step - 1].title}
            </p>
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {STEPS[step - 1].subtitle}
          </span>
        </div>

        {/* Progress bar */}
        <div className="max-w-lg mx-auto mt-2 h-1 rounded-full" style={{ background: "var(--line)" }}>
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: `${(step / STEPS.length) * 100}%`, background: "var(--primary)" }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id < step && setStep(s.id)}
              className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: s.id === step ? "var(--primary)" : s.id < step ? "var(--primary-soft)" : "var(--surface-soft)",
                color: s.id === step ? "#fff" : s.id < step ? "var(--primary)" : "var(--muted)",
                cursor: s.id < step ? "pointer" : "default",
              }}
            >
              {s.id < step ? "✓ " : ""}{s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
        {submitError && (
          <div className="mb-3 rounded-xl border px-4 py-2 text-xs" style={{ borderColor: "#c0392b", color: "#c0392b", background: "#fdecea" }}>
            {submitError}
          </div>
        )}
        {renderStep()}
      </div>

      {/* Sticky footer nav */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 1 && (
            <button
              onClick={back}
              className="flex-1 rounded-full border py-3 text-sm font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
            >
              Back
            </button>
          )}
          <button
            onClick={step === STEPS.length ? submitOnboarding : next}
            disabled={submitting}
            className="flex-1 rounded-full py-3 text-sm font-semibold text-white"
            style={{ background: submitting ? "#9ca3af" : "var(--primary)" }}
          >
            {step === STEPS.length ? (submitting ? "Submitting..." : "Submit Application") : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
