import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Role } from "@tlp/shared";
import { supabase } from "../lib/supabase";

interface AuthState {
  loading: boolean;
  session: Session | null;
  /** Comes from the account's app_metadata.role (set by an admin in Supabase). Null = no access. */
  role: Role | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const raw = session?.user.app_metadata?.role;
  const role: Role | null = raw === "admin" || raw === "staff" ? raw : null;

  const value: AuthState = {
    loading,
    session,
    role,
    email: session?.user.email ?? null,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? "Incorrect email or password." : null;
    },
    signOut: async () => { await supabase.auth.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
