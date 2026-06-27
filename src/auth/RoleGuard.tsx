import type { UserRole } from "@/types";
import { useAuth } from "./useAuth";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard = ({ allowedRoles, children, fallback }: RoleGuardProps) => {
  const { profile, loading } = useAuth();

  if (loading) {
    return null;
  }

  const role = profile?.role;
  const hasAccess = role && allowedRoles.includes(role);

  if (!hasAccess) {
    return (
      fallback ? <>{fallback}</> : (
        <div className="flex flex-col items-center justify-center p-8 text-center text-red-500">
          <p className="font-semibold text-lg">Access Denied</p>
          <p className="text-sm text-gray-400">You do not have permission to view this section.</p>
        </div>
      )
    );
  }

  return <>{children}</>;
};
