import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const authConfigured = !!url && !!anonKey;

// Only the public anon key lives in the browser; the service role key stays server-side.
export const supabase = createClient(url ?? "http://localhost", anonKey ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** fetch() that attaches the signed-in user's access token for /api/* calls. */
export async function authFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
