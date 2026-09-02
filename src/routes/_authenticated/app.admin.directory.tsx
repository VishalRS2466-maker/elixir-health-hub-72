import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, FlaskConical, Pill, Stethoscope } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import * as DirectoryService from "@/services/directory";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/app/admin/directory")({
  head: () => ({
    meta: [
      { title: "Manage directory · ELIXIR" },
      { name: "description", content: "Hospitals, doctors, laboratories and pharmacies listed on ELIXIR." },
      { property: "og:title", content: "Manage directory · ELIXIR" },
      { property: "og:description", content: "Review the healthcare providers available to users." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DirectoryAdmin,
});

function DirectoryAdmin() {
  const { role } = useSession();
  const enabled = role === "admin";

  const hospitals = useQuery({ queryKey: ["hospitals"], queryFn: DirectoryService.listHospitals, enabled });
  const doctors = useQuery({ queryKey: ["doctors"], queryFn: DirectoryService.listDoctors, enabled });
  const labs = useQuery({ queryKey: ["laboratories"], queryFn: DirectoryService.listLaboratories, enabled });
  const pharmacies = useQuery({ queryKey: ["pharmacies"], queryFn: DirectoryService.listPharmacies, enabled });

  if (!enabled) {
    return (
      <EmptyState icon={Building2} title="Admins only" description="Sign in with an administrator account to manage the directory." />
    );
  }

  const sections = [
    {
      title: "Hospitals",
      icon: Building2,
      items: (hospitals.data ?? []).map((h) => ({ id: h.id, primary: h.name, secondary: `${h.address} · ${h.phone ?? "—"}` })),
    },
    {
      title: "Doctors",
      icon: Stethoscope,
      items: (doctors.data ?? []).map((d) => ({
        id: d.id,
        primary: d.full_name,
        secondary: `${d.specialty} · ${d.hospitals?.name ?? "Independent"}`,
      })),
    },
    {
      title: "Laboratories",
      icon: FlaskConical,
      items: (labs.data ?? []).map((l) => ({ id: l.id, primary: l.name, secondary: l.address ?? "" })),
    },
    {
      title: "Pharmacies",
      icon: Pill,
      items: (pharmacies.data ?? []).map((p) => ({ id: p.id, primary: p.name, secondary: p.address ?? "" })),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Manage directory</h1>
        <p className="text-sm text-muted-foreground">
          Providers currently visible to users. Listings are seeded demo data in this prototype.
        </p>
      </div>

      {sections.map((s) => (
        <section key={s.title} className="card-soft p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <s.icon className="h-5 w-5 text-primary" /> {s.title}
            <span className="text-sm font-normal text-muted-foreground">({s.items.length})</span>
          </h2>
          <ul className="divide-y">
            {s.items.map((i) => (
              <li key={i.id} className="py-2.5">
                <p className="text-sm font-medium">{i.primary}</p>
                <p className="text-xs text-muted-foreground">{i.secondary}</p>
              </li>
            ))}
            {s.items.length === 0 && <li className="py-2.5 text-sm text-muted-foreground">Nothing listed yet.</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}
