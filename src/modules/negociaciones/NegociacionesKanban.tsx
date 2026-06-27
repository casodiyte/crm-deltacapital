import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Deal, Lead } from "@/types";
import { Plus, User, DollarSign, X, TrendingUp } from "lucide-react";

const STAGES = [
  "Nuevo lead",
  "Contactado",
  "Interesado",
  "Asesoría",
  "Depósito pendiente",
  "Ganado",
  "Perdido",
] as const;

type Stage = (typeof STAGES)[number];

interface StageConfig {
  color: string;
  bg: string;
  border: string;
  badge: string;
  label: string;
  emoji: string;
}

const STAGE_CONFIG: Record<Stage, StageConfig> = {
  "Nuevo lead": {
    color: "#64748B",
    bg: "rgba(100,116,139,0.08)",
    border: "rgba(100,116,139,0.35)",
    badge: "bg-[rgba(100,116,139,0.18)] text-[#94A3B8]",
    label: "text-[#94A3B8]",
    emoji: "○",
  },
  Contactado: {
    color: "#00C9FF",
    bg: "rgba(0,201,255,0.06)",
    border: "rgba(0,201,255,0.35)",
    badge: "bg-[rgba(0,201,255,0.15)] text-[#00C9FF]",
    label: "text-[#00C9FF]",
    emoji: "◎",
  },
  Interesado: {
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.06)",
    border: "rgba(245,158,11,0.35)",
    badge: "bg-[rgba(245,158,11,0.15)] text-[#F59E0B]",
    label: "text-[#F59E0B]",
    emoji: "◐",
  },
  Asesoría: {
    color: "#F97316",
    bg: "rgba(249,115,22,0.06)",
    border: "rgba(249,115,22,0.35)",
    badge: "bg-[rgba(249,115,22,0.15)] text-[#F97316]",
    label: "text-[#F97316]",
    emoji: "◑",
  },
  "Depósito pendiente": {
    color: "#A78BFA",
    bg: "rgba(167,139,250,0.06)",
    border: "rgba(167,139,250,0.35)",
    badge: "bg-[rgba(167,139,250,0.15)] text-[#A78BFA]",
    label: "text-[#A78BFA]",
    emoji: "●",
  },
  Ganado: {
    color: "#22C55E",
    bg: "rgba(34,197,94,0.07)",
    border: "rgba(34,197,94,0.35)",
    badge: "bg-[rgba(34,197,94,0.15)] text-[#22C55E]",
    label: "text-[#22C55E]",
    emoji: "✓",
  },
  Perdido: {
    color: "#EF4444",
    bg: "rgba(239,68,68,0.05)",
    border: "rgba(239,68,68,0.25)",
    badge: "bg-[rgba(239,68,68,0.12)] text-[#EF4444]",
    label: "text-[#EF4444]",
    emoji: "✕",
  },
};

export const NegociacionesKanban = () => {
  const { profile } = useAuth();
  const { isAgent } = usePermissions();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    value: 0,
    lead_id: "",
    stage: "Nuevo lead",
  });

  const fetchDealsAndLeads = async () => {
    try {
      setLoading(true);
      let dealsQuery = supabase.from("deals").select("*");
      let leadsQuery = supabase.from("leads").select("*");

      if (isAgent && profile?.id) {
        dealsQuery = dealsQuery.eq("agent_id", profile.id);
        leadsQuery = leadsQuery.eq("agent_id", profile.id);
      } else if (profile?.team_id && !isAgent) {
        dealsQuery = dealsQuery.eq("team_id", profile.team_id);
        leadsQuery = leadsQuery.eq("team_id", profile.team_id);
      }

      const [dealsRes, leadsRes] = await Promise.all([dealsQuery, leadsQuery]);
      if (dealsRes.data) setDeals(dealsRes.data as Deal[]);
      if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchDealsAndLeads();
  }, [profile]);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData("text/plain", dealId);
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => setDragOverStage(null);

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = e.dataTransfer.getData("text/plain");
    if (!dealId || !profile) return;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === targetStage) return;

    setDeals(deals.map((d) => (d.id === dealId ? { ...d, stage: targetStage as any } : d)));

    try {
      const { error } = await supabase
        .from("deals")
        .update({ stage: targetStage })
        .eq("id", dealId);

      if (error) {
        fetchDealsAndLeads();
      } else {
        await supabase.from("activities").insert({
          deal_id: dealId,
          lead_id: deal.lead_id,
          user_id: profile.id,
          description: `Negociación "${deal.name}" movida a: ${targetStage}`,
          type: "stage_change",
        });
      }
    } catch {
      fetchDealsAndLeads();
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const payload = {
        name: formData.name,
        value: Number(formData.value),
        stage: formData.stage,
        lead_id: formData.lead_id || null,
        agent_id: profile.id,
        team_id: profile.team_id || null,
      };

      const { data, error } = await supabase.from("deals").insert(payload).select().single();

      if (!error && data) {
        setDeals([...deals, data as Deal]);
        setIsFormOpen(false);
        await supabase.from("activities").insert({
          deal_id: data.id,
          lead_id: data.lead_id || null,
          user_id: profile.id,
          description: `Negociación creada: "${data.name}" por $${data.value}`,
          type: "creation",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalPipeline = deals
    .filter((d) => !["Ganado", "Perdido"].includes(d.stage))
    .reduce((sum, d) => sum + Number(d.value || 0), 0);

  const totalWon = deals
    .filter((d) => d.stage === "Ganado")
    .reduce((sum, d) => sum + Number(d.value || 0), 0);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[rgba(212,175,55,0.2)] border-t-[#D4AF37] animate-spin" />
          <span className="text-xs text-[#4A6080] tracking-wider">Cargando pipeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[rgba(212,175,55,0.1)] flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-xl font-title font-bold text-[#F8FAFC] tracking-tight">
              Pipeline de Negociaciones
            </h1>
            <p className="text-xs text-[#4A6080] mt-0.5">
              Arrastra los deals entre columnas para actualizar su etapa
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({ name: "", value: 0, lead_id: leads[0]?.id || "", stage: "Nuevo lead" });
              setIsFormOpen(true);
            }}
            className="gold-button-primary flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva Negociación
          </button>
        </div>

        {/* Pipeline summary strip */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span className="text-[11px] text-[#6B7FA3]">Pipeline activo:</span>
            <span className="text-[11px] font-bold font-mono-numbers text-[#D4AF37]">
              ${totalPipeline.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="w-px h-3 bg-[rgba(212,175,55,0.2)]" />
          <div className="flex items-center gap-1.5">
            <span className="live-dot" style={{ background: "#22C55E" }} />
            <span className="text-[11px] text-[#6B7FA3]">Ganado:</span>
            <span className="text-[11px] font-bold font-mono-numbers text-[#22C55E]">
              ${totalWon.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="w-px h-3 bg-[rgba(212,175,55,0.2)]" />
          <span className="text-[11px] text-[#4A6080]">{deals.length} deals totales</span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 p-4 h-full min-h-[calc(100vh-200px)] select-none">
          {STAGES.map((stage) => {
            const cfg = STAGE_CONFIG[stage];
            const stageDeals = deals.filter((d) => d.stage === stage);
            const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
            const isDragTarget = dragOverStage === stage;

            return (
              <div
                key={stage}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
                className="flex-shrink-0 w-60 flex flex-col rounded-xl transition-all duration-200"
                style={{
                  background: isDragTarget ? cfg.bg : "rgba(8,14,28,0.6)",
                  border: `1px solid ${isDragTarget ? cfg.color : "rgba(255,255,255,0.05)"}`,
                  boxShadow: isDragTarget
                    ? `0 0 20px ${cfg.color}22, inset 0 0 20px ${cfg.color}08`
                    : "none",
                }}
              >
                {/* Column Header */}
                <div
                  className="px-3.5 pt-3 pb-2.5 rounded-t-xl"
                  style={{
                    borderBottom: `1px solid rgba(255,255,255,0.05)`,
                    borderTop: `2px solid ${cfg.color}`,
                    background: `linear-gradient(180deg, ${cfg.color}10 0%, transparent 100%)`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0" style={{ color: cfg.color }}>
                        {cfg.emoji}
                      </span>
                      <h3
                        className="text-[10px] font-bold tracking-wider uppercase truncate"
                        style={{ color: cfg.color }}
                      >
                        {stage}
                      </h3>
                    </div>
                    <span
                      className={`h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${cfg.badge}`}
                    >
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono-numbers text-[10px] font-semibold text-[#334155]">
                    ${totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {stageDeals.map((deal) => {
                    const lead = leads.find((l) => l.id === deal.lead_id);
                    return (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        lead={lead}
                        stageColor={cfg.color}
                        onDragStart={handleDragStart}
                      />
                    );
                  })}

                  {stageDeals.length === 0 && (
                    <div
                      className="mt-2 rounded-lg py-8 text-center"
                      style={{
                        border: `1px dashed ${isDragTarget ? cfg.color : "rgba(255,255,255,0.06)"}`,
                        background: isDragTarget ? cfg.bg : "transparent",
                      }}
                    >
                      <p className="text-[10px]" style={{ color: isDragTarget ? cfg.color : "#334155" }}>
                        {isDragTarget ? "Suelta aquí" : "Sin deals"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,8,20,0.75)] backdrop-blur-md p-4">
          <form
            onSubmit={handleCreateDeal}
            className="w-full max-w-md rounded-2xl p-7 space-y-5"
            style={{
              background: "rgba(8,15,32,0.95)",
              border: "1px solid rgba(212,175,55,0.18)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,175,55,0.06) inset",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-title font-semibold text-[#E2E8F0]">
                  Nueva Negociación
                </h3>
                <p className="text-[11px] text-[#4A6080] mt-0.5">Registra un nuevo deal en el pipeline</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-[#4A6080] hover:text-[#F8FAFC] hover:bg-[rgba(255,255,255,0.06)] transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.2)] to-transparent" />

            <FormField label="Nombre del Deal">
              <input
                type="text"
                required
                placeholder="Ej. Inversión Capital FX"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-[rgba(5,8,20,0.7)] border border-[rgba(212,175,55,0.12)] rounded-lg text-[#E2E8F0] placeholder-[#334155] focus:outline-none focus:border-[rgba(212,175,55,0.4)] focus:ring-1 focus:ring-[rgba(212,175,55,0.12)] transition-all"
              />
            </FormField>

            <FormField label="Valor (USD)">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]">
                  <DollarSign className="h-3.5 w-3.5" />
                </span>
                <input
                  type="number"
                  required
                  min={0}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-[rgba(5,8,20,0.7)] border border-[rgba(212,175,55,0.12)] rounded-lg text-[#D4AF37] font-mono-numbers focus:outline-none focus:border-[rgba(212,175,55,0.4)] focus:ring-1 focus:ring-[rgba(212,175,55,0.12)] transition-all"
                />
              </div>
            </FormField>

            <FormField label="Prospecto Asociado">
              <select
                value={formData.lead_id}
                onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-[rgba(5,8,20,0.7)] border border-[rgba(212,175,55,0.12)] rounded-lg text-[#94A3B8] focus:outline-none focus:border-[rgba(212,175,55,0.4)] transition-all"
              >
                <option value="">— Sin asociar —</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.first_name} {l.last_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Etapa Inicial">
              <div className="grid grid-cols-2 gap-2">
                {STAGES.filter((s) => !["Ganado", "Perdido"].includes(s)).map((s) => {
                  const c = STAGE_CONFIG[s];
                  const isSelected = formData.stage === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({ ...formData, stage: s })}
                      className="px-2 py-1.5 rounded-lg text-[10px] font-semibold text-left transition-all"
                      style={{
                        background: isSelected ? `${c.color}18` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isSelected ? c.color : "rgba(255,255,255,0.06)"}`,
                        color: isSelected ? c.color : "#4A6080",
                      }}
                    >
                      {c.emoji} {s}
                    </button>
                  );
                })}
              </div>
            </FormField>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="gold-button-secondary px-4 py-2 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="gold-button-primary px-5 py-2 text-xs font-bold rounded-lg"
              >
                Crear Deal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

interface DealCardProps {
  deal: Deal;
  lead: Lead | undefined;
  stageColor: string;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

const DealCard = ({ deal, lead, stageColor, onDragStart }: DealCardProps) => (
  <div
    draggable
    onDragStart={(e) => onDragStart(e, deal.id)}
    className="group rounded-xl p-3.5 cursor-grab active:cursor-grabbing transition-all duration-150 hover:-translate-y-0.5"
    style={{
      background: "rgba(10,18,36,0.8)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderLeft: `3px solid ${stageColor}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px rgba(0,0,0,0.5), 0 0 0 1px ${stageColor}33`;
      (e.currentTarget as HTMLElement).style.borderColor = `${stageColor}`;
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
      (e.currentTarget as HTMLElement).style.borderLeftColor = stageColor;
    }}
  >
    <p className="text-xs font-semibold text-[#CBD5E1] truncate leading-snug mb-2">
      {deal.name}
    </p>
    <div
      className="flex items-center gap-1 text-sm font-bold font-mono-numbers mb-2"
      style={{ color: stageColor }}
    >
      <span className="text-[10px]">$</span>
      {Number(deal.value).toLocaleString("es-MX", { maximumFractionDigits: 0 })}
    </div>
    {lead && (
      <div className="flex items-center gap-1.5 text-[10px] text-[#334155]">
        <User className="h-2.5 w-2.5" />
        <span className="truncate">
          {lead.first_name} {lead.last_name}
        </span>
      </div>
    )}
  </div>
);

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

const FormField = ({ label, children }: FormFieldProps) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold text-[#4A6080] tracking-[0.12em] uppercase block">
      {label}
    </label>
    {children}
  </div>
);
