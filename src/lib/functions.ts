import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Redeems a portal PIN for the signed-in user. PINs are compared server-side
 * against secrets; the admin role is granted via the service client and can
 * never be self-assigned from the browser.
 */
export const redeemPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pin: string }) => input)
  .handler(async ({ data, context }) => {
    const pin = (data.pin || "").trim();
    const adminPin = process.env["ADMIN_PORTAL_PIN"];
    const userPin = process.env["USER_PORTAL_PIN"];

    let role: "admin" | "user" | null = null;
    if (adminPin && pin === adminPin) role = "admin";
    else if (userPin && pin === userPin) role = "user";
    if (!role) throw new Error("Invalid PIN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { role };
  });

/** Roles of the currently signed-in user (read as the user, RLS-scoped). */
export const getMyRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r) => r.role as string) };
  });
