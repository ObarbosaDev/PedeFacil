import { useState } from "react";
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
import { ArrowLeft, ArrowRight, BarChart3, MessageCircle, ShieldCheck, Store } from "lucide-react";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    const now = Date.now();
    if (blockedUntil && now < blockedUntil) {
      const waitSeconds = Math.ceil((blockedUntil - now) / 1000);
      toast.error(`Muitas tentativas. Aguarde ${waitSeconds}s para tentar de novo.`);
      return;
    }

    try {
      setLoading(true);
      await signIn(data.email, data.password);
      setFailedAttempts(0);
      setBlockedUntil(null);
      navigate("/admin");
    } catch {
      const nextFailedAttempts = failedAttempts + 1;
      setFailedAttempts(nextFailedAttempts);
      if (nextFailedAttempts >= 5) {
        const cooldownMs = 30_000;
        setBlockedUntil(Date.now() + cooldownMs);
      }
      toast.error("Não foi possível entrar. Confere seu e-mail e senha.");
    } finally {
      setLoading(false);
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
              <Link to="/" className="inline-flex items-center gap-1 mb-8">
                <span className="text-3xl font-black">Pede</span>
                <span className="text-3xl font-black">Fácil</span>
              </Link>

              <h1 className="text-4xl font-black leading-tight">Seu painel de pedidos, do jeito certo.</h1>
              <p className="mt-4 text-lg opacity-90 max-w-md">
                Entre para acompanhar os pedidos, atualizar o cardápio e tocar a operação sem sufoco.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-white/10 border border-white/20 p-4 flex items-center gap-3">
                <MessageCircle className="h-5 w-5" />
                <p>Pedido chega no WhatsApp já organizadinho.</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-4 flex items-center gap-3">
                <BarChart3 className="h-5 w-5" />
                <p>Visão em tempo real da sua operação.</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                <p>Dados protegidos e acesso seguro.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-8">
          <Card className="w-full max-w-md border-primary/20 shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-4">
                <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para início
                </Link>
              </div>
              <div className="lg:hidden mb-6">
                <Link to="/" className="inline-flex items-center gap-1">
                  <span className="text-2xl font-black text-primary">Pede</span>
                  <span className="text-2xl font-black">Fácil</span>
                </Link>
              </div>

              <div className="mb-6">
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Acesso do lojista
                </p>
                <h2 className="text-2xl font-black mt-1">Bora entrar?</h2>
                <p className="text-muted-foreground mt-1">Coloque seus dados e abra seu painel.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seunome@empresa.com" {...field} />
                        </FormControl>
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
                        <FormControl>
                          <Input type="password" placeholder="Digite sua senha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full h-11" disabled={loading || (!!blockedUntil && Date.now() < blockedUntil)}>
                    {loading ? "Entrando..." : "Entrar no painel"}
                    {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                </form>
              </Form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Ainda não tem conta?{" "}
                <Link to="/registro" className="text-primary font-semibold hover:underline">
                  Criar conta grátis
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

