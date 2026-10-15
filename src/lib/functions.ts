import { supabase } from "@/integrations/supabase/client";

/**
 * Redeems a portal PIN for the signed-in user. The PIN is checked inside the
 * database (security-definer RPC against bcrypt hashes); roles can never be
 * self-assigned from the browser because user_roles has no write policies.
 */
export async function redeemPin({ data }: { data: { pin: string } }) {
  const { data: role, error } = await supabase.rpc("redeem_portal_pin", { _pin: data.pin });
  if (error) throw new Error(error.message.includes("Invalid PIN") ? "Invalid PIN" : error.message);
  return { role: role as "admin" | "user" };
}

/** Roles of the currently signed-in user (RLS: users read only their own). */
export async function getMyRoles() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { roles: [] as string[] };
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  if (error) throw new Error(error.message);
  return { roles: (data ?? []).map((r) => r.role as string) };
}
