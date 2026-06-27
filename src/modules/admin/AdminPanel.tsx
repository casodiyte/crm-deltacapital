import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import type { Profile } from "@/types";
import { Link } from "react-router";
import { Edit3, UserCheck, UserMinus, ShieldAlert, Shield, UserPlus } from "lucide-react";

export const AdminPanel = () => {
  const { profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit role dialog state
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("AGENT");
  const [editActive, setEditActive] = useState<boolean>(true);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProfiles(data as Profile[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleSaveProfileChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: editRole as any,
          active: editActive,
        })
        .eq("id", editingProfile.id);

      if (!error) {
        setEditingProfile(null);
        fetchProfiles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (profile: Profile) => {
    const nextActive = !profile.active;
    // Optimistic Update
    setProfiles(profiles.map(p => p.id === profile.id ? { ...p, active: nextActive } : p));
    try {
      await supabase.from("profiles").update({ active: nextActive }).eq("id", profile.id);
    } catch (err) {
      console.error(err);
      fetchProfiles();
    }
  };

  return (
    <div className="space-y-6 p-6 bg-[#050814] min-h-screen text-[#F8FAFC]">
      {/* Header */}
      <div className="border-b border-[rgba(212,175,55,0.15)] pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-[#D4AF37]" />
          <div>
            <h1 className="text-2xl font-title font-bold text-[#F8FAFC]">Panel de Administración del CRM</h1>
            <p className="text-xs text-[#94A3B8] mt-1">Control de accesos corporativos y auditorías de rol</p>
          </div>
        </div>
        <Link 
          to="/register-kovex-internal"
          className="gold-button-primary px-4 py-2 text-xs font-semibold rounded flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" /> Registrar Usuario
        </Link>
      </div>

      {/* Profiles list */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="text-center p-20 text-[#D4AF37] text-xs">Cargando perfiles corporativos...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[rgba(212,175,55,0.2)] bg-[#0D1428] text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">
                <th className="p-4">Usuario</th>
                <th className="p-4">Email</th>
                <th className="p-4">Rol en el Sistema</th>
                <th className="p-4">Estado de Cuenta</th>
                <th className="p-4">Último Acceso</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((prof) => (
                <tr key={prof.id} className="border-b border-[rgba(255,255,255,0.05)] table-row-hover transition-all text-sm">
                  <td className="p-4 font-semibold text-[#F8FAFC]">
                    {prof.first_name} {prof.last_name}
                  </td>
                  <td className="p-4 text-[#94A3B8] font-mono">{prof.email}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[rgba(212,175,55,0.05)] border border-[rgba(212,175,55,0.2)] text-[#D4AF37]">
                      {prof.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      prof.active ? "bg-green-950/20 text-green-400" : "bg-red-950/20 text-red-400"
                    }`}>
                      {prof.active ? "Activo" : "Inhabilitado"}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-[#94A3B8] font-mono">
                    {prof.last_seen_at ? new Date(prof.last_seen_at).toLocaleString() : "-"}
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-3">
                    <button 
                      onClick={() => {
                        setEditingProfile(prof);
                        setEditRole(prof.role);
                        setEditActive(prof.active);
                      }}
                      className="p-1 hover:text-[#D4AF37] text-[#94A3B8]"
                      title="Editar rol"
                      disabled={prof.id === currentProfile?.id}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleToggleActive(prof)}
                      className={`p-1 ${prof.active ? "hover:text-red-400 text-green-400" : "hover:text-green-400 text-red-400"}`}
                      title={prof.active ? "Desactivar" : "Activar"}
                      disabled={prof.id === currentProfile?.id}
                    >
                      {prof.active ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Role Dialog */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveProfileChanges} className="w-full max-w-sm bg-[#0D1428] border border-[rgba(212,175,55,0.2)] rounded p-6 space-y-4">
            <h3 className="text-lg font-title font-bold text-[#D4AF37] flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#D4AF37]" /> Modificar Acceso Corporativo
            </h3>

            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Nombre Completo</label>
              <p className="text-sm font-semibold text-white bg-[#050814] px-3 py-2 rounded">
                {editingProfile.first_name} {editingProfile.last_name}
              </p>
            </div>

            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Rol Asignado</label>
              <select 
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none text-[#94A3B8]"
              >
                <option value="SUPERADMIN">SUPERADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="AGENT">AGENT</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Estado de Cuenta</label>
              <select 
                value={editActive ? "true" : "false"}
                onChange={(e) => setEditActive(e.target.value === "true")}
                className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none text-[#94A3B8]"
              >
                <option value="true">Activo / Permitir Acceso</option>
                <option value="false">Inactivo / Bloquear Acceso</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setEditingProfile(null)}
                className="gold-button-secondary px-4 py-2 text-xs font-semibold rounded"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="gold-button-primary px-4 py-2 text-xs font-semibold rounded"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
