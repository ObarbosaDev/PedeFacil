import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { toast } from "sonner";
import { ArrowRight, Mail, ShieldCheck, Sparkles } from "lucide-react";

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
      toast.success("Se o e-mail estiver cadastrado, o link de recuperação já foi enviado.");
    } catch {
      toast.success("Se o e-mail estiver cadastrado, o link de recuperação já foi enviado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      leftEyebrow="Recuperação de acesso"
      leftTitle="Esqueceu a senha? Resolve em minutos."
      leftDescription="Você informa o e-mail, recebe o link e redefine a senha sem dor de cabeça."
      leftHighlights={[
        { icon: ShieldCheck, text: "Fluxo seguro com token temporário." },
        { icon: Sparkles, text: "Recuperação rápida, sem enrolação." },
      ]}
      formEyebrow="Recuperação de acesso"
      formTitle="Esqueci minha senha"
      formDescription="Digite o e-mail da sua conta que enviamos o link para redefinir."
      formIcon={Mail}
      backTo="/login"
      backLabel="Voltar para login"
      secondaryTo="/"
      secondaryLabel="Ir para início"
      leftTone="dark"
      formTone="orange"
      quickPoints={["Link por e-mail", "Token temporário", "Conta protegida"]}
    >
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

          <Button type="submit" className="w-full h-11 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link de recuperação"}
            {!loading && <Mail className="h-4 w-4 ml-2" />}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-zinc-300 leading-relaxed">
        Lembrou da senha?{" "}
        <Link to="/login" className="text-zinc-100 font-semibold hover:text-white hover:underline inline-flex items-center gap-1">
          Voltar para o login <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
