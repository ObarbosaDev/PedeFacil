import { useState } from "react";
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
import { ArrowLeft, ArrowRight, LogIn, ShieldCheck, User, WandSparkles } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

type FormData = z.infer<typeof schema>;

export default function ClientLogin() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const nextPathRaw = searchParams.get("next") || "";
  const nextPath = nextPathRaw.startsWith("/") ? nextPathRaw : "/cliente/conta";
  const registerHref = `/cliente/registro${nextPathRaw ? `?next=${encodeURIComponent(nextPathRaw)}` : ""}`;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user) return <Navigate to={nextPath} replace />;

  const onSubmit = async (values: FormData) => {
    try {
      setSubmitting(true);
      await signIn(values.email, values.password);
      toast.success("Entrou com sucesso. Sua conta já está pronta para usar.");
      navigate(nextPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível entrar agora.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-300/20 blur-3xl" />
      </div>

      <div className="min-h-screen grid lg:grid-cols-2 relative z-10">
        <section className="hidden lg:flex p-10 xl:p-14">
          <div className="w-full rounded-3xl bg-gradient-to-br from-primary via-primary to-orange-500 text-primary-foreground p-10 flex flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] opacity-90">Área do cliente</p>
              <h1 className="text-4xl font-black leading-tight mt-4">Seu perfil para pedir sem perder tempo.</h1>
              <p className="mt-4 text-lg opacity-90 max-w-md">
                Salve favoritos, endereço e histórico para repetir pedidos em poucos cliques.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-white/10 border border-white/20 p-4 flex items-center gap-3">
                <WandSparkles className="h-5 w-5" />
                <p>Experiência personalizada no seu ritmo.</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                <p>Login seguro e conta protegida.</p>
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
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Conta de cliente
                </p>
                <h1 className="text-2xl font-black mt-1">Entrar na minha conta</h1>
                <p className="text-muted-foreground mt-1">Acesse para salvar seus dados e fechar pedidos mais rápido.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <div className="flex items-center justify-between">
                          <FormLabel>Senha</FormLabel>
                          <Link to="/esqueci-senha" className="text-xs text-primary hover:underline">
                            Esqueci minha senha
                          </Link>
                        </div>
                        <FormControl><Input type="password" placeholder="Digite sua senha" autoComplete="current-password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full h-11" disabled={submitting}>
                    {submitting ? "Entrando..." : "Entrar"}
                    {!submitting && <LogIn className="h-4 w-4 ml-2" />}
                  </Button>
                </form>
              </Form>

              <p className="text-center text-sm text-muted-foreground">
                Não tem conta?{" "}
                <Link to={registerHref} className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                  Criar conta
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

