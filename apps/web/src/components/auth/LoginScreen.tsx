import { useState } from "react";
import { WashingMachine } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { authConfigured } from "../../lib/supabase";

export const APP_NAME = "LaundroDesk";

export default function LoginScreen({ noAccess }: { noAccess?: boolean }) {
  const { signIn, signOut, email: signedInAs } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email.trim(), password));
    setBusy(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5 bg-[#f4f6f8]">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-zinc-100 p-7" style={{ boxShadow: "0 8px 32px -12px rgba(0,0,0,0.12)" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "#009eb5" }}>
            <WashingMachine size={20} className="text-white" strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[15px] font-bold text-zinc-900 leading-none">{APP_NAME}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Staff & admin sign in</div>
          </div>
        </div>

        {noAccess ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600">
              <strong className="text-zinc-800">{signedInAs}</strong> doesn't have access yet. Ask an admin to assign a role to this account.
            </p>
            <button onClick={signOut} className="h-11 rounded-xl text-sm font-bold text-white" style={{ background: "#009eb5" }}>Sign out</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            {!authConfigured && (
              <p className="text-[12px] text-red-600 bg-red-50 rounded-xl px-3 py-2">Login isn't configured (missing Supabase settings).</p>
            )}
            <input
              type="email" autoComplete="username" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="Email"
              className="h-11 px-3.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5]"
            />
            <input
              type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="h-11 px-3.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5]"
            />
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <button
              type="submit" disabled={busy || !authConfigured}
              className="h-11 rounded-xl text-sm font-bold text-white disabled:opacity-60 active:scale-[0.99] transition-all"
              style={{ background: "#009eb5" }}
            >{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
