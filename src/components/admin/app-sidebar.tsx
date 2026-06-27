import { Link, useMatch } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/auth/useAuth";
import {
  LayoutDashboard,
  UserPlus,
  Kanban,
  Users,
  PhoneCall,
  MessageSquare,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MenuItem {
  label: string;
  path: string;
  icon: LucideIcon;
  visible: boolean;
}

interface NavItemProps {
  item: MenuItem;
  onClick: () => void;
}

const NavItem = ({ item, onClick }: NavItemProps) => {
  const match = useMatch({ path: item.path, end: item.path === "/" });
  const isActive = !!match;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={`rounded-lg transition-all duration-200 group/navitem ${
          isActive
            ? "nav-item-active"
            : "text-[#6B7FA3] hover:text-[#D4AF37] hover:bg-[rgba(212,175,55,0.06)]"
        }`}
      >
        <Link
          to={item.path}
          onClick={onClick}
          className="flex items-center gap-3 px-3 py-2.5"
        >
          <div
            className={`flex items-center justify-center h-7 w-7 rounded-md shrink-0 transition-all duration-200 ${
              isActive
                ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                : "text-current group-hover/navitem:bg-[rgba(212,175,55,0.08)]"
            }`}
          >
            <item.icon className="h-4 w-4" />
          </div>
          <span
            className={`text-sm group-data-[collapsible=icon]:hidden transition-all duration-200 ${
              isActive ? "font-semibold tracking-wide text-[#D4AF37]" : "font-medium"
            }`}
          >
            {item.label}
          </span>
          {isActive && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37] group-data-[collapsible=icon]:hidden shrink-0" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

export function AppSidebar() {
  const { profile, logout } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const { openMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (openMobile) {
      setOpenMobile(false);
    }
  };

  const menuItems: MenuItem[] = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard, visible: true },
    { label: "Prospectos", path: "/prospectos", icon: UserPlus, visible: true },
    { label: "Negociaciones", path: "/negociaciones", icon: Kanban, visible: true },
    { label: "Contactos", path: "/contactos", icon: Users, visible: true },
    { label: "Contact Center", path: "/contact-center", icon: PhoneCall, visible: true },
    { label: "Chat Interno", path: "/chat", icon: MessageSquare, visible: true },
    { label: "Admin", path: "/admin", icon: ShieldAlert, visible: isSuperAdmin },
  ];

  const initials =
    profile
      ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase()
      : "?";

  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      className="border-r-0 bg-transparent text-[#F8FAFC]"
      style={{
        background: "linear-gradient(180deg, #080E20 0%, #0A1228 100%)",
        borderRight: "1px solid rgba(212,175,55,0.1)",
      }}
    >
      {/* Brand Header */}
      <SidebarHeader className="p-4 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="hover:bg-[rgba(212,175,55,0.05)] rounded-xl h-auto p-2"
            >
              <Link to="/" className="flex items-center gap-3">
                {/* Logo with glow ring */}
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.06)] shadow-[0_0_16px_rgba(212,175,55,0.15)]">
                  <img
                    src="/logo.png"
                    alt="Delta Capital"
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Brand text */}
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <span className="font-title text-sm font-bold tracking-[0.12em] text-[#D4AF37]">
                    DELTA CAPITAL
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="live-dot" />
                    <span className="text-[9px] tracking-[0.18em] text-[#4A6080] font-medium uppercase">
                      Sistema Activo
                    </span>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Gradient divider */}
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.25)] to-transparent group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="py-3 px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {menuItems
                .filter((item) => item.visible)
                .map((item) => (
                  <NavItem key={item.label} item={item} onClick={handleClick} />
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3">
        <div className="mt-1 h-px bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.15)] to-transparent mb-3 group-data-[collapsible=icon]:hidden" />

        <div className="flex flex-col gap-2">
          {profile && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg group-data-[collapsible=icon]:hidden">
              {/* Initials avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[rgba(212,175,55,0.25)] to-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.25)] text-[#D4AF37] text-xs font-bold font-title shadow-[0_0_10px_rgba(212,175,55,0.12)]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#E2E8F0] truncate">
                  {profile.first_name} {profile.last_name}
                </div>
                <div className="text-[10px] text-[#D4AF37] font-semibold mt-0.5 tracking-wider uppercase">
                  {profile.role}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#6B7FA3] hover:text-red-400 hover:bg-[rgba(239,68,68,0.07)] rounded-lg transition-all duration-200 w-full text-left"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Cerrar sesión</span>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
