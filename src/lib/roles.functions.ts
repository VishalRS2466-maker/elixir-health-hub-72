import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "patient" | "doctor" | "admin";

export type MyRole = {
  userId: string;
  roles: AppRole[];
  role: AppRole | null;
};

function primary(roles: AppRole[]): AppRole | null {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("doctor")) return "doctor";
  if (roles.includes("patient")) return "patient";
  return null;
}

/** Server-verified role of the authenticated caller. The database is the only source of truth. */
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyRole> => {
    const c = context as unknown as { supabase: any; userId: string };
    const { data } = await c.supabase.from("user_roles").select("role").eq("user_id", c.userId);
    const roles = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
    return { userId: c.userId, roles, role: primary(roles) };
  });

type ProvisionInput = {
  fullName: string;
  email: string;
  role: AppRole;
  specialty?: string;
  phone?: string;
  dob?: string;
};

/**
 * Creates the profile + role rows for the currently authenticated user.
 * Role assignment happens server-side: a caller can never grant themselves `admin`,
 * and roles are only ever written for accounts that have none yet.
 */
export const provisionMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProvisionInput) => input)
  .handler(async ({ data, context }): Promise<MyRole> => {
    const c = context as unknown as { supabase: any; userId: string };
    const userId = c.userId;

    const { data: existingRoles } = await c.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const current = ((existingRoles ?? []) as { role: AppRole }[]).map((r) => r.role);
    if (current.length > 0) return { userId, roles: current, role: primary(current) };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The requested role is read from the signup metadata stored on the auth user,
    // never from the request body. `admin` is never self-serviceable.
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const signupRole = (authUser?.user?.user_metadata?.["requested_role"] as string | undefined) ?? "patient";
    const requested: AppRole = signupRole === "doctor" ? "doctor" : "patient";

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      const { error } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        full_name: data.fullName,
        email: data.email,
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.dob ? { dob: data.dob } : {}),
      });
      if (error) throw new Error(error.message);
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: requested });
    if (roleError) throw new Error(roleError.message);

    if (requested === "doctor") {
      const { data: existingDoctor } = await supabaseAdmin
        .from("doctors")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!existingDoctor) {
        await supabaseAdmin.from("doctors").insert({
          user_id: userId,
          full_name: data.fullName,
          specialty: data.specialty || "General Medicine",
          is_demo: false,
        });
      }
    }

    return { userId, roles: [requested], role: requested };
  });
