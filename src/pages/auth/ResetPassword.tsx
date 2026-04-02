import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";

const schema = z
  .object({
    password: z.string().regex(passwordRegex, PASSWORD_RULE),
    confirmPassword: z.string().min(8, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
  const { session, loading: authLoading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!authLoading && !session) {
      toast.error("Link inválido ou expirado. Solicite outro link de recuperação.");
    }
  }, [authLoading, session]);

  const onSubmit = async (data: FormData) => {
    try {
      setSaving(true);
      await updatePassword(data.password);
      toast.success("Senha atualizada com sucesso!");
      navigate("/login");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não rolou redefinir sua senha.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Voltar para login
              </Link>
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                Ir para início
              </Link>
            </div>
          </div>
          <div className="mb-6">
            <p className="text-sm text-primary font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Nova senha
            </p>
            <h1 className="text-2xl font-black mt-1">Redefinir senha</h1>
            <p className="text-muted-foreground mt-1">Crie uma senha nova para entrar na sua conta.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Digite sua nova senha" autoComplete="new-password" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{PASSWORD_RULE}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Repita a nova senha" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={saving || authLoading || !session}>
                {saving ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link to="/login" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
              Voltar para login <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


