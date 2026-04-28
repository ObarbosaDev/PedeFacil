import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import PageLoader from "@/components/system/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { getFriendlyAuthError } from "@/lib/auth-errors";
import { getUserRole } from "@/lib/auth-role";

const homeByRole = {
  store_owner: "/admin",
  customer: "/cliente/conta",
  delivery_driver: "/entregador",
  unknown: "/login",
} as const;

function resolveFallbackRoute(requestedNext: string | null) {
  if (requestedNext?.startsWith("/cliente")) return "/cliente/login";
  if (requestedNext?.startsWith("/entregador")) return "/entregador/login";
  return "/login";
}

function readHashParams() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let alive = true;

    const finishAuth = async () => {
      try {
        const code = searchParams.get("code");
        const next = searchParams.get("next");
        const requestedNext = next && next.startsWith("/") ? next : null;
        const fallback = resolveFallbackRoute(requestedNext);
        const hashParams = readHashParams();
        const hashAccessToken = hashParams.get("access_token");
        const hashRefreshToken = hashParams.get("refresh_token");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        if (hashAccessToken && hashRefreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });
          if (error) throw error;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!alive) return;

        const user = session?.user ?? null;
        if (!user) {
          toast.error("Nao conseguimos validar seu e-mail agora. Tenta entrar de novo.");
          navigate(fallback, { replace: true });
          return;
        }

        const role = getUserRole(user);
        const target = requestedNext || homeByRole[role];

        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        toast.success("E-mail confirmado. Seu acesso ja esta liberado.");
        navigate(target, { replace: true });
      } catch (error) {
        if (!alive) return;
        toast.error(getFriendlyAuthError(error));
        const next = searchParams.get("next");
        const requestedNext = next && next.startsWith("/") ? next : null;
        navigate(resolveFallbackRoute(requestedNext), { replace: true });
      }
    };

    void finishAuth();

    return () => {
      alive = false;
    };
  }, [navigate, searchParams]);

  return <PageLoader label="Confirmando seu acesso..." className="min-h-[70vh]" />;
}
