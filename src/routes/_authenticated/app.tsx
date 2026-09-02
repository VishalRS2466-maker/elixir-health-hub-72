import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AiAssistantProvider } from "@/components/ai/AiAssistant";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AiAssistantProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </AiAssistantProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
