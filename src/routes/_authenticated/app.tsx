import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AiAssistantProvider } from "@/components/ai/AiAssistant";
import { SecurityProvider } from "@/components/security/SecurityProvider";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
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
