import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AiAssistantProvider } from "@/components/ai/AiAssistant";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <AiAssistantProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </AiAssistantProvider>
  );
}
