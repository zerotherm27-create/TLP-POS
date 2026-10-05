import { useState } from "react";
import type { Role } from "@tlp/shared";

export function useRole() {
  const [role, setRole] = useState<Role>("cashier");
  const toggleRole = () => setRole((r) => (r === "cashier" ? "admin" : "cashier"));
  const isAdmin = role === "admin";
  return { role, setRole, toggleRole, isAdmin };
}
