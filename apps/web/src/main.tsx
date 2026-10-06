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
