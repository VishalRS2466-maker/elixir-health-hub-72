import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { doctorPatients } from "@/lib/doctor.functions";
import { categoryLabel } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/doctor/patients/")({
  component: PatientsPage,
});

function PatientsPage() {
  const fn = useServerFn(doctorPatients);
  const users = useQuery({ queryKey: ["doctor-users"], queryFn: () => fn({}) });
  const [q, setQ] = useState("");

  const list = (users.data ?? []).filter(
    (p) =>
      !q.trim() ||
      p.full_name.toLowerCase().includes(q.toLowerCase()) ||
      p.universal_id.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My users</h1>
        <p className="text-sm text-muted-foreground">
          Only users who granted you active consent appear here.
        </p>
      </div>
      <Input
        placeholder="Filter by name or Universal ID"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      {users.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-muted" />}
      {!users.isLoading && list.length === 0 && (
        <EmptyState
          icon={Users}
          title="No authorized users"
          description="Request access from the User Requests page. Access appears here once approved."
        />
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <Link
            key={p.patient_id}
            to="/doctor/patients/$patientId"
            params={{ patientId: p.patient_id }}
            className="card-soft block p-4 transition-colors hover:bg-accent"
          >
            <p className="font-semibold">{p.full_name}</p>
            <p className="font-mono text-xs text-muted-foreground">{p.universal_id}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[p.gender, p.blood_group].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-2 text-xs">{p.categories.map(categoryLabel).join(", ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.expires_at ? `Consent until ${new Date(p.expires_at).toLocaleDateString()}` : "No expiry set"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
