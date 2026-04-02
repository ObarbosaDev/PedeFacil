import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import {
  getSecuritySettings,
  isCurrentDeviceTrusted,
  touchCurrentTrustedDevice,
  trustCurrentDevice,
} from "@/lib/account-security";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Lock, LogIn, ShieldCheck, User, WandSparkles } from "lucide-react";
import { getFriendlyAuthError } from "@/lib/auth-errors";
import { trackProductEvent } from "@/lib/product-analytics";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

type FormData = z.infer<typeof schema>;

export default function ClientLogin() {
  const { signIn, signOut, sendEmailOtp, verifyEmailOtp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [trustThisDevice, setTrustThisDevice] = useState(true);

  const nextPathRaw = searchParams.get("next") || "";
  const nextPath = nextPathRaw.startsWith("/") ? nextPathRaw : "/cliente/conta";
  const registerHref = `/cliente/registro${nextPathRaw ? `?next=${encodeURIComponent(nextPathRaw)}` : ""}`;

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const timer = window.setTimeout(() => setOtpResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpResendCooldown]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user && !otpStep) return <Navigate to={nextPath} replace />;

  const onSubmit = async (values: FormData) => {
    const now = Date.now();
    if (blockedUntil && now < blockedUntil) {
      const waitSeconds = Math.ceil((blockedUntil - now) / 1000);
      toast.error(`Muitas tentativas. Aguarde ${waitSeconds}s para tentar de novo.`);
      return;
    }

    try {
      setSubmitting(true);
      await signIn(values.email, values.password);
      const { data: userResponse } = await supabase.auth.getUser();
      const currentUser = userResponse.user;
      if (!currentUser) throw new Error("Sessão inválida após login.");

      const settings = await getSecuritySettings(currentUser.id);
      if (settings.otp_enabled) {
        const trusted = await isCurrentDeviceTrusted(currentUser.id);
        if (!trusted) {
          await sendEmailOtp(values.email);
          await signOut();
          setOtpEmail(values.email.trim().toLowerCase());
          setOtpCode("");
          setOtpResendCooldown(45);
          setOtpStep(true);
          toast.success("Enviamos um código de acesso no seu e-mail.");
          return;
        }
        await touchCurrentTrustedDevice(currentUser.id);
      }

      setFailedAttempts(0);
      setBlockedUntil(null);
      toast.success("Entrou com sucesso. Sua conta já está pronta para usar.");
      void trackProductEvent("funnel_login_success", { role: "customer" });
      navigate(nextPath);
    } catch (error: unknown) {
      const nextFailedAttempts = failedAttempts + 1;
      setFailedAttempts(nextFailedAttempts);
      if (nextFailedAttempts >= 5) {
        setBlockedUntil(Date.now() + 30_000);
      }
      toast.error(getFriendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpEmail || otpCode.trim().length !== 6) {
      toast.error("Digite o código de 6 dígitos.");
      return;
    }

    try {
      setOtpLoading(true);
      await verifyEmailOtp(otpEmail, otpCode);
      const { data: userResponse } = await supabase.auth.getUser();
      const loggedUser = userResponse.user;
      if (!loggedUser) throw new Error("Não rolou validar seu acesso.");

      if (trustThisDevice) {
        await trustCurrentDevice(loggedUser.id);
      }

      toast.success("Código validado. Acesso liberado.");
      void trackProductEvent("funnel_login_success", { role: "customer", method: "otp" });
      navigate(nextPath);
    } catch (error: any) {
      toast.error(getFriendlyAuthError(error));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpEmail || otpResendCooldown > 0) return;

    try {
      setOtpLoading(true);
      await sendEmailOtp(otpEmail);
      setOtpResendCooldown(45);
      toast.success("Código reenviado para seu e-mail.");
    } catch (error: any) {
      toast.error(getFriendlyAuthError(error));
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      leftEyebrow="Área do cliente"
      leftTitle="Seu perfil para pedir sem perder tempo."
      leftDescription="Entre para salvar favoritos, endereço e histórico, e repetir pedidos em poucos cliques."
      leftHighlights={[
        { icon: WandSparkles, text: "Experiência personalizada no seu ritmo." },
        { icon: ShieldCheck, text: "Login seguro e conta protegida." },
      ]}
      formEyebrow="Conta de cliente"
      formTitle={otpStep ? "Confirmação de segurança" : "Entrar na minha conta"}
      formDescription={otpStep ? "Digite o código enviado no seu e-mail." : "Acesse para fechar pedido mais rápido e acompanhar tudo."}
      formIcon={User}
      backTo="/"
      backLabel="Voltar para início"
      secondaryTo="/"
      secondaryLabel="Ir para home"
      leftTone="dark"
      formTone="emerald"
      quickPoints={["Favoritos salvos", "Checkout mais rápido", "Conta protegida"]}
    >
      {!otpStep ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><Input type="email" placeholder="voce@email.com" autoComplete="email" {...field} /></FormControl>
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
                    <Link to="/esqueci-senha" className="text-xs text-orange-400 hover:text-orange-300 hover:underline">
                      Esqueci minha senha
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        autoComplete="current-password"
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-800"
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-11 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              disabled={submitting || (!!blockedUntil && Date.now() < blockedUntil)}
            >
              {submitting ? "Entrando..." : "Entrar"}
              {!submitting && <LogIn className="h-4 w-4 ml-2" />}
            </Button>

            {!!blockedUntil && Date.now() < blockedUntil ? (
              <p className="text-xs text-amber-300" aria-live="polite">
                Muita tentativa em sequência. Aguarde um pouco e tente de novo.
              </p>
            ) : null}

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-xs text-zinc-300">
              <p className="font-semibold">Sua conta protegida</p>
              <p className="mt-1">Bloqueio temporário após tentativas seguidas para proteger seus dados.</p>
            </div>
          </form>
        </Form>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-zinc-200">Confirmação por código</p>
            <p className="text-xs text-zinc-300 mt-1">
              Enviamos um código de 6 dígitos para <span className="font-semibold text-zinc-200">{otpEmail}</span>.
            </p>
          </div>

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={trustThisDevice}
              onChange={(event) => setTrustThisDevice(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
            />
            Confiar neste dispositivo por 30 dias
          </label>

          <div className="flex gap-2">
            <Button className="flex-1 h-11 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" onClick={handleVerifyOtp} disabled={otpLoading || otpCode.trim().length !== 6}>
              {otpLoading ? "Validando..." : "Validar código"}
            </Button>
            <Button variant="outline" onClick={handleResendOtp} disabled={otpLoading || otpResendCooldown > 0}>
              {otpResendCooldown > 0 ? `Reenviar em ${otpResendCooldown}s` : "Reenviar"}
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOtpStep(false);
              setOtpCode("");
            }}
          >
            Voltar para o login
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-zinc-300">
        Não tem conta?{" "}
        <Link to={registerHref} className="text-orange-400 font-semibold hover:text-orange-300 hover:underline inline-flex items-center gap-1">
          Criar conta
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </AuthSplitLayout>
  );
}




