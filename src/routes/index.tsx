import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  Building2,
  Compass,
  FileHeart,
  HeartPulse,
  IdCard,
  Pill,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ELIXIR — One patient. One connected health profile." },
      {
        name: "description",
        content:
          "ELIXIR brings your patient identity, medical records, consent, healthcare bookings, emergency support and an AI health assistant into one secure place.",
      },
      { property: "og:title", content: "ELIXIR — One connected health profile" },
      {
        property: "og:description",
        content:
          "Universal patient ID, medical record timeline, consent-controlled doctor access, emergency card, SOS and an AI healthcare assistant.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: IdCard, title: "Universal Patient ID", text: "An ABHA-compatible identity that ties your health data together." },
  { icon: FileHeart, title: "Medical records timeline", text: "Consultations, prescriptions, lab and scan reports in one place." },
  { icon: ShieldCheck, title: "Consent you control", text: "Doctors see only the records you approve, for as long as you allow." },
  { icon: Siren, title: "Emergency SOS & card", text: "Quick emergency actions and a limited medical card for responders." },
  { icon: Building2, title: "E-Hospital", text: "Book doctors, lab tests and scans from demo healthcare providers." },
  { icon: Bot, title: "AI Healthcare Assistant", text: "Plain-language explanations of your reports and prescriptions." },
  { icon: Pill, title: "Medicine reminders", text: "Track doses with taken, skipped and snooze options." },
  { icon: Compass, title: "Explore nearby care", text: "Hospitals, pharmacies and test centres around you." },
  { icon: Activity, title: "Audit log", text: "See exactly who accessed which record and when." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">ELIXIR</span>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-12 pt-6 md:pt-14">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="inline-flex rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold">
              ABHA-compatible prototype
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
              One patient. One connected health profile.
            </h1>
            <p className="mt-4 max-w-lg text-base text-muted-foreground">
              Healthcare data lives in scattered files, clinics and apps. ELIXIR puts your identity,
              records, consent, bookings and emergency information in a single secure place — with an
              AI assistant that explains it in plain language.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-2xl px-6">
                <Link to="/auth">Create your health profile</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-2xl px-6">
                <Link to="/auth" search={{ mode: "signin" }}>
                  I already have an account
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Prototype for demonstration. Uses demo healthcare provider data and is not connected to
              live ABDM, hospital or emergency services.
            </p>
          </div>

          <div className="card-soft space-y-4 p-5">
            <div className="rounded-2xl bg-brand-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Universal Patient ID
              </p>
              <p className="mt-1 font-display text-2xl">ELX-8F4C21A9B3</p>
              <p className="text-sm text-muted-foreground">ABHA: link when available</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-emergency-soft p-4">
              <Siren className="h-6 w-6 text-emergency" />
              <div>
                <p className="font-semibold">Emergency SOS</p>
                <p className="text-xs text-muted-foreground">Get emergency assistance</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-warm-soft p-4">
              <Pill className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">Cetirizine 10mg · 9:00 PM</p>
                <p className="text-xs text-muted-foreground">Next medicine reminder</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-2xl font-semibold">Everything a patient needs, connected</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-soft p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card px-5 py-8 text-center text-sm text-muted-foreground">
        ELIXIR · Patient-owned health data, consent-based access, auditable at every step.
      </footer>
    </div>
  );
}
