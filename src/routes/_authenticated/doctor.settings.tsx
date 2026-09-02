import { createFileRoute } from "@tanstack/react-router";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { SecurityProvider } from "@/components/security/SecurityProvider";

export const Route = createFileRoute("/_authenticated/doctor/settings")({
  head: () => ({
    meta: [
      { title: "Security settings · ELIXIR Doctor" },
      { name: "description", content: "Passkeys, devices and security activity for your clinician account." },
      { property: "og:title", content: "Security settings · ELIXIR Doctor" },
      { property: "og:description", content: "Manage passkeys and security for your ELIXIR clinician account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DoctorSettingsPage,
});

function DoctorSettingsPage() {
  return (
    <SecurityProvider>
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">Security & settings</h1>
          <p className="text-sm text-muted-foreground">
            Protect your clinician account with passkeys and device verification.
          </p>
        </header>
        <SecuritySettings />
      </div>
    </SecurityProvider>
  );
}
