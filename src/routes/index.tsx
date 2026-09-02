import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  Building2,
  Compass,
  FileHeart,
  History,
  IdCard,
  KeyRound,
  Lock,
  Siren,
  UserCheck,
  UserPlus,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroIllustration from "@/assets/hero-healthcare.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ELIXIR — Your Health, Connected." },
      {
        name: "description",
        content:
          "ELIXIR is a secure healthcare platform to manage your health profile, medical records, appointments and healthcare services in one place.",
      },
      { property: "og:title", content: "ELIXIR — Your Health, Connected." },
      {
        property: "og:description",
        content:
          "Manage your healthcare journey, medical records, appointments and health services in one secure platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: IdCard,
    title: "Connected Health Identity",
    text: "Access your healthcare profile from one place.",
    tone: "bg-brand-soft text-primary",
  },
  {
    icon: FileHeart,
    title: "Medical Records",
    text: "Keep your important health information organized.",
    tone: "bg-sage-soft text-foreground",
  },
  {
    icon: Building2,
    title: "E-Hospital",
    text: "Find doctors, tests, scans and healthcare services.",
    tone: "bg-warm-soft text-foreground",
  },
  {
    icon: Bot,
    title: "AI Healthcare Assistant",
    text: "Get help understanding healthcare information.",
    tone: "bg-blush-soft text-foreground",
  },
  {
    icon: Compass,
    title: "Healthcare Discovery",
    text: "Find nearby hospitals, pharmacies and test centres.",
    tone: "bg-brand-soft text-primary",
  },
  {
    icon: Siren,
    title: "Emergency Support",
    text: "Access emergency assistance and essential medical information.",
    tone: "bg-emergency-soft text-emergency",
  },
];

const STEPS = [
  {
    icon: UserPlus,
    title: "Create Your Account",
    text: "Create your secure healthcare profile.",
  },
  {
    icon: HeartHandshake,
    title: "Manage Your Health",
    text: "Organize medical information and healthcare services.",
  },
  {
    icon: Bot,
    title: "Stay Connected",
    text: "Access healthcare assistance whenever you need it.",
  },
];

const FLOW = [
  "User",
  "Health Profile",
  "Medical Records",
  "Healthcare Services",
  "AI Assistance",
  "Emergency Support",
];

const SECURITY = [
  { icon: KeyRound, title: "Secure authentication", text: "Accounts are protected by email and password sign-in." },
  { icon: UserCheck, title: "Consent-based access", text: "Doctors see records only after you approve access." },
  { icon: ShieldCheck, title: "Role-based access", text: "Users, doctors and admins each see only what they need." },
  { icon: Lock, title: "Protected information", text: "Health information is stored behind access rules." },
  { icon: History, title: "Access history", text: "See a record of who viewed your information and when." },
];

const NAV = [
  { href: "#about", label: "About" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
];

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-[0.18em] ${className}`}>ELIXIR</span>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <Wordmark className="text-lg" />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="transition-colors hover:text-foreground">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section id="about" className="mx-auto max-w-6xl px-5 pb-16 pt-12 md:pt-20">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="inline-flex rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold">
                Secure healthcare platform
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
                Your Health, Connected.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
                Manage your healthcare journey, medical records, appointments, and health services in
                one secure platform.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 rounded-2xl px-7 text-base">
                  <Link to="/register">Get Started</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-2xl px-7 text-base"
                >
                  <Link to="/login">Login</Link>
                </Button>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                Prototype for demonstration. Not connected to live hospital or emergency services.
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-6 -z-10 rounded-[3rem] bg-brand-soft" />
              <img
                src={heroIllustration}
                alt="Illustration of a user, doctor, hospital, medical record and AI assistant connected together"
                width={1024}
                height={1024}
                className="mx-auto w-full max-w-md"
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-card/60 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Everything You Need in One Place
              </h2>
              <p className="mt-3 text-muted-foreground">
                A simple set of tools that keep your healthcare information and services together.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft transition-shadow hover:shadow-lift"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${f.tone}`}
                  >
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How It Works</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-3xl border border-border/60 bg-card p-7 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-primary">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why this platform */}
        <section className="bg-brand-soft py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                One Platform. A Connected Healthcare Journey.
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground">
                Instead of scattered files, apps and clinics, everything follows one health profile —
                from your records to the services and support you use.
              </p>
            </div>
            <ol className="space-y-2">
              {FLOW.map((step, i) => (
                <li key={step}>
                  <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-3 shadow-soft">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="font-medium">{step}</span>
                  </div>
                  {i < FLOW.length - 1 && (
                    <div className="ml-[2.15rem] h-3 w-px bg-primary/40" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Security */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Designed with privacy and consent in mind.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY.map((s) => (
              <div key={s.title} className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-soft">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-[2rem] bg-card p-10 text-center shadow-lift">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Start managing your healthcare journey today.
            </h2>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-2xl px-7">
                <Link to="/register">Create Account</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-2xl px-7">
                <Link to="/login">Login</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <HeartHandshake className="h-4 w-4" />
              </span>
              <Wordmark className="text-base" />
            </Link>
            <nav className="flex flex-wrap gap-5 text-sm text-muted-foreground">
              <a href="#about" className="hover:text-foreground">About</a>
              <a href="#features" className="hover:text-foreground">Features</a>
              <a href="#privacy" className="hover:text-foreground">Privacy</a>
              <a href="#terms" className="hover:text-foreground">Terms</a>
              <a href="#contact" className="hover:text-foreground">Contact</a>
            </nav>
          </div>
          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            Healthcare information provided by this platform is for informational purposes and does
            not replace professional medical advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
