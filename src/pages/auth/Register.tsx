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
import { ArrowLeft, ArrowRight, BadgeCheck, Rocket, Store, Users } from "lucide-react";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
    email: z.string().trim().email("E-mail inválido"),
    password: z.string().regex(passwordRegex, PASSWORD_RULE),
    confirmPassword: z.string().min(8, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setLoading(true);
      await signUp(data.email, data.password, data.fullName.trim());
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível criar sua conta agora.");
    } finally {
      setLoading(false);
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
              <Link to="/" className="inline-flex items-center gap-1 mb-8">
                <span className="text-3xl font-black text-primary">Pede</span>
                <span className="text-3xl font-black">Fácil</span>
              </Link>

              <h1 className="text-4xl font-black leading-tight">Coloque sua loja no jogo em poucos minutos.</h1>
              <p className="mt-4 text-lg text-zinc-300 max-w-md">
                Crie sua conta, configure seu cardápio e comece a receber pedidos ainda hoje.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex items-center gap-3">
                <Rocket className="h-5 w-5 text-primary" />
                <p>Setup rápido, sem dor de cabeça.</p>
              </div>
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex items-center gap-3">
                <BadgeCheck className="h-5 w-5 text-emerald-400" />
                <p>Painel pronto para o dia a dia da operação.</p>
              </div>
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-orange-300" />
                <p>Clientes pedindo com mais facilidade.</p>
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
                  Cadastro de lojista
                </p>
                <h2 className="text-2xl font-black mt-1">Criar minha conta</h2>
                <p className="text-muted-foreground mt-1">Sem cartão de crédito. É só criar e começar.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: João Silva" {...field} />
                        </FormControl>
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
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Crie uma senha forte" {...field} />
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
                          <Input type="password" placeholder="Repita sua senha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? "Criando conta..." : "Criar conta grátis"}
                    {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                </form>
              </Form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Já tem conta?{" "}
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  Entrar agora
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

