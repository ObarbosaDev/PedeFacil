import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck, Sparkles } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      await resetPassword(data.email);
      toast.success("Se o e-mail estiver cadastrado, o link de recuperação já está a caminho.");
    } catch {
      toast.success("Se o e-mail estiver cadastrado, o link de recuperação já está a caminho.");
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
          <div className="w-full rounded-3xl bg-gradient-to-br from-primary via-primary to-orange-500 text-primary-foreground p-10 flex flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] opacity-90">Recuperação de acesso</p>
              <h1 className="text-4xl font-black leading-tight mt-4">Esqueceu a senha? Acontece.</h1>
              <p className="mt-4 text-lg opacity-90 max-w-md">
                Você informa o e-mail, recebe o link e define uma nova senha em poucos minutos.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-white/10 border border-white/20 p-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                <p>Fluxo seguro com token temporário.</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-4 flex items-center gap-3">
                <Sparkles className="h-5 w-5" />
                <p>Recuperação rápida, sem enrolação.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-8">
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
                  <ShieldCheck className="h-4 w-4" />
                  Recuperação de acesso
                </p>
                <h1 className="text-2xl font-black mt-1">Esqueceu a senha?</h1>
                <p className="text-muted-foreground mt-1">Relaxa. Digite seu e-mail e a gente manda o link para você redefinir.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail da conta</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seunome@empresa.com" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? "Enviando..." : "Enviar link de recuperação"}
                    {!loading && <Mail className="h-4 w-4 ml-2" />}
                  </Button>
                </form>
              </Form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Lembrou da senha?{" "}
                <Link to="/login" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                  Voltar para o login <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
