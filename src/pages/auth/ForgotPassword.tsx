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
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";

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
    } catch (err: any) {
      toast.success("Se o e-mail estiver cadastrado, o link de recuperação já está a caminho.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-sm text-primary font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Recuperação de acesso
            </p>
            <h1 className="text-2xl font-black mt-1">Esqueceu a senha?</h1>
            <p className="text-muted-foreground mt-1">Relaxa. Digita seu e-mail e a gente te manda o link para criar uma senha nova.</p>
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
                      <Input type="email" placeholder="seunome@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Enviando..." : "Mandar link de recuperação"}
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
    </div>
  );
}
