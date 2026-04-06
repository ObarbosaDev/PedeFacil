import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";
import { trackProductEvent } from "@/lib/product-analytics";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { toast } from "sonner";
import { ArrowRight, Bike, Eye, EyeOff, Lock, ShieldCheck, UserPlus, WalletCards } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  if (!loading && user) return <Navigate to="/entregador" replace />;

  const onSubmit = async (values: FormData) => {
    try {
      setSubmitting(true);
      await signUpDeliveryDriver(values.email, values.password, values.fullName.trim());
      toast.success("Conta criada. Confira seu e-mail para confirmar o acesso.");
      void trackProductEvent("funnel_account_created", { role: "delivery_driver" });
      navigate("/entregador/login");
    } catch (error: any) {
      toast.error(error.message || "Não rolou criar a conta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      leftEyebrow="Cadastro de entregador"
      leftTitle="Crie sua conta e comece a rodar."
      leftDescription="Entre no fluxo de entregas com um painel claro para aceitar corridas e tocar cada etapa sem confusão."
      leftHighlights={[
        { icon: WalletCards, text: "Conta pronta para operar com mais organização." },
        { icon: ShieldCheck, text: "Dados protegidos e fluxo de acesso seguro." },
      ]}
      formEyebrow="Cadastro de entregador"
      formTitle="Criar conta para receber corridas"
      formDescription="Sua conta j� nasce pronta para a base compartilhada da plataforma. Se entrar em opera��o fixa, o sistema encaixa depois."
      formIcon={Bike}
      backTo="/"
      backLabel="Voltar para início"
      secondaryTo="/"
      secondaryLabel="Ir para home"
      leftTone="dark"
      formTone="sky"
      quickPoints={["Conta pronta para corridas", "Acesso protegido", "Fluxo de rua otimizado"]}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl><Input autoComplete="name" placeholder="Seu nome" {...field} /></FormControl>
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
                <FormControl><Input type="email" autoComplete="email" placeholder="entregador@email.com" {...field} /></FormControl>
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
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Crie sua senha"
                      className="pr-11"
                      onKeyUp={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
                      onBlur={() => setCapsLockOn(false)}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-100"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                {capsLockOn ? (
                  <p className="text-xs text-amber-700 inline-flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    Caps Lock ativado.
                  </p>
                ) : null}
                <p className="text-xs text-zinc-200">{PASSWORD_RULE}</p>
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
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Repita a senha"
                      className="pr-11"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-100"
                      aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full h-11 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Criando..." : "Criar conta"}
            {!submitting && <UserPlus className="h-4 w-4 ml-2" />}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-zinc-200 leading-relaxed">
        Já tem conta?{" "}
        <Link to="/entregador/login" className="text-zinc-100 font-semibold hover:text-white hover:underline inline-flex items-center gap-1">
          Entrar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </AuthSplitLayout>
  );
}






