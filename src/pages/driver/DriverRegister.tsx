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
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";
import { toast } from "sonner";
import { ArrowRight, Bike, UserPlus } from "lucide-react";

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

export default function DriverRegister() {
  const { signUpDeliveryDriver, user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  if (!loading && user) return <Navigate to="/entregador" replace />;

  const onSubmit = async (values: FormData) => {
    try {
      setSubmitting(true);
      await signUpDeliveryDriver(values.email, values.password, values.fullName.trim());
      toast.success("Conta criada. Confere seu e-mail para confirmar acesso.");
      navigate("/entregador/login");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível criar a conta.");
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
              Cadastro de entregador
            </p>
            <h1 className="text-2xl font-black mt-1">Criar conta para receber corridas</h1>
            <p className="text-muted-foreground mt-1">
              Use o mesmo e-mail informado pelo lojista no cadastro do entregador.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
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
                    <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11" disabled={submitting}>
                {submitting ? "Criando..." : "Criar conta"}
                {!submitting && <UserPlus className="h-4 w-4 ml-2" />}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/entregador/login" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
              Entrar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
