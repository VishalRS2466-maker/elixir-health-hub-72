import { useEffect, useState, type ReactNode } from "react";
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
  Menu,
  Pill,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import * as NotificationService from "@/services/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type NavItem = { to: string; labelKey: TranslationKey; icon: typeof Home };
type NavGroup = { titleKey: TranslationKey; items: NavItem[] };

const PATIENT_MAIN: NavItem[] = [
  { to: "/app", labelKey: "nav.dashboard", icon: Home },
  { to: "/app/records", labelKey: "nav.records", icon: FileHeart },
  { to: "/app/hospital", labelKey: "nav.hospital", icon: Building2 },
  { to: "/app/explore", labelKey: "nav.explore", icon: Compass },
  { to: "/app/profile", labelKey: "nav.profile", icon: UserRound },
];

const PATIENT_GROUPS: NavGroup[] = [
  { titleKey: "nav.groupMain", items: PATIENT_MAIN },
  {
    titleKey: "nav.groupCare",
    items: [
      { to: "/app/medicines", labelKey: "nav.medicines", icon: Pill },
      { to: "/app/first-aid", labelKey: "nav.firstAid", icon: LifeBuoy },
    ],
  },
  {
    titleKey: "nav.groupPrivacy",
    items: [
      { to: "/app/consent", labelKey: "nav.consent", icon: ShieldCheck },
      { to: "/app/activity", labelKey: "nav.activity", icon: Activity },
      { to: "/app/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

const DOCTOR_GROUPS: NavGroup[] = [
  {
    titleKey: "nav.groupMain",
    items: [
      { to: "/app/doctor", labelKey: "nav.doctor", icon: Stethoscope },
      { to: "/app/explore", labelKey: "nav.explore", icon: Compass },
      { to: "/app/first-aid", labelKey: "nav.firstAid", icon: LifeBuoy },
    ],
  },
  {
    titleKey: "nav.groupPrivacy",
    items: [
      { to: "/app/profile", labelKey: "nav.profile", icon: UserRound },
      { to: "/app/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

const ADMIN_GROUPS: NavGroup[] = [
  {
    titleKey: "nav.groupMain",
    items: [
      { to: "/app/admin", labelKey: "nav.admin", icon: ClipboardList },
      { to: "/app/admin/directory", labelKey: "nav.directory", icon: Users },
      { to: "/app/activity", labelKey: "nav.audit", icon: Activity },
    ],
  },
  {
    titleKey: "nav.groupPrivacy",
    items: [
      { to: "/app/profile", labelKey: "nav.profile", icon: UserRound },
      { to: "/app/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

function SidebarItem({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  return (
    <Link
      to={item.to}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-brand-soft font-semibold text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn("h-5 w-1 rounded-full", active ? "bg-primary" : "bg-transparent")}
      />
      <item.icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, role } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [notifOpen, setNotifOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => NotificationService.list(user!.id),
    enabled: !!user,
  });
  const unread = (notifications.data ?? []).filter((n) => !n.read).length;

  const groups = role === "doctor" ? DOCTOR_GROUPS : role === "admin" ? ADMIN_GROUPS : PATIENT_GROUPS;
  const bottomNav = role === "patient" ? PATIENT_MAIN : groups[0]!.items.slice(0, 5);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Backdrop */}
      <div
        onClick={() => setNavOpen(false)}
        aria-hidden={!navOpen}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px] transition-opacity duration-300",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Slide-in sidebar */}
      <aside
        id="app-sidebar"
        aria-label={t("nav.menu")}
        aria-hidden={!navOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r bg-card shadow-lift",
          "transition-transform duration-300 ease-out",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3.5">
          <Link
            to="/app"
            onClick={() => setNavOpen(false)}
            aria-label="ELIXIR — Home"
            className="rounded-md px-2 py-1 text-lg font-semibold tracking-[0.18em] transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ELIXIR
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("nav.closeMenu")}
            onClick={() => setNavOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.titleKey} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(group.titleKey)}
              </p>
              {group.items.map((item) => (
                <SidebarItem
                  key={item.to}
                  item={item}
                  active={pathname === item.to}
                  onSelect={() => setNavOpen(false)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t p-3">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" /> {t("common.signOut")}
          </Button>
        </div>
      </aside>

      <div>
        <header className="relative sticky top-0 z-30 flex items-center gap-2 border-b bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("nav.openMenu")}
            aria-expanded={navOpen}
            aria-controls="app-sidebar"
            className="min-h-11 min-w-11"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link
            to="/app"
            aria-label="ELIXIR — Home"
            className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md px-3 py-1.5 text-lg font-semibold tracking-[0.18em] text-foreground transition-all duration-200 hover:scale-[1.03] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-xl"
          >
            <span className="block max-w-[38vw] truncate sm:max-w-none">ELIXIR</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.notifications")}
                className="min-h-11 min-w-11"
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
                    <p className="text-sm font-semibold">{t("common.notifications")}</p>
                    <button
                      className="text-xs text-primary"
                      onClick={async () => {
                        if (user) await NotificationService.markAllRead(user.id);
                        void notifications.refetch();
                      }}
                    >
                      {t("common.markAllRead")}
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {(notifications.data ?? []).length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {t("common.noNotifications")}
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
              className="flex min-h-11 items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3"
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

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:pb-12">{children}</main>
      </div>

      <nav
        aria-label={t("nav.groupMain")}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card px-1 py-1.5 md:hidden"
      >
        {bottomNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium text-muted-foreground",
              pathname === item.to && "text-primary",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate px-0.5">{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
