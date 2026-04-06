import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, UserPlus, WandSparkles } from "lucide-react";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";
import { trackProductEvent } from "@/lib/product-analytics";

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

export default function ClientRegister() {
  const { signUpClient, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const prefill = useMemo(() => {
    const fullName = searchParams.get("name")?.trim() || "";
    const email = searchParams.get("email")?.trim().toLowerCase() || "";
    const phone = searchParams.get("phone")?.trim() || "";
    const fromCheckout = searchParams.get("from") === "checkout";
    const nextRaw = searchParams.get("next") || "";
    const nextPath = nextRaw.startsWith("/") ? nextRaw : "/cliente/conta";
    return { fullName, email, phone, fromCheckout, nextRaw, nextPath };
  }, [searchParams]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: prefill.fullName, email: prefill.email, password: "", confirmPassword: "" },
  });

  if (!loading && user) return <Navigate to={prefill.nextPath} replace />;

  const onSubmit = async (values: FormData) => {
    try {
      setSubmitting(true);
      await signUpClient(values.email, values.password, values.fullName.trim(), prefill.phone || undefined);
      toast.success("Conta criada. Confere seu e-mail para confirmar o acesso.");
      void trackProductEvent("funnel_account_created", { role: "customer" });
      navigate(`/cliente/login${prefill.nextRaw ? `?next=${encodeURIComponent(prefill.nextRaw)}` : ""}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não rolou criar sua conta agora.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      leftEyebrow="Área do cliente"
      leftTitle="Crie seu perfil e personalize seus pedidos."
      leftDescription="Com sua conta, você salva endereço, acompanha histórico e refaz pedido em segundos."
      leftHighlights={[
        { icon: WandSparkles, text: "Experiência personalizada de verdade." },
        { icon: ShieldCheck, text: "Conta segura e dados protegidos." },
      ]}
      formEyebrow="Conta de cliente"
      formTitle={prefill.fromCheckout ? "Bora finalizar sua conta?" : "Criar minha conta"}
      formDescription={
        prefill.fromCheckout
          ? "Você está quase finalizando seu pedido. Crie sua conta para concluir com segurança."
          : "Salve seus dados e deixe os próximos pedidos bem mais rápidos."
      }
      formIcon={UserPlus}
      backTo="/"
      backLabel="Voltar para início"
      secondaryTo="/"
      secondaryLabel="Ir para home"
      leftTone="dark"
      formTone="emerald"
      quickPoints={["Cadastro rápido", "Dados protegidos", "Finalização sem fricção"]}
    >
      {prefill.fromCheckout && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-xs text-zinc-200 mb-4">Cadastro rápido: já puxamos parte dos dados do checkout para você terminar isso em segundos.
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl><Input placeholder="Seu nome" autoComplete="name" {...field} /></FormControl>
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
                  <FormControl><Input type="email" placeholder="seuemail@exemplo.com" autoComplete="email" {...field} /></FormControl>
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
                      placeholder="Crie uma senha"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
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
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
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
            {submitting ? "Criando conta..." : "Criar conta"}
            {!submitting && <UserPlus className="h-4 w-4 ml-2" />}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-zinc-200 leading-relaxed">
        Já tem conta?{" "}
        <Link to={`/cliente/login${prefill.nextRaw ? `?next=${encodeURIComponent(prefill.nextRaw)}` : ""}`} className="text-zinc-100 font-semibold hover:text-white hover:underline inline-flex items-center gap-1">
          Entrar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </AuthSplitLayout>
  );
}






