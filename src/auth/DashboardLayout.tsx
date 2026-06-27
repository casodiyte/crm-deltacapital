import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { useAuth } from "@/auth/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";
import { UserCheck, RefreshCw, Eye } from "lucide-react";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { originalProfile, profile, impersonate } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const isSuperAdmin = originalProfile?.role === "SUPERADMIN";
  const isImpersonating = originalProfile?.id !== profile?.id;

  useEffect(() => {
    if (isSuperAdmin) {
      supabase
        .from("profiles")
        .select("*")
        .neq("id", originalProfile?.id || "")
        .then(({ data }) => {
          if (data) setProfiles(data as Profile[]);
        });
    }
  }, [isSuperAdmin, originalProfile?.id]);

  const handleImpersonateChange = (userId: string) => {
    if (!userId) {
      impersonate(null);
      setSelectedId("");
      return;
    }
    const target = profiles.find((p) => p.id === userId);
    if (target) {
      impersonate(target);
      setSelectedId(userId);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-screen app-bg">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Animated market gradient line */}
          <div className="market-gradient-line" />

          {/* Audit mode banner */}
          {isImpersonating && (
            <div className="bg-gradient-to-r from-[#D4AF37] to-[#C49B27] text-[#050814] px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <span>
                  Modo Auditoría Activo: Emulando vista de{" "}
                  <strong>
                    {profile?.first_name} {profile?.last_name}
                  </strong>{" "}
                  ({profile?.role})
                </span>
              </div>
              <button
                onClick={() => {
                  impersonate(null);
                  setSelectedId("");
                }}
                className="bg-[#050814] text-[#D4AF37] px-3 py-1 rounded-lg font-bold hover:bg-[#111A33] transition-colors flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className="h-3 w-3" /> Revertir Vista
              </button>
            </div>
          )}

          {/* Sticky glassmorphic header */}
          <header className="sticky top-0 z-40 header-glass flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-[#94A3B8] hover:text-[#D4AF37] hover:bg-[rgba(212,175,55,0.08)] rounded-lg transition-all duration-200 h-8 w-8" />
              <div className="h-4 w-px bg-[rgba(212,175,55,0.2)] hidden md:block" />
              <span className="font-title text-xs font-bold text-[#4A6080] tracking-[0.2em] uppercase hidden md:inline-block">
                DELTA CAPITAL
              </span>
            </div>

            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-[#D4AF37] hidden sm:inline opacity-70" />
                <select
                  value={selectedId}
                  onChange={(e) => handleImpersonateChange(e.target.value)}
                  className="px-3 py-1.5 w-52 text-xs bg-[rgba(17,26,51,0.8)] border border-[rgba(212,175,55,0.2)] rounded-lg text-[#D4AF37] font-medium focus:outline-none focus:border-[rgba(212,175,55,0.5)] focus:ring-1 focus:ring-[rgba(212,175,55,0.2)] transition-all backdrop-blur"
                >
                  <option value="">Auditar perspectiva...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </header>

          {/* Main content */}
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
};
