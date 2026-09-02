import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bot,
  CalendarDays,
  FileHeart,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/doctor", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/doctor/patients", label: "My Patients", icon: Users },
  { to: "/doctor/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/doctor/requests", label: "Patient Requests", icon: FileHeart },
  { to: "/doctor/consent", label: "Consent", icon: ShieldCheck },
  { to: "/doctor/ai", label: "AI Clinical Assistant", icon: Bot },
  { to: "/doctor/notifications", label: "Notifications", icon: Bell },
];

const SECONDARY = [
  { to: "/doctor/profile", label: "Doctor Profile", icon: UserRound },
  { to: "/doctor/settings", label: "Security & Settings", icon: Settings },
];

export function DoctorShell({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 text-slate-100">
        <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary-foreground">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tracking-[0.18em]">ELIXIR</p>
            <p className="truncate text-xs text-slate-400">Doctor Portal</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/doctor/profile"
              className="hidden items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300 sm:flex"
            >
              <UserRound className="h-3.5 w-3.5" />
              <span className="max-w-[180px] truncate">
                Dr. {(profile?.full_name ?? "Doctor").replace(/^Dr\.?\s*/i, "")}
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Doctor
              </span>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              className="text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="mr-1 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-3 pb-2">
          {[...NAV, ...SECONDARY].map((item) => {
            const active = item.to === "/doctor" ? pathname === "/doctor" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800",
                  active && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1680px] px-4 py-6">{children}</main>
    </div>
  );
}
