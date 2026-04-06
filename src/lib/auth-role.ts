import type { User } from "@supabase/supabase-js";

export type AppUserRole = "store_owner" | "customer" | "delivery_driver" | "unknown";

export function getUserRole(user: User | null | undefined): AppUserRole {
  const raw = String((user?.user_metadata as any)?.user_type || "").trim();
  if (raw === "store_owner" || raw === "customer" || raw === "delivery_driver") {
    return raw;
  }
  return "unknown";
}

export function getRoleMismatchMessage(expected: Exclude<AppUserRole, "unknown">) {
  if (expected === "store_owner") return "Essa conta não é de lojista.";
  if (expected === "customer") return "Essa conta não é de cliente.";
  return "Essa conta não é de entregador.";
}
