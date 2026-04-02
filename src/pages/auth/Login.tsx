import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { ArrowRight, BarChart3, Eye, EyeOff, Lock, MessageCircle, ShieldCheck, Store } from "lucide-react";
import { getFriendlyAuthError } from "@/lib/auth-errors";
import { trackProductEvent } from "@/lib/product-analytics";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { signIn, signOut, sendEmailOtp, verifyEmailOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
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

  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/admin";

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const timer = window.setTimeout(() => setOtpResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpResendCooldown]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    const now = Date.now();
    if (blockedUntil && now < blockedUntil) {
      const waitSeconds = Math.ceil((blockedUntil - now) / 1000);
      toast.error(`Muitas tentativas. Aguarde ${waitSeconds}s para tentar de novo.`);
      return;
    }

    try {
      setLoading(true);
      await signIn(data.email, data.password);
      const { data: userResponse } = await supabase.auth.getUser();
      const currentUser = userResponse.user;
      if (!currentUser) throw new Error("Sessão inválida após login.");

      const settings = await getSecuritySettings(currentUser.id);
      if (settings.otp_enabled) {
        const trusted = await isCurrentDeviceTrusted(currentUser.id);
        if (!trusted) {
          await sendEmailOtp(data.email);
          await signOut();
          setOtpEmail(data.email.trim().toLowerCase());
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
      void trackProductEvent("funnel_login_success", { role: "store_owner" });
      navigate(safeNext);
    } catch (error: unknown) {
      const nextFailedAttempts = failedAttempts + 1;
      setFailedAttempts(nextFailedAttempts);
      if (nextFailedAttempts >= 5) {
        const cooldownMs = 30_000;
        setBlockedUntil(Date.now() + cooldownMs);
      }
      toast.error(getFriendlyAuthError(error));
    } finally {
      setLoading(false);
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
      void trackProductEvent("funnel_login_success", { role: "store_owner", method: "otp" });
      navigate(safeNext);
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
      leftEyebrow="Acesso do lojista"
      leftTitle="Seu painel de pedidos, com cara de operação grande."
      leftDescription="Entre para acompanhar pedidos, atualizar cardápio e tocar a loja com visão clara do que importa."
      leftHighlights={[
        { icon: MessageCircle, text: "Pedido chega no WhatsApp já organizadinho." },
        { icon: BarChart3, text: "Leitura da operação em tempo real, sem adivinhação." },
        { icon: ShieldCheck, text: "Acesso seguro com proteção contra tentativas excessivas." },
      ]}
      formEyebrow="Acesso do lojista"
      formTitle={otpStep ? "Confirmação de segurança" : "Bora entrar no painel?"}
      formDescription={otpStep ? "Digite o código enviado no e-mail para liberar seu acesso." : "Coloque seus dados e continue de onde parou."}
      formIcon={Store}
      backTo="/"
      backLabel="Voltar para início"
      secondaryTo="/"
      secondaryLabel="Ir para home"
      leftTone="dark"
      formTone="orange"
      quickPoints={["Sessão protegida", "Bloqueio anti-força bruta", "Acesso imediato ao painel"]}
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
                  <FormControl>
                    <Input type="email" placeholder="seuemail@empresa.com" autoComplete="email" {...field} />
                  </FormControl>
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
                    <Link to="/esqueci-senha" className="text-xs text-zinc-300 hover:text-zinc-100 hover:underline">
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
              className="w-full h-11 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading || (!!blockedUntil && Date.now() < blockedUntil)}
              aria-busy={loading}
            >
              {loading ? "Entrando..." : "Entrar no painel"}
              {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>

            {!!blockedUntil && Date.now() < blockedUntil ? (
              <p className="text-xs text-amber-200" aria-live="polite">
                Muita tentativa em sequência. Aguarde um pouco e tente de novo.
              </p>
            ) : null}

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-xs text-zinc-300">
              <p className="font-semibold">Proteção ativa</p>
              <p className="mt-1">Bloqueio temporário após tentativas seguidas e autenticação com sessão segura.</p>
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

      <p className="text-center text-sm text-zinc-300 leading-relaxed">
        Ainda não tem conta?{" "}
        <Link
          to={`/registro${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next") || "")}` : ""}`}
          className="text-zinc-100 font-semibold hover:text-white hover:underline"
        >
          Criar conta grátis
        </Link>
      </p>
    </AuthSplitLayout>
  );
}




