import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setLoading(true);
      await signIn(data.email, data.password);
      navigate("/admin");
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="text-primary-foreground max-w-md">
          <h1 className="text-5xl font-extrabold mb-4">PedeFácil</h1>
          <p className="text-xl opacity-90">Seu cardápio digital profissional. Receba pedidos pelo WhatsApp com facilidade.</p>
          <div className="mt-12 space-y-4 text-lg opacity-80">
            <p>✅ Cardápio digital bonito</p>
            <p>✅ Pedidos via WhatsApp</p>
            <p>✅ Dashboard de gestão</p>
            <p>✅ Programa de fidelidade</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <h1 className="text-3xl font-extrabold">
              <span className="text-primary">Pede</span>Fácil
            </h1>
          </div>

          <h2 className="text-2xl font-bold mb-2">Entrar na sua conta</h2>
          <p className="text-muted-foreground mb-8">Acesse o painel da sua loja</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="seu@email.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Não tem conta?{" "}
            <Link to="/registro" className="text-primary font-semibold hover:underline">Criar conta grátis</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
