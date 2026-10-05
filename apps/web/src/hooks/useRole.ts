import { useState } from "react";
import type { Role } from "@tlp/shared";

export function useRole() {
  const [role, setRole] = useState<Role>("staff");
  const isAdmin = role === "admin";
  const elevateToAdmin = () => setRole("admin");
  const demote = () => setRole("staff");
  return { role, isAdmin, elevateToAdmin, demote };
}
