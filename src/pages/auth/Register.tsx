import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, Eye, EyeOff, Lock, Rocket, Store, Users } from "lucide-react";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";
import { trackProductEvent } from "@/lib/product-analytics";

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Minimo 2 caracteres").max(100),
    email: z.string().trim().email("E-mail invalido"),
    password: z.string().regex(passwordRegex, PASSWORD_RULE),
    confirmPassword: z.string().min(8, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao conferem.",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setLoading(true);
      await signUp(data.email, data.password, data.fullName.trim());
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      void trackProductEvent("funnel_account_created", { role: "store_owner" });
      const next = searchParams.get("next");
      const safeNext = next && next.startsWith("/") ? next : "/admin";
      navigate(`/login?next=${encodeURIComponent(safeNext)}`);
    } catch (err: any) {
      toast.error(err.message || "Nao rolou criar sua conta agora.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      leftEyebrow="Cadastro de lojista"
      leftTitle="Coloque sua loja no jogo em poucos minutos."
      leftDescription="Crie sua conta, suba seu cardapio e comece a operar com um painel pronto para crescer junto."
      leftHighlights={[
        { icon: Rocket, text: "Setup rapido, sem dor de cabeca." },
        { icon: BadgeCheck, text: "Fluxo de operacao ja organizado desde o primeiro dia." },
        { icon: Users, text: "Experiencia de compra que incentiva recompra." },
      ]}
      formEyebrow="Cadastro de lojista"
      formTitle="Criar minha conta"
      formDescription="Crie a conta, escolha o plano e libera o painel sem enrolacao."
      formIcon={Store}
      backTo="/"
      backLabel="Voltar para inicio"
      secondaryTo="/"
      secondaryLabel="Ir para home"
      leftTone="dark"
      formTone="orange"
      quickPoints={["Onboarding rapido", "Conta protegida", "Ativacao sem gambiarra"]}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Joao Silva" autoComplete="name" {...field} />
                </FormControl>
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
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Crie uma senha forte"
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
                  <p className="inline-flex items-center gap-1 text-xs text-amber-700">
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
                      placeholder="Repita sua senha"
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
                      aria-label={showConfirmPassword ? "Ocultar confirmacao de senha" : "Mostrar confirmacao de senha"}
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
            className="h-11 w-full cursor-pointer bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Criando conta..." : "Criar conta gratis"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm leading-relaxed text-zinc-200">
        Ja tem conta?{" "}
        <Link
          to={`/login${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next") || "")}` : ""}`}
          className="font-semibold text-zinc-100 hover:text-white hover:underline"
        >
          Entrar agora
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
