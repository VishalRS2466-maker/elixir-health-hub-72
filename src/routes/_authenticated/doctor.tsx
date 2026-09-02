import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { DoctorShell } from "@/components/doctor/DoctorShell";
import { EmptyState } from "@/components/EmptyState";
import { ThemeProvider } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/doctor")({
  head: () => ({
    meta: [
      { title: "Doctor Portal · ELIXIR" },
      { name: "description", content: "Clinical dashboard for verified ELIXIR doctors." },
      { property: "og:title", content: "Doctor Portal · ELIXIR" },
      { property: "og:description", content: "Consent-gated user access, appointments and clinical AI support." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DoctorLayout,
});

function DoctorLayout() {
  const { role, roleLoading } = useSession();
  return (
    <ThemeProvider>
      <DoctorShell>
        {roleLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : role !== "doctor" ? (
          <EmptyState
            icon={Stethoscope}
            title="Doctor Portal"
            description="This portal is available to accounts verified as a doctor. Your account does not have doctor access."
          />
        ) : (
          <Outlet />
        )}
      </DoctorShell>
    </ThemeProvider>
  );
}
