import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import {
  getResetBlockSeconds,
  getSignInBlockSeconds,
  registerResetFailure,
  registerResetSuccess,
  registerSignInFailure,
  registerSignInSuccess,
} from "@/lib/auth-security";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signUpClient: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  signUpDeliveryDriver: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  confirmPassword: (password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutAllSessions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const normalizeEmail = (email: string) => email.trim().toLowerCase();
  const buildEmailRedirectTo = (targetPath: string) => {
    const params = new URLSearchParams({ next: targetPath });
    const baseUrl = env.VITE_PUBLIC_APP_URL || window.location.origin;
    return `${baseUrl}/auth/callback?${params.toString()}`;
  };
  const buildAuthEmailMetadata = (fullName: string, userType: "store_owner" | "customer" | "delivery_driver", extra?: Record<string, unknown>) => {
    const roleLabel =
      userType === "store_owner" ? "lojista" : userType === "customer" ? "cliente" : "entregador";

    return {
      full_name: fullName,
      user_type: userType,
      role_label: roleLabel,
      app_name: "Pede Fácil",
      product_name: "Pede Fácil",
      support_phone: "+55 (61) 9 8462-9093",
      confirmation_cta: "Confirmar e entrar",
      email_preheader: "Confirme seu acesso para liberar sua conta no Pede Fácil.",
      ...extra,
    };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: buildAuthEmailMetadata(fullName, "store_owner"),
        emailRedirectTo: buildEmailRedirectTo("/admin"),
      },
    });
    if (error) throw error;
  };

  const signUpClient = async (email: string, password: string, fullName: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: buildAuthEmailMetadata(fullName, "customer", { phone: phone || null }),
        emailRedirectTo: buildEmailRedirectTo("/cliente/conta"),
      },
    });
    if (error) throw error;
  };

  const signUpDeliveryDriver = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: buildAuthEmailMetadata(fullName, "delivery_driver"),
        emailRedirectTo: buildEmailRedirectTo("/entregador"),
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const blockedSeconds = getSignInBlockSeconds();
    if (blockedSeconds > 0) {
      throw new Error(`Muitas tentativas. Aguarde ${blockedSeconds}s para tentar novamente.`);
    }

    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) {
      registerSignInFailure();
      throw error;
    }
    registerSignInSuccess();
  };

  const sendEmailOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: {
        shouldCreateUser: false,
      },
    });
    if (error) throw error;
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: token.trim(),
      type: "email",
    });
    if (error) throw error;
  };

  const confirmPassword = async (password: string) => {
    if (!user?.email) throw new Error("Usuário sem e-mail para confirmação.");
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(user.email),
      password,
    });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const blockedSeconds = getResetBlockSeconds();
    if (blockedSeconds > 0) {
      throw new Error(`Aguarde ${blockedSeconds}s para solicitar outro link.`);
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${env.VITE_PUBLIC_APP_URL || window.location.origin}/redefinir-senha`,
    });
    if (error) {
      registerResetFailure();
      throw error;
    }
    registerResetSuccess();
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const signOutAllSessions = async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signUpClient,
        signUpDeliveryDriver,
        signIn,
        sendEmailOtp,
        verifyEmailOtp,
        confirmPassword,
        resetPassword,
        updatePassword,
        signOut,
        signOutAllSessions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

