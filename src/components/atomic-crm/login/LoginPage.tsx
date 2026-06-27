import { useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex app-bg text-[#F8FAFC]">
      <div className="relative grid w-full lg:grid-cols-2">
        {/* Left Branding Panel */}
        <div className="relative hidden h-full flex-col p-12 text-[#F8FAFC] lg:flex justify-between border-r border-[rgba(212,175,55,0.1)]"
          style={{ background: "linear-gradient(160deg, #080E20 0%, #0A1228 50%, #050814 100%)" }}
        >
          {/* Top Logo */}
          <div className="relative z-20 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.06)] shadow-[0_0_16px_rgba(212,175,55,0.15)]">
              <img src="/logo.png" alt="Delta Capital" className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="font-title text-base font-bold tracking-[0.14em] text-[#D4AF37]">
                DELTA CAPITAL
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="live-dot" />
                <span className="text-[9px] tracking-[0.18em] text-[#4A6080] font-medium uppercase">
                  Sistema Activo
                </span>
              </div>
            </div>
          </div>

          {/* Center Callout */}
          <div className="relative z-20 my-auto max-w-sm space-y-5">
            <h2 className="font-title text-4xl font-light leading-tight text-[#F8FAFC]">
              Private Sales &<br />
              <span className="text-[#D4AF37] font-normal">Trading Operations</span>
            </h2>
            <div className="h-px w-24 bg-gradient-to-r from-[#D4AF37] via-[#00C9FF] to-transparent" />
            <p className="text-sm text-[#4A6080] leading-relaxed">
              Institutional-grade CRM platform for high-frequency sales tracking, deal structuring, and financial flow management.
            </p>
          </div>

          {/* Footer notice */}
          <div className="relative z-20 text-[10px] text-[#334155]">
            © {new Date().getFullYear()} Delta Capital & Holding Street. All rights reserved.
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex flex-col justify-center w-full p-8 relative"
          style={{ background: "linear-gradient(180deg, #050814 0%, #080E20 100%)" }}
        >
          <div className="absolute top-0 left-0 w-full">
            <div className="market-gradient-line" />
          </div>

          <div className="w-full lg:mx-auto lg:w-[380px]">
            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 mb-8 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-[rgba(212,175,55,0.3)]">
                <img src="/logo.png" alt="Delta Capital" className="h-full w-full object-cover" />
              </div>
              <span className="font-title text-sm font-bold tracking-[0.14em] text-[#D4AF37]">DELTA CAPITAL</span>
            </div>

            <div className="glass-card p-8 space-y-7">
              <div className="space-y-1.5">
                <h1 className="text-xl font-title font-semibold tracking-tight text-[#E2E8F0]">
                  Acceso Privado
                </h1>
                <p className="text-xs text-[#4A6080]">
                  Ingresa tus credenciales para acceder al sistema
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#6B7FA3] tracking-wider uppercase">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="nombre@empresa.com"
                    className="w-full px-4 py-3 text-sm bg-[rgba(5,8,20,0.7)] border border-[rgba(212,175,55,0.15)] rounded-lg text-[#E2E8F0] placeholder-[#334155] focus:outline-none focus:border-[rgba(212,175,55,0.45)] focus:ring-1 focus:ring-[rgba(212,175,55,0.15)] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#6B7FA3] tracking-wider uppercase">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 text-sm bg-[rgba(5,8,20,0.7)] border border-[rgba(212,175,55,0.15)] rounded-lg text-[#E2E8F0] placeholder-[#334155] focus:outline-none focus:border-[rgba(212,175,55,0.45)] focus:ring-1 focus:ring-[rgba(212,175,55,0.15)] transition-all"
                  />
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-xs text-red-400">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="gold-button-primary w-full py-5 text-sm font-semibold rounded-lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="h-4 w-4 rounded-full border-2 border-[rgba(5,8,20,0.4)] border-t-[#050814] animate-spin" />
                      <span>Verificando...</span>
                    </div>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </Button>
              </form>

              <div className="text-center">
                <a
                  href="/forgot-password"
                  className="text-xs text-[#4A6080] hover:text-[#D4AF37] transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
