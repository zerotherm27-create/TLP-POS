import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoginScreen from "./components/auth/LoginScreen";

function Gate() {
  const { loading, session, role } = useAuth();
  if (loading) return <div className="min-h-[100dvh] bg-[#f4f6f8]" />;
  if (!session) return <LoginScreen />;
  if (!role) return <LoginScreen noAccess />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </StrictMode>
);

// Register the service worker (installable PWA). Production only, so dev HMR is unaffected.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Keep installed/open copies fresh: when the app comes back to the foreground, check whether a newer
// build was deployed and reload into it (never while someone is typing in a field).
if (import.meta.env.PROD) {
  const current = Array.from(document.scripts).map((el) => el.src).find((src) => /\/assets\/index-[^/]+\.js/.test(src));
  const checkForUpdate = async () => {
    try {
      const html = await (await fetch("/", { cache: "no-store" })).text();
      const latest = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
      if (!latest || !current || current.endsWith(latest)) return;
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (!typing) window.location.reload();
    } catch {
      // offline — keep running the current version
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
  window.setInterval(() => { if (document.visibilityState === "visible") checkForUpdate(); }, 5 * 60_000);
}
