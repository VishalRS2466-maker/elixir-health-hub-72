import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Stethoscope } from "lucide-react";
import { doctorOverview } from "@/lib/doctor.functions";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/doctor/profile")({
  head: () => ({
    meta: [
      { title: "Doctor profile · ELIXIR" },
      { name: "description", content: "Your clinician profile and verified role on ELIXIR." },
      { property: "og:title", content: "Doctor profile · ELIXIR" },
      { property: "og:description", content: "Clinician account details on ELIXIR." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DoctorProfilePage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function DoctorProfilePage() {
  const { profile, user } = useSession();
  const overviewFn = useServerFn(doctorOverview);
  const overview = useQuery({ queryKey: ["doctor-overview"], queryFn: () => overviewFn({}) });
  const doctor = overview.data?.doctor ?? null;
  const name = doctor?.full_name ?? profile?.full_name ?? "Doctor";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="card-soft flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-primary">
          <Stethoscope className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Dr. {name.replace(/^Dr\.?\s*/i, "")}</h1>
          <p className="text-sm text-muted-foreground">Role: Doctor</p>
        </div>
      </header>

      <section className="card-soft p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Clinician details
        </h2>
        <Row label="Specialty" value={doctor?.specialty ?? "—"} />
        <Row label="Email" value={profile?.email ?? user?.email ?? "—"} />
        <Row label="Phone" value={profile?.phone ?? "—"} />
        <Row label="Verified role" value="Doctor" />
      </section>
    </div>
  );
}
