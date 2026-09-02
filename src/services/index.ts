/**
 * ELIXIR service layer.
 *
 * Every feature talks to the backend through these services, never directly.
 * Real provider integrations (hospital HIS, ABDM/ABHA, maps, pharmacy stock)
 * can replace the demo-data reads here without touching the UI.
 */
export * as AuthService from "./auth";
export * as PatientService from "./user";
export * as MedicalRecordService from "./records";
export * as DirectoryService from "./directory";
export * as BookingService from "./bookings";
export * as ReminderService from "./reminders";
export * as ConsentService from "./consent";
export * as AuditService from "./audit";
export * as EmergencyService from "./emergency";
export * as NotificationService from "./notifications";
