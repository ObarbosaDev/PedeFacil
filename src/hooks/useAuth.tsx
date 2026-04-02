import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: { full_name: fullName, user_type: "store_owner" },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;
  };

  const signUpClient = async (email: string, password: string, fullName: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: { full_name: fullName, user_type: "customer", phone: phone || null },
        emailRedirectTo: `${window.location.origin}/cliente/login`,
      },
    });
    if (error) throw error;
  };

  const signUpDeliveryDriver = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: { full_name: fullName, user_type: "delivery_driver" },
        emailRedirectTo: `${window.location.origin}/entregador/login`,
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
      redirectTo: `${window.location.origin}/redefinir-senha`,
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

