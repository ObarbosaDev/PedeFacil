import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL invalida"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20, "VITE_SUPABASE_PUBLISHABLE_KEY invalida"),
  VITE_SUPABASE_PROJECT_ID: z.string().min(3, "VITE_SUPABASE_PROJECT_ID invalido").optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.message).join(" | ");
  throw new Error(`Configuracao de ambiente invalida: ${issues}`);
}

export const env = parsed.data;
