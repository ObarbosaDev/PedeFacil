import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

const schema = z
  .object({
    password: z.string().regex(passwordRegex, PASSWORD_RULE),
    confirmPassword: z.string().min(8, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
  const { session, loading: authLoading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!authLoading && !session) {
      toast.error("Link inválido ou expirado. Solicite outro link de recuperação.");
    }
  }, [authLoading, session]);

  const onSubmit = async (data: FormData) => {
    try {
      setSaving(true);
      await updatePassword(data.password);
      toast.success("Senha atualizada com sucesso.");
      navigate("/login");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não rolou redefinir sua senha.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthSplitLayout
      leftEyebrow="Segurança da conta"
      leftTitle="Defina uma senha nova e segura."
      leftDescription="Crie uma senha forte e volte para sua conta com acesso protegido."
      leftHighlights={[
        { icon: ShieldCheck, text: "Troca de senha protegida por sessão temporária." },
        { icon: Lock, text: "Senha forte para reduzir risco de acesso indevido." },
      ]}
      formEyebrow="Nova senha"
      formTitle="Redefinir senha"
      formDescription="Crie sua nova senha para entrar normalmente de novo."
      formIcon={Lock}
      backTo="/login"
      backLabel="Voltar para login"
      secondaryTo="/"
      secondaryLabel="Ir para início"
      leftTone="dark"
      formTone="orange"
      quickPoints={["Sessão temporária", "Senha forte", "Acesso protegido"]}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua nova senha"
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
                <p className="text-xs text-zinc-300">{PASSWORD_RULE}</p>
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
                      placeholder="Repita a nova senha"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-800"
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

          <Button type="submit" className="w-full h-11 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" disabled={saving || authLoading || !session}>
            {saving ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-zinc-300 leading-relaxed">
        <Link to="/login" className="text-zinc-100 font-semibold hover:text-white hover:underline inline-flex items-center gap-1">
          Voltar para login <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
