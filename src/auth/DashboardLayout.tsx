import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { usePermissions } from "@/hooks/usePermissions";
import { ChatDock } from "@/modules/chat/ChatDock";
import { useAuth } from "@/auth/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";
import { UserCheck, RefreshCw, Eye } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

const PAGE_LABELS: Record<string, { title: string; area: string }> = {
  "/": { title: "Dashboard", area: "Resumen operativo" },
  "/prospectos": { title: "Prospectos", area: "Gestión comercial" },
  "/burn": { title: "Burn", area: "Depuración y auditoría" },
  "/negociaciones": { title: "Negociaciones", area: "Pipeline de inversión" },
  "/contactos": { title: "Contactos", area: "Directorio comercial" },
  "/equipo": { title: "Equipo", area: "Directorio interno" },
  "/cumplimiento": { title: "Revisión Total", area: "Cumplimiento" },
  "/contact-center": { title: "Contact Center", area: "Operación telefónica" },
  "/chat": { title: "Chat interno", area: "Colaboración" },
  "/import-export": { title: "Importar / Exportar", area: "Administración de datos" },
  "/admin": { title: "Administración", area: "Configuración y acceso" },
};

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { originalProfile, profile, impersonate } = useAuth();
  const location = useLocation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const canAudit = originalProfile?.role === "SUPERADMIN" || originalProfile?.role === "MANAGER" || originalProfile?.role === "SUPERVISOR";
  const { auditBlocked } = usePermissions();

  // Radix locks the page with `pointer-events: none` on <body> while a dialog or
  // sheet is open and releases it on close. Switching perspective unmounts those
  // panels abruptly, so the lock can survive with nothing left to close and the
  // whole app stops responding to clicks. Release it whenever no Radix overlay
  // is actually mounted.
  useEffect(() => {
    const release = () => {
      const hasOverlay = document.querySelector("[data-radix-popper-content-wrapper], [role='dialog'][data-state='open']");
      if (!hasOverlay && document.body.style.pointerEvents === "none") {
        document.body.style.removeProperty("pointer-events");
      }
    };
    release();
    const timer = window.setInterval(release, 700);
    return () => window.clearInterval(timer);
  }, []);
  const isImpersonating = Boolean(originalProfile && profile && originalProfile.id !== profile.id);
  const pageLabel = PAGE_LABELS[location.pathname] ?? { title: "Delta Capital", area: "CRM" };

  useEffect(() => {
    if (canAudit) {
      let query = supabase
        .from("profiles")
        .select("id,email,first_name,last_name,role,department,team_id,active,last_seen_at,created_at,updated_at")
        .not("is_trading_client", "is", true)
        .neq("id", originalProfile?.id || "")
        .eq("active", true);
        
      if (originalProfile?.role === "MANAGER") {
        query = query
          .eq("department", originalProfile.department)
          .in("role", ["SUPERVISOR", "AGENT"]);
      } else if (originalProfile?.role === "SUPERVISOR") {
        if (!originalProfile.team_id) {
          setProfiles([]);
          return;
        }
        query = query
          .eq("team_id", originalProfile.team_id)
          .eq("role", "AGENT");
      }

      query.then(({ data }) => {
        if (data) setProfiles(data as Profile[]);
      });
    }
  }, [
    canAudit,
    originalProfile?.id,
    originalProfile?.role,
    originalProfile?.department,
    originalProfile?.team_id,
  ]);

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
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Saltar al contenido
      </a>
      <div className="flex min-h-screen w-full app-bg">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Animated market gradient line */}
          <div className="market-gradient-line" />

          {/* Audit mode banner */}
          {isImpersonating && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <span>
                  {auditBlocked ? "Vista simulada de solo lectura" : "Vista simulada con edición"}: perspectiva de{" "}
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
                className="flex min-h-9 items-center gap-1.5 rounded-lg bg-background px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-card"
              >
                <RefreshCw className="h-3 w-3" /> Revertir Vista
              </button>
            </div>
          )}

          {/* Sticky glassmorphic header */}
          <header className="sticky top-0 z-40 header-glass flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="app-icon-button h-11 w-11" />
              <div className="hidden h-7 w-px bg-border sm:block" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{pageLabel.title}</p>
                <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{pageLabel.area}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {canAudit && (
              <div className="hidden items-center gap-2 lg:flex">
                <Eye className="h-3.5 w-3.5 text-primary opacity-70" aria-hidden="true" />
                <select
                  value={selectedId}
                  onChange={(e) => handleImpersonateChange(e.target.value)}
                  aria-label="Auditar perspectiva de usuario"
                  className="h-10 w-56 rounded-lg border border-border bg-card px-3 text-xs font-medium text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
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
              <NotificationCenter />
              <ThemeSwitcher />
            </div>
          </header>

          {/* Main content */}
          <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
            <div
              className={auditBlocked ? "pointer-events-none opacity-[0.96]" : undefined}
              aria-disabled={auditBlocked || undefined}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
      {!location.pathname.startsWith("/chat") && <ChatDock />}
    </SidebarProvider>
  );
};
