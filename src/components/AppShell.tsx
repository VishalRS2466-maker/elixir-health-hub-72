import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Building2,
  ClipboardList,
  Compass,
  FileHeart,
  Home,
  LifeBuoy,
  LogOut,
  Pill,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import * as NotificationService from "@/services/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Home };

const PATIENT_MAIN: NavItem[] = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/records", label: "Records", icon: FileHeart },
  { to: "/app/hospital", label: "E-Hospital", icon: Building2 },
  { to: "/app/explore", label: "Explore", icon: Compass },
  { to: "/app/profile", label: "Profile", icon: UserRound },
];

const PATIENT_EXTRA: NavItem[] = [
  { to: "/app/medicines", label: "Medicines & Reminders", icon: Pill },
  { to: "/app/consent", label: "Consent", icon: ShieldCheck },
  { to: "/app/activity", label: "Access activity", icon: Activity },
  { to: "/app/first-aid", label: "First Aid", icon: LifeBuoy },
];

const DOCTOR_NAV: NavItem[] = [
  { to: "/app/doctor", label: "Doctor dashboard", icon: Stethoscope },
  { to: "/app/explore", label: "Explore", icon: Compass },
  { to: "/app/first-aid", label: "First Aid", icon: LifeBuoy },
  { to: "/app/profile", label: "Profile", icon: UserRound },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/app/admin", label: "Admin dashboard", icon: ClipboardList },
  { to: "/app/admin/directory", label: "Manage directory", icon: Users },
  { to: "/app/activity", label: "Audit logs", icon: Activity },
  { to: "/app/profile", label: "Profile", icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, role } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [notifOpen, setNotifOpen] = useState(false);

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => NotificationService.list(user!.id),
    enabled: !!user,
  });
  const unread = (notifications.data ?? []).filter((n) => !n.read).length;

  const sideNav = role === "doctor" ? DOCTOR_NAV : role === "admin" ? ADMIN_NAV : [...PATIENT_MAIN, ...PATIENT_EXTRA];
  const bottomNav = role === "patient" ? PATIENT_MAIN : sideNav.slice(0, 5);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card px-4 py-6 md:flex">
        <Link to="/app" className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">ELIXIR</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {sideNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname === item.to && "bg-brand-soft text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" className="justify-start gap-3" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" /> Sign out
        </Button>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur">
          <Link to="/app" className="flex items-center gap-2 md:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileHeart className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">ELIXIR</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emergency px-1 text-[10px] font-bold text-emergency-foreground">
                    {unread}
                  </span>
                )}
              </Button>
              {notifOpen && (
                <div className="absolute right-0 top-12 z-40 w-80 max-w-[92vw] overflow-hidden rounded-2xl border bg-card shadow-lift">
                  <div className="flex items-center justify-between border-b px-4 py-2.5">
                    <p className="text-sm font-semibold">Notifications</p>
                    <button
                      className="text-xs text-primary"
                      onClick={async () => {
                        if (user) await NotificationService.markAllRead(user.id);
                        void notifications.refetch();
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {(notifications.data ?? []).length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No notifications yet.
                      </p>
                    )}
                    {(notifications.data ?? []).map((n) => (
                      <button
                        key={n.id}
                        onClick={async () => {
                          await NotificationService.markRead(n.id);
                          void notifications.refetch();
                          setNotifOpen(false);
                          if (n.link) navigate({ to: n.link });
                        }}
                        className={cn(
                          "block w-full border-b px-4 py-3 text-left last:border-0 hover:bg-accent",
                          !n.read && "bg-brand-soft/60",
                        )}
                      >
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Link
              to="/app/profile"
              className="flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                {(profile?.full_name ?? "U").charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-sm font-medium sm:block">
                {profile?.full_name?.split(" ")[0] ?? "Profile"}
              </span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card px-1 py-1.5 md:hidden">
        {bottomNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium text-muted-foreground",
              pathname === item.to && "text-primary",
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
