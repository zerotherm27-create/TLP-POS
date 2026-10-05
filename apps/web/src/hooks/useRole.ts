import { useState } from "react";
import type { Role } from "@tlp/shared";

export function useRole() {
  const [role, setRole] = useState<Role>("cashier");
  const isAdmin = role === "admin";
  const elevateToAdmin = () => setRole("admin");
  const demote = () => setRole("cashier");
  return { role, isAdmin, elevateToAdmin, demote };
}
