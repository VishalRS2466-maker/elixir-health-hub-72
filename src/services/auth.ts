import { supabase } from "@/integrations/supabase/client";

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
}) {
  const { data, error } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { full_name: opts.fullName },
    },
  });
  if (error) throw error;
  if (!data.session) return { needsConfirmation: true };
  await bootstrapAccount(opts);
  return { needsConfirmation: false };
}

/** Creates the profile + role rows for the currently signed-in user. */
export async function bootstrapAccount(opts: {
  fullName: string;
  email: string;
  role: AppRole;
  specialty?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not signed in");

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  await supabase.from("user_roles").insert({ user_id: user.id, role: opts.role });

  if (!existing) {
    // The database seeds realistic demo health data for new patients.
    const { error } = await supabase
      .from("profiles")
      .insert({ id: user.id, full_name: opts.fullName, email: opts.email });
    if (error) throw error;
  }

  if (opts.role === "doctor") {
    await supabase.from("doctors").insert({
      user_id: user.id,
      full_name: opts.fullName,
      specialty: opts.specialty || "General Medicine",
      is_demo: false,
    });
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as AppRole);
}
