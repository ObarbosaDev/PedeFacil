import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL invalida"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20, "VITE_SUPABASE_PUBLISHABLE_KEY invalida"),
  VITE_SUPABASE_PROJECT_ID: z.string().min(3, "VITE_SUPABASE_PROJECT_ID invalido").optional(),
  VITE_PAYMENTS_API_BASE_URL: z.string().url("VITE_PAYMENTS_API_BASE_URL invalida"),
  VITE_PUBLIC_APP_URL: z.string().url("VITE_PUBLIC_APP_URL invalida").optional(),
  VITE_ENABLE_INTERNAL_ADMIN_PAGES: z.string().optional(),
  VITE_FEATURE_AUTOMATIONS: z.string().optional(),
  VITE_FEATURE_MARKETPLACE_OPS: z.string().optional(),
  VITE_FEATURE_PREMIUM_SUPPORT: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.message).join(" | ");
  throw new Error(`Configuracao de ambiente invalida: ${issues}`);
}

export const env = parsed.data;
