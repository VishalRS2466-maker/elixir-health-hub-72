import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { doctorOverview } from "@/lib/doctor.functions";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/doctor/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · ELIXIR Doctor" },
      { name: "description", content: "Consent responses, appointment updates and clinical alerts." },
      { property: "og:title", content: "Notifications · ELIXIR Doctor" },
      { property: "og:description", content: "Clinical alerts for your ELIXIR doctor account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DoctorNotificationsPage,
});

function DoctorNotificationsPage() {
  const overviewFn = useServerFn(doctorOverview);
  const overview = useQuery({ queryKey: ["doctor-overview"], queryFn: () => overviewFn({}) });
  const items = overview.data?.notifications ?? [];

  if (overview.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Updates about your patients, consent and appointments.</p>
      </header>
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="card-soft p-4">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
