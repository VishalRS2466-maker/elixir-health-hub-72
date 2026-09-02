import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { AppShell } from "@/components/AppShell";
import { AiAssistantProvider } from "@/components/ai/AiAssistant";
import { SecurityProvider } from "@/components/security/SecurityProvider";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const { role, roleLoading } = useSession();
  const navigate = useNavigate();

  // Doctors belong in the doctor portal — never render the user shell for them.
  useEffect(() => {
    if (!roleLoading && role === "doctor") navigate({ to: "/doctor", replace: true });
  }, [role, roleLoading, navigate]);

  if (roleLoading || role === "doctor") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-3 px-6">
          <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <SecurityProvider>
          <AiAssistantProvider>
            <AppShell>
              <Outlet />
            </AppShell>
          </AiAssistantProvider>
        </SecurityProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
