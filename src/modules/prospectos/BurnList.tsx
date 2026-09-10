import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArchiveX, History, Mail, Phone, Search, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { absoluteTime, clockTime, relativeTime } from "@/lib/relativeTime";
import type { Lead, Profile } from "@/types";

interface AssignmentRow {
  lead_id: string;
  agent_id: string;
  first_assigned_at: string;
}

const OUTCOME_LABELS: Record<string, string> = {
  pending: "Sin clasificar",
  valid: "Número válido",
  invalid_number: "Número inexistente",
  direct_voicemail: "Buzón directo",
};

export const BurnList = () => {
  const { profile } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const deferredSearch = useDeferredValue(search.trim());

  const fetchBurn = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError("");

    let query = supabase
      .from("leads")
      .select("*")
      .eq("is_burned", true)
      .order("burned_at", { ascending: false })
      .limit(1000);

    if (outcome) query = query.eq("contact_outcome", outcome);
    const safeSearch = deferredSearch.replace(/[,%()]/g, " ").trim();
    if (safeSearch) {
      query = query.or(
        `first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`,
      );
    }

    const [{ data, error: leadError }, { data: profileData }] = await Promise.all([
      query,
      supabase.from("profiles").select("*").not("is_trading_client", "is", true),
    ]);

    if (leadError) {
      setError("No se pudo cargar el apartado Burn.");
      setLeads([]);
      setLoading(false);
      return;
    }

    const visibleLeads = (data ?? []) as Lead[];
    setLeads(visibleLeads);
    setAgents((profileData ?? []) as Profile[]);

    if (visibleLeads.length > 0) {
      const { data: assignmentData } = await supabase
        .from("lead_agent_assignments")
        .select("lead_id,agent_id,first_assigned_at")
        .in("lead_id", visibleLeads.map((lead) => lead.id))
        .order("first_assigned_at", { ascending: true });
      setAssignments((assignmentData ?? []) as AssignmentRow[]);
    } else {
      setAssignments([]);
    }
    setLoading(false);
  }, [deferredSearch, outcome, profile]);

  useEffect(() => {
    void fetchBurn();
  }, [fetchBurn]);

  const agentMap = useMemo(
    () => new Map(agents.map((agent) => [agent.id, `${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim()])),
    [agents],
  );

  const historyByLead = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>();
    assignments.forEach((row) => map.set(row.lead_id, [...(map.get(row.lead_id) ?? []), row]));
    return map;
  }, [assignments]);

  if (!isSuperAdmin) {
    return (
      <section className="app-page">
        <div className="app-panel grid min-h-56 place-items-center px-6 text-center">
          <div>
            <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-destructive" aria-hidden="true" />
            <p className="font-semibold text-foreground">Acceso restringido</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este apartado solo está disponible para administradores.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="app-page" aria-labelledby="burn-title">
      <header className="app-page-header">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-destructive">
            <ArchiveX className="h-4 w-4" aria-hidden="true" /> Base protegida
          </div>
          <h1 id="burn-title" className="font-title text-2xl font-bold text-foreground sm:text-3xl">Burn</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Prospectos que ya llegaron a dos agentes distintos. Permanecen visibles para auditoría, pero quedan fuera de la operación y no pueden volver a reasignarse.
          </p>
        </div>
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-right">
          <p className="text-2xl font-bold text-destructive">{leads.length}</p>
          <p className="text-xs text-muted-foreground">registros protegidos</p>
        </div>
      </header>

      <div className="app-panel grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_260px_auto]">
        <label className="relative">
          <span className="sr-only">Buscar en Burn</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nombre, teléfono o correo"
            className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label>
          <span className="sr-only">Filtrar resultado telefónico</span>
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos los resultados</option>
            <option value="invalid_number">Número inexistente</option>
            <option value="direct_voicemail">Buzón directo</option>
            <option value="valid">Número válido</option>
            <option value="pending">Sin clasificar</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => { setSearch(""); setOutcome(""); }}
          className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Limpiar
        </button>
      </div>

      {loading ? (
        <div className="app-panel grid min-h-56 place-items-center text-sm text-muted-foreground">Cargando Burn…</div>
      ) : error ? (
        <div className="app-panel p-8 text-center text-sm text-destructive">{error}</div>
      ) : leads.length === 0 ? (
        <div className="app-panel grid min-h-56 place-items-center px-6 text-center">
          <div>
            <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-primary" aria-hidden="true" />
            <p className="font-semibold text-foreground">No hay registros que coincidan</p>
            <p className="mt-1 text-sm text-muted-foreground">La base activa está limpia para estos filtros.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {leads.map((lead) => {
            const history = historyByLead.get(lead.id) ?? [];
            return (
              <article key={lead.id} className="app-panel p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{lead.first_name} {lead.last_name}</h2>
                    <p className="mt-1 inline-flex rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                      {OUTCOME_LABELS[lead.contact_outcome ?? "pending"]}
                    </p>
                  </div>
                  <div className="text-right">
                    <time className="block text-xs text-muted-foreground" dateTime={lead.burned_at ?? lead.updated_at}>
                      {new Date(lead.burned_at ?? lead.updated_at).toLocaleDateString("es-MX")}
                    </time>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground" title={absoluteTime(lead.updated_at)}>
                      Actualizado {relativeTime(lead.updated_at)} · {clockTime(lead.updated_at)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <span className="flex items-center gap-2"><Phone className="h-4 w-4" />{lead.phone || "Sin teléfono"}</span>
                  <span className="flex items-center gap-2"><Mail className="h-4 w-4" />{lead.email || "Sin correo"}</span>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-muted/35 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <History className="h-4 w-4" /> Recorrido de agentes
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {history.map((row, index) => (
                      <div key={row.agent_id} className="flex items-center gap-2">
                        {index > 0 && <span className="text-muted-foreground" aria-hidden="true">→</span>}
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">
                          <UserRound className="h-3.5 w-3.5 text-primary" />
                          {agentMap.get(row.agent_id) || "Agente no disponible"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {lead.burn_reason || "Límite automático de dos agentes alcanzado."}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
