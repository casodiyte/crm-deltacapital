import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { CalendarDays, Columns3, DollarSign, FilterX, List, ListChecks, Plus, Search, TrendingUp, Trophy, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { Activity, Deal, Lead, Note, Profile } from "@/types";
import { removeAttachment, uploadAttachment } from "@/lib/attachments";
import { ActivitiesView, CalendarView, DealsListView, KanbanView } from "./PipelineViews";
import { DealWorkspaceSheet, type ActivityDraft } from "./DealWorkspaceSheet";
import { CloseDealDialog, DealFormDialog, PostponeDialog, type DealFormPayload } from "./DealDialogs";
import { ACTIVE_STAGES, CONTACT_OUTCOME_CONFIG, formatCurrency, type PipelineStage } from "./pipeline";
import { PIPELINE_CONFIG, RECOVERY_STAGES, isRecoveryStage, stagesForPipeline, visiblePipelines, type DealPipeline } from "./pipelines";

type ViewMode = "kanban" | "list" | "activities" | "calendar";
interface ConfirmTarget { type: "deal" | "activity"; id: string; name: string; }

const VIEW_KEY = "delta-capital-pipeline-view";
const PIPELINE_KEY = "delta-capital-active-pipeline";
const MAX_REMINDER_DELAY = 7 * 24 * 60 * 60 * 1000;
const VIEW_OPTIONS: Array<{ value: ViewMode; label: string; icon: typeof Columns3 }> = [
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "list", label: "Lista", icon: List },
  { value: "activities", label: "Actividades", icon: ListChecks },
  { value: "calendar", label: "Calendario", icon: CalendarDays },
];
const safeViewMode = (value: string | null): ViewMode => VIEW_OPTIONS.some((item) => item.value === value) ? value as ViewMode : "kanban";

// PostgREST caps every response at 1000 rows regardless of .limit(), so a single
// query silently truncates the dataset and leaves deals unable to resolve their
// prospect. Walk the result set in pages instead.
const PAGE_SIZE = 1000;
const MAX_PAGES = 8;

// Only the columns the board actually renders. `select *` also pulls
// leads.raw_data -- the whole imported CSV row kept as jsonb -- which is
// megabytes across thousands of prospects and is never displayed.
const LEAD_COLUMNS = "id,first_name,last_name,email,phone,status,source,country,investment_capacity,comments,agent_id,team_id,is_burned,contact_outcome,created_at,updated_at";
const DEAL_COLUMNS = "id,name,value,stage,pipeline,lead_id,agent_id,sales_agent_id,team_id,currency,expected_closing_date,closed_at,close_reason,loss_reason,created_at,updated_at";

type PagedQuery = { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };

const fetchAllRows = async <T,>(buildQuery: () => PagedQuery): Promise<{ data: T[]; error: { message: string } | null }> => {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
};

export const NegociacionesKanban = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAgent, isSupervisor, isManager, isSuperAdmin, isAuditMode, auditBlocked, isRealSuperAdmin, canDelete, isCompliance, canViewAll } = usePermissions();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => safeViewMode(localStorage.getItem(VIEW_KEY)));
  const [pipeline, setPipeline] = useState<DealPipeline>("Ventas");
  // Retencion carries two tracks: the normal lifecycle and Recovery.
  const [recoveryTrack, setRecoveryTrack] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState(isAuditMode ? profile?.id || "" : "");
  const [sortBy, setSortBy] = useState<"updated_desc" | "updated_asc" | "created_desc">("updated_desc");
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [preferredLead, setPreferredLead] = useState<Lead | null>(null);
  const [closingDeal, setClosingDeal] = useState<Deal | null>(null);
  const [closeTarget, setCloseTarget] = useState<"Ganado" | "Perdido" | null>(null);
  const [postponingActivity, setPostponingActivity] = useState<Activity | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [resetTarget, setResetTarget] = useState<Deal | null>(null);
  const canMutate = !auditBlocked && (!isCompliance || isRealSuperAdmin);

  const availablePipelines = useMemo(
    () => visiblePipelines(profile?.role, profile?.department),
    [profile?.department, profile?.role],
  );

  // Restore the last pipeline the user opened, but never one they cannot see.
  useEffect(() => {
    const stored = localStorage.getItem(PIPELINE_KEY) as DealPipeline | null;
    setPipeline(stored && availablePipelines.includes(stored) ? stored : availablePipelines[0] ?? "Ventas");
  }, [availablePipelines]);

  useEffect(() => { localStorage.setItem(PIPELINE_KEY, pipeline); }, [pipeline]);

  // Arriving from Prospectos with ?deal=<id>: switch to that record's pipeline
  // and open its workspace, so both screens lead to the same detailed view.
  useEffect(() => {
    const requested = searchParams.get("deal");
    if (!requested || deals.length === 0) return;
    const target = deals.find((item) => item.id === requested);
    if (!target) return;
    setPipeline((target.pipeline ?? "Ventas") as DealPipeline);
    if (target.pipeline === "Retencion") setRecoveryTrack(isRecoveryStage(target.stage));
    setSelectedDealId(target.id);
    setWorkspaceOpen(true);
    void (async () => {
      let q = supabase.from("notes").select("*");
      if (target.lead_id) {
        q = q.or(`deal_id.eq.${target.id},lead_id.eq.${target.lead_id}`);
      } else {
        q = q.eq("deal_id", target.id);
      }
      const { data } = await q.order("created_at", { ascending: false });
      setNotes((data ?? []) as Note[]);
    })();
    searchParams.delete("deal");
    setSearchParams(searchParams, { replace: true });
  }, [deals, searchParams, setSearchParams]);

  const pipelineStages = useMemo(
    () =>
      (pipeline === "Retencion" && recoveryTrack
        ? RECOVERY_STAGES
        : stagesForPipeline(pipeline)) as readonly PipelineStage[],
    [pipeline, recoveryTrack],
  );

  const fetchData = useCallback(async (showLoader = true) => {
    if (!profile) return;
    if (showLoader) setLoading(true);
    setError("");
    const buildDealsQuery = () => {
      let query = supabase.from("deals").select(DEAL_COLUMNS).order("updated_at", { ascending: false });
      if (!canViewAll) {
        if (profile.role === "AGENT") query = query.eq("agent_id", profile.id);
        else if (isAuditMode && profile.role === "SUPERVISOR" && profile.team_id) query = query.eq("team_id", profile.team_id);
      }
      return query;
    };
    const buildLeadsQuery = () => {
      let query = supabase.from("leads").select(LEAD_COLUMNS).order("created_at", { ascending: false });
      if (!canViewAll) {
        if (profile.role === "AGENT") query = query.eq("agent_id", profile.id);
        else if (isAuditMode && profile.role === "SUPERVISOR" && profile.team_id) query = query.eq("team_id", profile.team_id);
      }
      return query;
    };
    // Activities are only rendered as recent history, so they stay on a single
    // capped query — paginating them would pull tens of thousands of rows.
    let activitiesQuery = supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(1000);
    if (!canViewAll && profile.role === "AGENT") activitiesQuery = activitiesQuery.eq("user_id", profile.id);

    const [dealResult, leadResult, activityResult, profileResult] = await Promise.all([
      fetchAllRows<Deal>(buildDealsQuery),
      fetchAllRows<Lead>(buildLeadsQuery),
      activitiesQuery,
      supabase.from("profiles").select("id,first_name,last_name,email,role,department,team_id,active").not("is_trading_client", "is", true).eq("active", true).order("first_name"),
    ]);
    const firstError = dealResult.error || leadResult.error || activityResult.error || profileResult.error;
    if (firstError) setError(firstError.message || "No se pudo cargar el pipeline.");
    else {
      setDeals((dealResult.data ?? []) as Deal[]);
      setLeads((leadResult.data ?? []) as Lead[]);
      setActivities((activityResult.data ?? []) as Activity[]);
      setAgents((profileResult.data ?? []) as Profile[]);
    }
    if (showLoader) setLoading(false);
  }, [isAuditMode, profile, canViewAll]);

  useEffect(() => {
    void fetchData();
    if (!profile?.id) return;
    const channel = supabase
      .channel(`pipeline_${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => void fetchData(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => void fetchData(false))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchData, profile?.id]);

  useEffect(() => { localStorage.setItem(VIEW_KEY, viewMode); }, [viewMode]);

  const activeLeads = useMemo(() => leads.filter((lead) => !lead.is_burned), [leads]);
  const burnedLeadIds = useMemo(() => new Set(leads.filter((lead) => lead.is_burned).map((lead) => lead.id)), [leads]);
  const activeDeals = useMemo(
    () =>
      deals.filter((deal) => {
        if ((deal.pipeline ?? "Ventas") !== pipeline) return false;
        if (deal.lead_id && burnedLeadIds.has(deal.lead_id)) return false;
        if (pipeline === "Retencion") return isRecoveryStage(deal.stage) === recoveryTrack;
        return true;
      }),
    [burnedLeadIds, deals, pipeline, recoveryTrack],
  );
  const eligibleAgents = useMemo(() => agents.filter((agent) => {
    if (agent.role !== "AGENT") return false;
    if (isSuperAdmin) return true;
    if (isManager) return agent.department === profile?.department;
    if (isSupervisor) return profile?.team_id ? agent.team_id === profile.team_id : agent.department === profile?.department;
    return agent.id === profile?.id;
  }), [agents, isManager, isSuperAdmin, isSupervisor, profile?.department, profile?.id, profile?.team_id]);

  const filteredDeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = activeDeals.filter((deal) => {
      if (stageFilter && deal.stage !== stageFilter) return false;
      if (agentFilter && deal.agent_id !== agentFilter) return false;
      if (!term) return true;
      const lead = activeLeads.find((item) => item.id === deal.lead_id);
      return `${deal.name} ${lead?.first_name ?? ""} ${lead?.last_name ?? ""} ${lead?.email ?? ""} ${lead?.phone ?? ""}`.toLowerCase().includes(term);
    });

    result.sort((a, b) => {
      if (sortBy === "created_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === "updated_desc") {
        const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bDate - aDate;
      } else if (sortBy === "updated_asc") {
        const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return aDate - bDate;
      }
      return 0;
    });

    return result;
  }, [activeDeals, activeLeads, agentFilter, search, stageFilter, sortBy]);

  const leadsWithoutDeal = useMemo(() => {
    const linkedIds = new Set(activeDeals.map((deal) => deal.lead_id).filter(Boolean));
    const term = search.trim().toLowerCase();
    return activeLeads.filter((lead) => {
      if (linkedIds.has(lead.id)) return false;
      if (agentFilter && lead.agent_id !== agentFilter) return false;
      if (!term) return true;
      return `${lead.first_name} ${lead.last_name} ${lead.email ?? ""} ${lead.phone ?? ""}`.toLowerCase().includes(term);
    });
  }, [activeDeals, activeLeads, agentFilter, search]);

  const scheduledActivities = useMemo(() => activities.filter((activity) => Boolean(activity.due_at)), [activities]);
  const selectedDeal = useMemo(() => activeDeals.find((deal) => deal.id === selectedDealId) ?? null, [activeDeals, selectedDealId]);
  const selectedLead = selectedDeal?.lead_id ? activeLeads.find((lead) => lead.id === selectedDeal.lead_id) : undefined;
  const selectedAgent = selectedDeal?.agent_id ? agents.find((agent) => agent.id === selectedDeal.agent_id) : undefined;
  const selectedActivities = activities.filter(
    (activity) => activity.deal_id === selectedDealId || (selectedDeal?.lead_id && activity.lead_id === selectedDeal.lead_id)
  );

  const metrics = useMemo(() => {
    const active = activeDeals.filter((deal) => ACTIVE_STAGES.some((stage) => stage === deal.stage));
    const won = activeDeals.filter((deal) => deal.stage === "Ganado");
    const lost = activeDeals.filter((deal) => deal.stage === "Perdido");
    return {
      pipeline: active.reduce((sum, deal) => sum + Number(deal.value || 0), 0),
      won: won.reduce((sum, deal) => sum + Number(deal.value || 0), 0),
      commission: won.reduce((sum, deal) => sum + Number(deal.value || 0), 0) * 0.05,
      lost: lost.length,
    };
  }, [activeDeals]);

  useEffect(() => {
    if (!profile?.id || isAuditMode) return;
    const timers: number[] = [];
    scheduledActivities
      .filter((activity) => activity.user_id === profile.id && activity.reminder_at && activity.status !== "completed" && !activity.completed_at)
      .forEach((activity) => {
        const delay = new Date(activity.reminder_at as string).getTime() - Date.now();
        const storageKey = `activity-reminder-${activity.id}-${activity.reminder_at}`;
        if (delay <= 0 || delay > MAX_REMINDER_DELAY || sessionStorage.getItem(storageKey)) return;
        timers.push(window.setTimeout(async () => {
          sessionStorage.setItem(storageKey, "sent");
          await supabase.from("notifications").insert({ user_id: profile.id, title: "Recordatorio de actividad", content: activity.title || activity.description, metadata: { activity_id: activity.id, deal_id: activity.deal_id } });
        }, delay));
      });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [isAuditMode, profile?.id, scheduledActivities]);

  const openDeal = async (deal: Deal) => {
    setSelectedDealId(deal.id);
    setWorkspaceOpen(true);
    let q = supabase.from("notes").select("*");
    if (deal.lead_id) {
      q = q.or(`deal_id.eq.${deal.id},lead_id.eq.${deal.lead_id}`);
    } else {
      q = q.eq("deal_id", deal.id);
    }
    const { data } = await q.order("created_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
  };

  const openCreateDeal = (lead: Lead | null = null) => {
    if (!canMutate) return;
    setEditingDeal(null); setPreferredLead(lead); setDealFormOpen(true);
  };
  const openEditDeal = (deal: Deal) => {
    if (!canMutate) return;
    setEditingDeal(deal); setPreferredLead(null); setDealFormOpen(true);
  };

  const logActivity = async (payload: Partial<Activity> & Pick<Activity, "description" | "type">) => {
    if (!profile?.id) return null;
    const { data } = await supabase.from("activities").insert({ user_id: profile.id, status: "completed", completed_at: new Date().toISOString(), ...payload }).select().single();
    if (data) setActivities((current) => [data as Activity, ...current]);
    return data as Activity | null;
  };

  const saveDeal = async (payload: DealFormPayload) => {
    if (!profile?.id || !canMutate) return;
    setSaving(true); setError("");
    if (editingDeal) {
      const { data, error: updateError } = await supabase.from("deals").update(payload).eq("id", editingDeal.id).select().single();
      if (updateError) { setError(updateError.message); setSaving(false); return; }
      const updated = data as Deal;
      setDeals((current) => current.map((deal) => deal.id === updated.id ? updated : deal));
      await logActivity({ deal_id: updated.id, lead_id: updated.lead_id, title: "Negociación actualizada", description: `Se actualizaron los datos de ${updated.name}.`, type: "update" });
    } else {
      const { data, error: insertError } = await supabase.from("deals").insert(payload).select().single();
      if (insertError) { setError(insertError.message); setSaving(false); return; }
      const created = data as Deal;
      setDeals((current) => [created, ...current]);
      await logActivity({ deal_id: created.id, lead_id: created.lead_id, title: "Negociación creada", description: `Se creó ${created.name} con un importe de ${formatCurrency(created.value, created.currency)}.`, type: "creation" });
    }
    setSaving(false); setDealFormOpen(false); setEditingDeal(null); setPreferredLead(null);
  };

  const updateActiveStage = async (deal: Deal, stage: PipelineStage) => {
    if (!canMutate || deal.stage === stage) return;
    setSaving(true);
    const { data, error: updateError } = await supabase.from("deals").update({ stage, closed_at: null, close_reason: null, loss_reason: null }).eq("id", deal.id).select().single();
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    const updated = data as Deal;
    setDeals((current) => current.map((item) => item.id === updated.id ? updated : item));
    await logActivity({ deal_id: deal.id, lead_id: deal.lead_id, title: "Etapa actualizada", description: `${deal.name} pasó de ${deal.stage} a ${stage}.`, type: "stage_change" });
  };

  const requestStageChange = (deal: Deal, stage: PipelineStage) => {
    if (!canMutate || deal.stage === stage) return;
    if (stage === "Ganado" || stage === "Perdido") { setClosingDeal(deal); setCloseTarget(stage); return; }
    void updateActiveStage(deal, stage);
  };

  const closeDeal = async (payload: { finalAmount: number; closeReason: string; lossReason: string }) => {
    if (!closingDeal || !closeTarget || !canMutate) return;
    setSaving(true);
    const { data, error: closeError } = await supabase.from("deals").update({
      stage: closeTarget,
      value: closeTarget === "Ganado" ? payload.finalAmount : closingDeal.value,
      closed_at: new Date().toISOString(),
      close_reason: payload.closeReason || null,
      loss_reason: closeTarget === "Perdido" ? payload.lossReason : null,
    }).eq("id", closingDeal.id).select().single();
    setSaving(false);
    if (closeError) { setError(closeError.message); return; }
    const updated = data as Deal;
    setDeals((current) => current.map((deal) => deal.id === updated.id ? updated : deal));
    await logActivity({
      deal_id: updated.id, lead_id: updated.lead_id,
      title: closeTarget === "Ganado" ? "Negociación ganada" : "Negociación perdida",
      description: closeTarget === "Ganado" ? `Cierre confirmado por ${formatCurrency(updated.value, updated.currency)}. ${payload.closeReason}`.trim() : `Motivo: ${payload.lossReason}. ${payload.closeReason}`.trim(),
      type: closeTarget === "Ganado" ? "deal_won" : "deal_lost",
    });
    setCloseTarget(null); setClosingDeal(null);
  };

  // Typification lives on the prospect (leads.contact_outcome). Writing it from
  // the pipeline keeps a single source of truth shared with the Prospectos
  // screen, so the same call never has to be registered twice.
  const updateLeadOutcome = async (lead: Lead, outcome: NonNullable<Lead["contact_outcome"]>) => {
    if (!canMutate || lead.contact_outcome === outcome) return;
    setSaving(true);
    const { data, error: outcomeError } = await supabase
      .from("leads")
      .update({ contact_outcome: outcome })
      .eq("id", lead.id)
      .select()
      .single();
    setSaving(false);
    if (outcomeError) { setError(outcomeError.message); return; }
    const updated = data as Lead;
    setLeads((current) => current.map((item) => item.id === updated.id ? updated : item));
    await logActivity({
      lead_id: updated.id,
      title: "Tipificación actualizada",
      description: `${updated.first_name} ${updated.last_name}: ${CONTACT_OUTCOME_CONFIG[outcome].label}.`,
      type: "typification",
    });
  };

  // Administrative rollback: drops the Cumplimiento/Retencion records and puts
  // the account back at the start of Ventas. SUPERADMIN only, enforced in the DB.
  const resetAccount = async () => {
    if (!resetTarget?.lead_id) { setResetTarget(null); return; }
    setSaving(true);
    const { error: resetError } = await supabase.rpc("reset_account_to_sales", {
      target_lead_id: resetTarget.lead_id,
      reset_reason: `Reinicio solicitado sobre ${resetTarget.name}.`,
    });
    setSaving(false);
    setResetTarget(null);
    if (resetError) { setError(resetError.message); return; }
    setWorkspaceOpen(false);
    await fetchData(false);
  };

  const handleDrop = (event: React.DragEvent, stage: PipelineStage) => {
    event.preventDefault(); setDragOverStage(null);
    const deal = activeDeals.find((item) => item.id === event.dataTransfer.getData("dealId"));
    if (deal) requestStageChange(deal, stage);
  };

  const createActivity = async (draft: ActivityDraft) => {
    if (!selectedDeal || !profile?.id || !canMutate) return;
    setSaving(true);
    const dueAt = new Date(draft.dueAt);
    const reminderAt = new Date(dueAt.getTime() - draft.reminderMinutes * 60 * 1000);
    const { data, error: activityError } = await supabase.from("activities").insert({
      deal_id: selectedDeal.id, lead_id: selectedDeal.lead_id, user_id: profile.id,
      title: draft.title.trim(), description: draft.description.trim() || draft.title.trim(), type: "task",
      due_at: dueAt.toISOString(), reminder_at: reminderAt.toISOString(), status: "pending",
      metadata: { reminder_minutes: draft.reminderMinutes },
    }).select().single();
    setSaving(false);
    if (activityError) throw activityError;
    setActivities((current) => [data as Activity, ...current]);
  };

  const completeActivity = async (activity: Activity) => {
    if (!canMutate) return;
    const { data, error: updateError } = await supabase.from("activities").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", activity.id).select().single();
    if (updateError) { setError(updateError.message); return; }
    setActivities((current) => current.map((item) => item.id === activity.id ? data as Activity : item));
  };

  const postponeActivity = async (dueAt: string) => {
    if (!postponingActivity || !canMutate) return;
    setSaving(true);
    const reminderMinutes = Number(postponingActivity.metadata?.reminder_minutes ?? 30);
    const dueDate = new Date(dueAt);
    const { data, error: updateError } = await supabase.from("activities").update({
      due_at: dueDate.toISOString(), reminder_at: new Date(dueDate.getTime() - reminderMinutes * 60 * 1000).toISOString(),
      status: "postponed", completed_at: null,
    }).eq("id", postponingActivity.id).select().single();
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setActivities((current) => current.map((item) => item.id === postponingActivity.id ? data as Activity : item));
    setPostponingActivity(null);
  };

  const createNote = async (content: string, files: File[]) => {
    if (!selectedDeal || !profile?.id || !canMutate) return;
    setSaving(true);
    const uploaded = await Promise.all(files.map((file) => uploadAttachment(file, profile.id, `deals/${selectedDeal.id}`)));
    const { data, error: noteError } = await supabase.from("notes").insert({
      deal_id: selectedDeal.id, lead_id: selectedDeal.lead_id, user_id: profile.id,
      content: content.trim() || "Archivo adjunto", attachments: uploaded,
    }).select().single();
    if (noteError) {
      await Promise.allSettled(uploaded.map(removeAttachment)); setSaving(false); throw noteError;
    }
    setNotes((current) => [data as Note, ...current]); setSaving(false);
  };

  const confirmDelete = async () => {
    if (!confirmTarget || !canMutate) return;
    if (confirmTarget.type === "deal") {
      const { error: deleteError } = await supabase.from("deals").delete().eq("id", confirmTarget.id);
      if (deleteError) setError(deleteError.message);
      else { setDeals((current) => current.filter((deal) => deal.id !== confirmTarget.id)); if (selectedDealId === confirmTarget.id) setWorkspaceOpen(false); }
    } else {
      const { error: deleteError } = await supabase.from("activities").delete().eq("id", confirmTarget.id);
      if (deleteError) setError(deleteError.message);
      else setActivities((current) => current.filter((activity) => activity.id !== confirmTarget.id));
    }
    setConfirmTarget(null);
  };

  const clearFilters = () => { setSearch(""); setStageFilter(""); setAgentFilter(""); };
  if (loading) return <div className="app-page grid min-h-[60vh] place-items-center"><div className="text-center"><span className="mx-auto mb-3 block h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /><p className="text-sm text-muted-foreground">Cargando pipeline…</p></div></div>;

  return (
    <section className="app-page flex flex-col gap-5" aria-labelledby="pipeline-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Operación comercial</p>
          <h1 id="pipeline-title" className="font-title text-2xl font-extrabold leading-none text-foreground sm:text-[1.9rem]">Pipeline de negociaciones</h1>
          <p className="mt-2 text-sm text-muted-foreground">Mueve etapas, programa seguimientos y conserva el contexto completo de cada operación.</p>
        </div>
        {canMutate && <button type="button" onClick={() => openCreateDeal()} className="gold-button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold"><Plus className="h-4 w-4" /> Nueva negociación</button>}
      </header>
      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => setError("")} className="font-semibold underline">Cerrar</button></div>}

      {pipeline === "Retencion" && (
        <div role="tablist" aria-label="Pista de Retención" className="inline-flex gap-1 rounded-xl border border-border bg-card p-1">
          {[
            { value: false, label: "Ciclo normal", hint: "Etapas 1 a 7" },
            { value: true, label: "Recovery", hint: "Reactivación de cuentas" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="tab"
              aria-selected={recoveryTrack === option.value}
              onClick={() => { setRecoveryTrack(option.value); setStageFilter(""); }}
              className={`min-h-10 rounded-lg px-3 text-left transition-colors ${recoveryTrack === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              title={option.hint}
            >
              <span className="block text-xs font-bold">{option.label}</span>
            </button>
          ))}
        </div>
      )}

      {availablePipelines.length > 1 && (
        <div role="tablist" aria-label="Embudo" className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1">
          {availablePipelines.map((option) => {
            const config = PIPELINE_CONFIG[option];
            const isActive = pipeline === option;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => { setPipeline(option); setStageFilter(""); }}
                className={`min-h-11 rounded-xl px-4 text-left transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                title={config.description}
              >
                <span className="block text-sm font-bold">{config.label}</span>
                <span className={`block text-[10px] ${isActive ? "opacity-80" : "opacity-70"}`}>{config.description}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Pipeline activo", value: formatCurrency(metrics.pipeline), icon: TrendingUp, v: "--primary", text: "text-primary" },
          { label: "Ganado", value: formatCurrency(metrics.won), icon: Trophy, v: "--success", text: "text-success" },
          { label: "Comisión estimada", value: formatCurrency(metrics.commission), icon: DollarSign, v: "--electric", text: "text-electric" },
          { label: "Operaciones perdidas", value: String(metrics.lost), icon: XCircle, v: "--destructive", text: "text-destructive" },
        ].map((metric) => (
          <div key={metric.label} className="surface-card surface-lift flex items-start justify-between gap-3 p-[1.15rem]">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
              <p className={`font-display mt-2 text-[1.7rem] font-extrabold leading-none ${metric.text}`}>{metric.value}</p>
            </div>
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, var(${metric.v}) 12%, transparent)`, border: `1px solid color-mix(in srgb, var(${metric.v}) 22%, transparent)` }}>
              <metric.icon className={`h-[19px] w-[19px] ${metric.text}`} />
            </span>
          </div>
        ))}
      </div>

      <div className="surface-card grid gap-3 p-3 lg:grid-cols-[minmax(240px,1fr)_180px_200px_200px_auto]">
        <label className="relative"><span className="sr-only">Buscar negociación</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar negociación, prospecto, teléfono…" className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} aria-label="Filtrar por etapa" className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Todas las etapas</option>{pipelineStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
        <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} aria-label="Filtrar por agente" className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Todos los agentes</option>{eligibleAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.first_name} {agent.last_name}</option>)}</select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value as any)} aria-label="Ordenar por" className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="created_desc">Más recientes primero</option>
          <option value="updated_desc">Actividad más reciente</option>
          <option value="updated_asc">Sin actividad hace más tiempo</option>
        </select>
        <button type="button" onClick={clearFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-accent"><FilterX className="h-4 w-4" /> Limpiar</button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Vista del pipeline" className="inline-flex flex-wrap rounded-2xl border border-border bg-card p-1">
          {VIEW_OPTIONS.map((option) => <button key={option.value} type="button" role="tab" aria-selected={viewMode === option.value} onClick={() => setViewMode(option.value)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${viewMode === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><option.icon className="h-4 w-4" />{option.label}</button>)}
        </div>
        <p className="text-xs text-muted-foreground">{filteredDeals.length} negociaciones · {leadsWithoutDeal.length} prospectos por convertir</p>
      </div>

      {viewMode === "kanban" && <KanbanView stages={pipelineStages} deals={filteredDeals} leads={activeLeads} leadsWithoutDeal={leadsWithoutDeal} dragOverStage={dragOverStage} onDragStart={(event, dealId) => { event.dataTransfer.setData("dealId", dealId); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event, stage) => { if (!canMutate) return; event.preventDefault(); setDragOverStage(stage); }} onDragLeave={() => setDragOverStage(null)} onDrop={handleDrop} onOpenDeal={(deal) => void openDeal(deal)} onEditDeal={openEditDeal} onDeleteDeal={(deal) => setConfirmTarget({ type: "deal", id: deal.id, name: deal.name })} onCreateFromLead={(lead) => openCreateDeal(lead)} canDelete={canDelete} onOutcomeChange={canMutate ? (lead, outcome) => void updateLeadOutcome(lead, outcome) : undefined} />}
      {viewMode === "list" && <DealsListView deals={filteredDeals} leads={activeLeads} onOpenDeal={(deal) => void openDeal(deal)} onEditDeal={openEditDeal} onDeleteDeal={(deal) => setConfirmTarget({ type: "deal", id: deal.id, name: deal.name })} canDelete={canDelete} onStageChange={requestStageChange} canMutate={canMutate} onOutcomeChange={canMutate ? (lead, outcome) => void updateLeadOutcome(lead, outcome) : undefined} />}
      {viewMode === "activities" && <ActivitiesView activities={scheduledActivities} deals={activeDeals} onOpenDeal={(deal) => void openDeal(deal)} onComplete={(activity) => void completeActivity(activity)} onPostpone={setPostponingActivity} onDelete={(activity) => setConfirmTarget({ type: "activity", id: activity.id, name: activity.title || activity.description })} canManage={(activity) => canMutate && activity.user_id === profile?.id} />}
      {viewMode === "calendar" && <CalendarView activities={scheduledActivities} deals={activeDeals} month={calendarMonth} onMonthChange={setCalendarMonth} onOpenDeal={(deal) => void openDeal(deal)} />}

      <DealWorkspaceSheet open={workspaceOpen} deal={selectedDeal} lead={selectedLead} agent={selectedAgent} activities={selectedActivities} notes={notes} saving={saving} onOpenChange={setWorkspaceOpen} onStageChange={(stage) => selectedDeal && requestStageChange(selectedDeal, stage)} onEdit={openEditDeal} onCreateActivity={createActivity} onCompleteActivity={(activity) => void completeActivity(activity)} onPostponeActivity={setPostponingActivity} onDeleteActivity={(activity) => setConfirmTarget({ type: "activity", id: activity.id, name: activity.title || activity.description })} canManageActivity={(activity) => canMutate && activity.user_id === profile?.id} onCreateNote={createNote} onResetAccount={isSuperAdmin ? setResetTarget : undefined} onOutcomeChange={canMutate ? (lead, outcome) => void updateLeadOutcome(lead, outcome) : undefined} />
      <DealFormDialog open={dealFormOpen} saving={saving} deal={editingDeal} preferredLead={preferredLead} leads={activeLeads} agents={eligibleAgents} defaultAgentId={isAgent ? profile?.id : undefined} onOpenChange={setDealFormOpen} onSubmit={saveDeal} />
      <CloseDealDialog open={Boolean(closeTarget)} saving={saving} deal={closingDeal} targetStage={closeTarget} onOpenChange={(open) => { if (!open) { setCloseTarget(null); setClosingDeal(null); } }} onConfirm={closeDeal} />
      <PostponeDialog open={Boolean(postponingActivity)} saving={saving} currentDueAt={postponingActivity?.due_at} onOpenChange={(open) => !open && setPostponingActivity(null)} onConfirm={postponeActivity} />
      <ConfirmModal
        isOpen={Boolean(resetTarget)}
        title="Regresar la cuenta al inicio"
        message={`Se eliminarán los expedientes de Cumplimiento y Retención de “${resetTarget?.name ?? "esta cuenta"}” y la negociación volverá a la primera etapa de Ventas. Esta acción no se puede deshacer.`}
        onConfirm={() => void resetAccount()}
        onCancel={() => setResetTarget(null)}
      />
      <ConfirmModal isOpen={Boolean(confirmTarget)} title={confirmTarget?.type === "deal" ? "Eliminar negociación" : "Eliminar actividad"} message={`¿Deseas eliminar “${confirmTarget?.name ?? "este registro"}”? Esta acción no se puede deshacer.`} onConfirm={() => void confirmDelete()} onCancel={() => setConfirmTarget(null)} />
    </section>
  );
};
