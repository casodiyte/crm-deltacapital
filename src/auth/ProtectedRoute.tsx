import { useAuth } from "./useAuth";
import { Navigate } from "react-router";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080D1C] text-[#D4AF37]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is authenticated in Supabase Auth but has no record in public.profiles table
  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#080D1C] text-center p-6 space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500 bg-red-950/20 text-red-500 text-xl font-bold">
          !
        </div>
        <h1 className="text-xl font-title text-[#D4AF37] font-bold">Perfil No Encontrado</h1>
        <p className="text-xs text-[#94A3B8] max-w-sm leading-relaxed">
          Tu cuenta de autenticación está activa, pero no se ha encontrado un perfil comercial asociado en la tabla <code>profiles</code>.
        </p>
        <div className="flex gap-3">
          <button 
            onClick={logout}
            className="gold-button-secondary px-4 py-2 text-xs font-semibold rounded"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
