import { useAuth } from "@/auth/useAuth";

export const usePermissions = () => {
  const { profile } = useAuth();

  const role = profile?.role;

  return {
    role,
    isSuperAdmin: role === "SUPERADMIN",
    isManager: role === "MANAGER",
    isAgent: role === "AGENT",
    isSupervisor: role === "SUPERVISOR",
    
    canDelete: role === "SUPERADMIN",
    canEditAll: ["SUPERADMIN", "MANAGER"].includes(role || ""),
    canEditOwn: ["AGENT"].includes(role || ""),
    canReadTeam: ["SUPERADMIN", "MANAGER", "SUPERVISOR"].includes(role || ""),
  };
};
