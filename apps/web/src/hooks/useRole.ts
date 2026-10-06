import { useAuth } from "./useAuth";

export function useRole() {
  const { role, signOut } = useAuth();
  return { role: role ?? "staff", isAdmin: role === "admin", signOut };
}
