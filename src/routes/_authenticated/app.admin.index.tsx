import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, ClipboardList, Users } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import * as PatientService from "@/services/user";
import * as DirectoryService from "@/services/directory";
import * as AuditService from "@/services/audit";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/app/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard · ELIXIR" },
      { name: "description", content: "Platform overview: users, providers and audit activity." },
      { property: "og:title", content: "Admin dashboard · ELIXIR" },
      { property: "og:description", content: "Monitor ELIXIR users, providers and system activity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { role } = useSession();

  const profiles = useQuery({ queryKey: ["admin-profiles"], queryFn: PatientService.listProfiles, enabled: role === "admin" });
  const hospitals = useQuery({ queryKey: ["hospitals"], queryFn: DirectoryService.listHospitals, enabled: role === "admin" });
  const doctors = useQuery({ queryKey: ["doctors"], queryFn: DirectoryService.listDoctors, enabled: role === "admin" });
  const logs = useQuery({ queryKey: ["admin-audit"], queryFn: AuditService.listAll, enabled: role === "admin" });

  if (role !== "admin") {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Admins only"
        description="This dashboard is available to accounts registered as an administrator."
      />
    );
  }

  const stats = [
    { label: "Registered users", value: profiles.data?.length ?? 0, icon: Users },
    { label: "Hospitals", value: hospitals.data?.length ?? 0, icon: Building2 },
    { label: "Doctors", value: doctors.data?.length ?? 0, icon: ClipboardList },
    { label: "Logged actions", value: logs.data?.length ?? 0, icon: Activity },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Administrators never see user medical records — only accounts, providers and audit metadata.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-soft p-4">
            <s.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-2xl font-semibold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/app/admin/directory" className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Manage directory
        </Link>
        <Link to="/app/activity" className="rounded-2xl border px-4 py-2 text-sm font-medium">
          View audit logs
        </Link>
      </div>

      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">Recent users</h2>
        <ul className="divide-y">
          {(profiles.data ?? []).slice(0, 12).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{p.full_name ?? "Unnamed"}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.universal_id}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">Latest activity</h2>
        <ul className="divide-y">
          {(logs.data ?? []).slice(0, 10).map((l) => (
            <li key={l.id} className="py-2.5">
              <p className="text-sm font-medium">{l.action}</p>
              <p className="text-xs text-muted-foreground">
                {l.actor_name} ({l.actor_role}) · {new Date(l.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
