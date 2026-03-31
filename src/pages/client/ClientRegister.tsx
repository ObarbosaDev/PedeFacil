import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ShieldCheck, UserPlus, WandSparkles } from "lucide-react";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Mínimo 2 caracteres"),
    email: z.string().trim().email("E-mail inválido"),
    password: z.string().regex(passwordRegex, PASSWORD_RULE),
    confirmPassword: z.string().min(8, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function ClientRegister() {
  const { signUpClient, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const prefill = useMemo(() => {
    const fullName = searchParams.get("name")?.trim() || "";
    const email = searchParams.get("email")?.trim().toLowerCase() || "";
    const phone = searchParams.get("phone")?.trim() || "";
    const fromCheckout = searchParams.get("from") === "checkout";
    const nextRaw = searchParams.get("next") || "";
    const nextPath = nextRaw.startsWith("/") ? nextRaw : "/cliente/conta";
    return { fullName, email, phone, fromCheckout, nextRaw, nextPath };
  }, [searchParams]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: prefill.fullName, email: prefill.email, password: "", confirmPassword: "" },
  });

  if (!loading && user) return <Navigate to={prefill.nextPath} replace />;

  const onSubmit = async (values: FormData) => {
    try {
      setSubmitting(true);
      await signUpClient(values.email, values.password, values.fullName.trim(), prefill.phone || undefined);
      toast.success("Conta criada. Confere seu e-mail para confirmar o acesso.");
      navigate(`/cliente/login${prefill.nextRaw ? `?next=${encodeURIComponent(prefill.nextRaw)}` : ""}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível criar sua conta agora.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-orange-300/20 blur-3xl" />
      </div>

      <div className="min-h-screen grid lg:grid-cols-2 relative z-10">
        <section className="hidden lg:flex p-10 xl:p-14">
          <div className="w-full rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-zinc-50 p-10 flex flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-300">Área do cliente</p>
              <h1 className="text-4xl font-black leading-tight mt-4">Crie seu perfil e personalize seus pedidos.</h1>
              <p className="mt-4 text-lg text-zinc-300 max-w-md">
                Com sua conta, você salva endereço, acompanha histórico e refaz pedidos em segundos.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex items-center gap-3">
                <WandSparkles className="h-5 w-5 text-primary" />
                <p>Experiência personalizada de verdade.</p>
              </div>
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <p>Conta segura e dados protegidos.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-8">
          <Card className="w-full max-w-md border-primary/20 shadow-xl">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <Link to="/cliente" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para lojas
                </Link>
              </div>
              <div>
                <p className="text-sm text-primary font-medium">Conta de cliente</p>
                <h1 className="text-2xl font-black mt-1">
                  {prefill.fromCheckout ? "Bora finalizar sua conta?" : "Criar minha conta"}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {prefill.fromCheckout
                    ? "Você está quase finalizando seu pedido. Crie sua conta para concluir com segurança."
                    : "Salve seus dados e finalize pedidos sem fricção."}
                </p>
              </div>

              {prefill.fromCheckout && (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
                  Cadastro rápido: já preenchemos o que veio do checkout para você terminar em segundos.
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl><Input placeholder="Seu nome" autoComplete="name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl><Input type="email" placeholder="voce@email.com" autoComplete="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl><Input type="password" placeholder="Crie uma senha" autoComplete="new-password" {...field} /></FormControl>
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
                        <FormControl><Input type="password" placeholder="Repita a senha" autoComplete="new-password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full h-11" disabled={submitting}>
                    {submitting ? "Criando conta..." : "Criar conta"}
                    {!submitting && <UserPlus className="h-4 w-4 ml-2" />}
                  </Button>
                </form>
              </Form>

              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link to={`/cliente/login${prefill.nextRaw ? `?next=${encodeURIComponent(prefill.nextRaw)}` : ""}`} className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                  Entrar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

