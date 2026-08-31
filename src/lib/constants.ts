export type RecordCategory =
  | "consultation"
  | "prescription"
  | "lab_report"
  | "scan_report"
  | "medical_history"
  | "allergy";

export const RECORD_CATEGORIES: { value: RecordCategory; label: string }[] = [
  { value: "consultation", label: "Consultation" },
  { value: "prescription", label: "Prescription" },
  { value: "lab_report", label: "Lab Report" },
  { value: "scan_report", label: "Scan Report" },
  { value: "medical_history", label: "Medical History" },
  { value: "allergy", label: "Allergy" },
];

export const CONSENT_CATEGORIES = [
  ...RECORD_CATEGORIES,
  { value: "medicines" as const, label: "Medicines" },
];

export const categoryLabel = (value: string) =>
  CONSENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;

export const AI_DISCLAIMER =
  "This AI provides general health information and does not replace professional medical advice.";
