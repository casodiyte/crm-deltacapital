import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, UserPlus, AlertCircle } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { edgeFunctionError } from "@/lib/edgeFunctionError";

export const RegisterInternal = () => {
  const { originalProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("AGENT");
  const [department, setDepartment] = useState("Ventas");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("admin_create_user", {
        body: {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          role,
          department,
        },
      });

      if (error) throw await edgeFunctionError(error, "No se pudo registrar al colaborador");
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        setMessage({
          type: "success",
          text: `Colaborador registrado exitosamente. El usuario ${email} ya puede iniciar sesión.`,
        });
        setEmail("");
        setPassword("");
        setFirstName("");
        setLastName("");
        setRole("AGENT");
        setDepartment("Ventas");
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.message || "Error al registrar el colaborador.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-[#050814] min-h-screen text-[#F8FAFC] flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-[#0D1428] border border-[rgba(212,175,55,0.2)] rounded p-8 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-2 border-b border-[rgba(212,175,55,0.15)] pb-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37] bg-[rgba(212,175,55,0.05)] mb-2">
            <UserPlus className="h-6 w-6 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl font-title font-bold text-[#F8FAFC]">Registrar Colaborador</h1>
          <p className="text-xs text-[#94A3B8]">Ruta de Registro Interno para Kovex / Delta Capital</p>
        </div>

        {message && (
          <div
            className={`p-3 rounded text-xs flex items-start gap-2 border ${
              message.type === "success"
                ? "bg-green-950/20 text-green-400 border-green-900"
                : "bg-red-950/20 text-red-400 border-red-900"
            }`}
          >
            {message.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
            {message.type === "success" && <ShieldCheck className="h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1 font-semibold">Nombre</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-white"
                placeholder="Juan"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1 font-semibold">Apellido</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-white"
                placeholder="Pérez"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#94A3B8] mb-1 font-semibold">Email Corporativo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-white font-mono"
              placeholder="correo@kovex.net"
            />
          </div>

          <div>
            <label className="block text-xs text-[#94A3B8] mb-1 font-semibold">Contraseña Provisional</label>
            <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-white"
                placeholder="••••••••"
              />
              <p className="text-[10px] text-[#64748B] mt-1">Mínimo 12 caracteres.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1 font-semibold">Rol en la Plataforma</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
              >
                <option value="AGENT">EJECUTIVO — Seguimiento Propio</option>
                <option value="SUPERVISOR">SUPERVISOR — Seguimiento de Equipo</option>
                {originalProfile?.role === "SUPERADMIN" && (
                  <option value="MANAGER">GERENTE — Gestión y Monitoreo</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1 font-semibold">Departamento (Área)</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
              >
                <option value="Ventas">Ventas</option>
                <option value="Retencion">Retención</option>
                <option value="Cumplimiento">Cumplimiento</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gold-button-primary py-2.5 rounded font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2"
          >
            {loading ? "Registrando..." : "Registrar Colaborador"}
          </button>
        </form>
      </div>
    </div>
  );
};
