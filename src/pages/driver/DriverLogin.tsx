import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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
import { ArrowRight, Bike, Eye, EyeOff, Lock, LogIn, ShieldCheck, Truck } from "lucide-react";
import { getFriendlyAuthError } from "@/lib/auth-errors";
import { trackProductEvent } from "@/lib/product-analytics";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

type FormData = z.infer<typeof schema>;

export default function DriverLogin() {
  const { signIn, signOut, sendEmailOtp, verifyEmailOtp, user, loading } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const timer = window.setTimeout(() => setOtpResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpResendCooldown]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user && !otpStep) return <Navigate to="/entregador" replace />;

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
      void trackProductEvent("funnel_login_success", { role: "delivery_driver" });
      navigate("/entregador");
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
      void trackProductEvent("funnel_login_success", { role: "delivery_driver", method: "otp" });
      navigate("/entregador");
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
      leftEyebrow="Área do entregador"
      leftTitle="Seu painel de rua, rápido e direto."
      leftDescription="Entre para aceitar corridas, atualizar status e concluir entregas com segurança."
      leftHighlights={[
        { icon: Truck, text: "Tudo que você precisa para rodar no dia a dia." },
        { icon: ShieldCheck, text: "Fluxo seguro com confirmação final da entrega." },
      ]}
      formEyebrow="Acesso do entregador"
      formTitle={otpStep ? "Confirmação de segurança" : "Entrar para pegar corridas"}
      formDescription={otpStep ? "Digite o código enviado no seu e-mail." : "Acesse sua conta para ver e atualizar entregas."}
      formIcon={Bike}
      backTo="/"
      backLabel="Voltar para início"
      secondaryTo="/"
      secondaryLabel="Ir para home"
      leftTone="dark"
      formTone="sky"
      quickPoints={["Status em tempo real", "Confirmação segura", "Fluxo rápido na rua"]}
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
                        autoComplete="current-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="Digite sua senha"
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
              <p className="font-semibold">Segurança na operação</p>
              <p className="mt-1">Tentativas seguidas geram bloqueio temporário para proteger a conta do entregador.</p>
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
        Primeiro acesso?{" "}
        <Link to="/entregador/registro" className="text-orange-400 font-semibold hover:text-orange-300 hover:underline inline-flex items-center gap-1">
          Criar conta
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </AuthSplitLayout>
  );
}




