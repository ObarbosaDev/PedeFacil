import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ArrowRight, Bike, LogIn } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

type FormData = z.infer<typeof schema>;

export default function DriverLogin() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user) return <Navigate to="/entregador" replace />;

  const onSubmit = async (values: FormData) => {
    try {
      setSubmitting(true);
      await signIn(values.email, values.password);
      navigate("/entregador");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-sm text-primary font-medium flex items-center gap-2">
              <Bike className="h-4 w-4" />
              Área do entregador
            </p>
            <h1 className="text-2xl font-black mt-1">Entrar para pegar corridas</h1>
            <p className="text-muted-foreground mt-1">Acesse sua conta para ver e atualizar entregas.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
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
                    <FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl>
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
            Primeiro acesso?{" "}
            <Link to="/entregador/registro" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
              Criar conta
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
