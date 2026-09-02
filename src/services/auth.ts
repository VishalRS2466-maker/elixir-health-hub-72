import { supabase } from "@/integrations/supabase/client";
import { getMyRole, provisionMyAccount } from "@/lib/roles.functions";

export type AppRole = "patient" | "doctor" | "admin";

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(opts: {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  specialty?: string;
  phone?: string;
  dob?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { full_name: opts.fullName, requested_role: opts.role === "doctor" ? "doctor" : "patient", specialty: opts.specialty ?? null },
    },
  });
  if (error) throw error;
  if (!data.session) return { needsConfirmation: true };
  await bootstrapAccount(opts);
  return { needsConfirmation: false };
}

/** Creates the profile + role rows for the currently signed-in user (server-verified). */
export async function bootstrapAccount(opts: {
  fullName: string;
  email: string;
  role: AppRole;
  specialty?: string;
  phone?: string;
  dob?: string;
}) {
  await provisionMyAccount({ data: opts });
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Roles come from the server, verified against the database. */
export async function getRoles(_userId?: string): Promise<AppRole[]> {
  const res = await getMyRole();
  return res.roles;
}
