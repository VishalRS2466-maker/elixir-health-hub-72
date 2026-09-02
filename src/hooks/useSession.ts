import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import * as PatientService from "@/services/patient";
import * as AuthService from "@/services/auth";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
      queryClient.invalidateQueries();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => PatientService.getProfile(user!.id),
    enabled: !!user,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const roles = useQuery({
    queryKey: ["roles", user?.id],
    queryFn: () => AuthService.getRoles(),
    enabled: !!user,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const roleList = roles.data ?? [];
  // Only the very first resolution gates the UI — background refetches must not
  // unmount the shell (that caused the dashboard to flash/blink).
  const roleLoading = loading || !user || (roles.isPending && roles.fetchStatus !== "idle");
  // Never default to "patient": the role stays null until the server confirms it.
  const role = roleLoading
    ? null
    : roleList.includes("admin")
      ? "admin"
      : roleList.includes("doctor")
        ? "doctor"
        : roleList.includes("patient")
          ? "patient"
          : null;

  return {
    user,
    loading: loading || profile.isLoading || roles.isPending,
    roleLoading,
    profile: profile.data ?? null,
    roles: roleList,
    role: role as "admin" | "doctor" | "patient" | null,
  };
}
