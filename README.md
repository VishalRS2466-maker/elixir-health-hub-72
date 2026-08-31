# ELIXIR — Healthcare Management Platform

ELIXIR is a patient-centric healthcare app: one universal (ABHA-compatible) patient ID,
a timeline of medical records, a controlled emergency card, e-hospital bookings, medicine
reminders, a first aid library, an AI explainer, and full consent + audit trails.

## Stack

React 19 · TypeScript · Tailwind CSS v4 · TanStack Start / Router / Query · Lovable Cloud
(Postgres, Auth, Row Level Security).

## Roles

| Role | Sees |
| --- | --- |
| Patient | Own records, emergency card, bookings, medicines, consent, activity |
| Doctor | Own appointments; patient records **only** after explicit, time-limited consent |
| Admin | Users, provider directory and audit metadata — never medical records |

## Getting started

1. Open `/auth` and create an account. Pick a role during sign-up.
2. New patient accounts are seeded with realistic demo records, reminders and bookings so
   every screen is immediately usable.
3. To try the consent flow: sign up a doctor account, look up a patient's Universal ID
   (shown on the patient's Home and Profile pages), send a request, then approve it from
   the patient account under **Consent**.

## Privacy model

- Every table has Row Level Security; patients own their rows.
- Doctors read patient records only through an approved, non-expired consent request, and
  only within the approved categories.
- Consent decisions, record views, bookings and emergency shares are written to the audit
  log, which patients can read on **Access activity**.

## Prototype boundaries

- ABHA linking is compatible-by-design but not connected to the live ABDM network.
- Provider directory, distances and slots are demo data behind service seams
  (`src/services/directory.ts`, `bookings.ts`) that a real registry/scheduling API replaces.
- Reminders are confirmed by the user; browser notifications are local only.
- The AI assistant explains and navigates — it never diagnoses or prescribes.
