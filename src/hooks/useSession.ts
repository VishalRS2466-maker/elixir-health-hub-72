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
  });

  const roles = useQuery({
    queryKey: ["roles", user?.id],
    queryFn: () => AuthService.getRoles(user!.id),
    enabled: !!user,
  });

  const roleList = roles.data ?? [];
  return {
    user,
    loading: loading || profile.isLoading || roles.isLoading,
    profile: profile.data ?? null,
    roles: roleList,
    role: (roleList.includes("admin")
      ? "admin"
      : roleList.includes("doctor")
        ? "doctor"
        : "patient") as "admin" | "doctor" | "patient",
  };
}
