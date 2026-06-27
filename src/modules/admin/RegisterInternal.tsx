import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, UserPlus, AlertCircle } from "lucide-react";

export const RegisterInternal = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("AGENT");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // In Supabase client side, auth.signUp will register the user.
      // If we pass user metadata, the public.profiles trigger handle_new_user() will sync it.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        setMessage({
          type: "success",
          text: `Colaborador registrado exitosamente. El usuario ${email} ya puede iniciar sesión.`,
        });
        setEmail("");
        setPassword("");
        setFirstName("");
        setLastName("");
        setRole("AGENT");
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-white"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs text-[#94A3B8] mb-1 font-semibold">Rol en la Plataforma</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
            >
              <option value="AGENT">AGENTE</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
              <option value="MANAGER">MANAGER</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
            </select>
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
