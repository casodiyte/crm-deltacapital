import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { absoluteTime, clockTime, relativeTime } from "@/lib/relativeTime";
import type { Lead, Profile, Note, Activity } from "@/types";
import {
  Search, Plus, Tag, Trash2,
  Edit3, X, Phone, Mail, CheckCircle2, Globe, TrendingUp, MessageSquare,
  ChevronLeft, ChevronRight, Users, Calendar, Megaphone
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useNavigate } from "react-router";
import { ComplianceDocs } from "./ComplianceDocs";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500, 1000];

const LEAD_STAGES = ["Nuevo", "Contactado", "Interesado", "Asesoría", "Depósito pendiente", "Ganado", "Perdido"] as const;

type SortOption = "created_desc" | "updated_desc" | "updated_asc";

const SORT_CONFIG: Record<SortOption, { label: string; column: string; ascending: boolean }> = {
  created_desc: { label: "Más recientes primero", column: "created_at", ascending: false },
  updated_desc: { label: "Actividad más reciente", column: "updated_at", ascending: false },
  updated_asc: { label: "Sin actividad hace más tiempo", column: "updated_at", ascending: true },
};

export const ProspectosList = () => {
  const { profile } = useAuth();
  const { isAgent, isSupervisor, isManager, isSuperAdmin, canDelete, isRetention, isCompliance, canViewAll, canAssignLeads, isAuditMode, auditBlocked, isRealSuperAdmin } = usePermissions();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [totalLeadCount, setTotalLeadCount] = useState(0);
  
  // Filters state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterAgent, setFilterAgent] = useState(isAuditMode ? profile?.id || "" : "");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterContactOutcome, setFilterContactOutcome] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created_desc");
  const deferredSearch = useDeferredValue(search.trim());

  // ✅ NUEVO: Paginación
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // ✅ NUEVO: Selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAgentId, setBulkAgentId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkContactOutcome, setBulkContactOutcome] = useState("");
  const [bulkOutcomeUpdating, setBulkOutcomeUpdating] = useState(false);

  // Drawer / Form state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    country: "",
    investment_capacity: "",
    comments: "",
    status: "Nuevo",
    source: "Web",
    agent_id: "",
    contact_outcome: "pending",
  });

  // Notes & Activity state inside drawer
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newNote, setNewNote] = useState("");

  const fetchLeads = useCallback(async () => {
    if (!profile) return;

    try {
      setLoading(true);
      setLoadError("");
      // Excludes raw_data: the imported CSV row is stored per lead as jsonb and
      // is never shown here, but it dominates the response size.
      let query = supabase
        .from("leads")
        .select(
          "id,first_name,last_name,email,phone,status,source,country,investment_capacity,comments,campaign_name,registered_at,agent_id,team_id,created_by,is_burned,contact_outcome,created_at,updated_at",
          { count: "exact" },
        )
        .eq("is_burned", false)
        .order(SORT_CONFIG[sortBy].column, { ascending: SORT_CONFIG[sortBy].ascending });

      if (canViewAll) {
        // Managers y Superadmins ven todos los leads
      } else if (isAgent && profile?.id) {
        query = query.eq("agent_id", profile.id);
      } else if (profile?.team_id && !isAgent) {
        query = query.eq("team_id", profile.team_id);
      }

      if (filterStatus) query = query.eq("status", filterStatus);
      if (filterAgent === "__unassigned__") {
        query = query.is("agent_id", null);
      } else if (filterAgent) {
        query = query.eq("agent_id", filterAgent);
      }
      if (filterSource) query = query.eq("source", filterSource);
      if (filterCountry) query = query.eq("country", filterCountry);
      if (filterContactOutcome) query = query.eq("contact_outcome", filterContactOutcome);

      const searchTerm = deferredSearch.replace(/[,%()]/g, " ").trim();
      if (searchTerm) {
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`,
        );
      }

      const from = (currentPage - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (!error && data) {
        setLeads(data as Lead[]);
        setTotalLeadCount(count ?? data.length);
      } else if (error) {
        console.error("Error al obtener leads (db):", error);
        setLeads([]);
        setTotalLeadCount(0);
        setLoadError("No se pudieron cargar los prospectos con los filtros seleccionados.");
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  }, [
    canViewAll,
    currentPage,
    deferredSearch,
    filterAgent,
    filterCountry,
    filterContactOutcome,
    filterSource,
    filterStatus,
    isAgent,
    pageSize,
    profile,
    sortBy,
  ]);

  const fetchAgents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .not("is_trading_client", "is", true);
      if (!error && data) {
        const scopedAgents = (data as Profile[]).filter((agent) => {
          if (agent.role !== "AGENT") return false;
          if (isSuperAdmin) return true;
          if (isManager) return agent.department === profile?.department;
          if (isSupervisor) return profile?.team_id ? agent.team_id === profile.team_id : agent.department === profile?.department;
          return agent.id === profile?.id;
        });
        setAgents(scopedAgents);
      }
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  }, [
    isManager,
    isSuperAdmin,
    isSupervisor,
    profile?.department,
    profile?.id,
    profile?.team_id,
  ]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    if (profile) fetchAgents();
  }, [fetchAgents, profile]);

  // Handle drawer load detail
  const handleOpenLeadDetails = async (lead: Lead) => {
    setSelectedLead(lead);
    setIsDrawerOpen(true);
    
    // Fetch activities
    const { data: actData } = await supabase
      .from("activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    if (actData) setActivities(actData as Activity[]);

    // Fetch notes
    const { data: noteData } = await supabase
      .from("notes")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    if (noteData) setNotes(noteData as Note[]);

    // The full negotiation workspace is the richer view; offer it when the
    // prospect already has a deal behind it.
    const { data: dealRow } = await supabase
      .from("deals")
      .select("id")
      .eq("lead_id", lead.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLinkedDealId((dealRow as { id?: string } | null)?.id ?? null);
  };

  // Add Note
  // The prospect drawer now mirrors the deal workspace: stage, typification and
  // scheduled follow-up are all editable without leaving the record.
  const [savingDetail, setSavingDetail] = useState(false);
  const [activityTitle, setActivityTitle] = useState("Comunicarse con el cliente");
  const [activityDue, setActivityDue] = useState("");

  const patchSelectedLead = async (patch: Partial<Lead>) => {
    if (!selectedLead) return;
    setSavingDetail(true);
    const { data, error } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", selectedLead.id)
      .select()
      .single();
    setSavingDetail(false);
    if (error) { setLoadError(error.message); return; }
    const updated = data as Lead;
    setSelectedLead(updated);
    setLeads((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const [recoveryAgent, setRecoveryAgent] = useState("");
  const [linkedDealId, setLinkedDealId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Recovery is assigned deliberately by administration, naming the retention
  // agent who will try to win the account back.
  const sendToRecovery = async () => {
    if (!selectedLead || !recoveryAgent) return;
    setSavingDetail(true);
    const { error } = await supabase.rpc("send_lead_to_recovery", {
      target_lead_id: selectedLead.id,
      target_agent_id: recoveryAgent,
    });
    setSavingDetail(false);
    if (error) { setLoadError(error.message); return; }
    setRecoveryAgent("");
    setLoadError("");
  };

  const scheduleFollowUp = async () => {
    if (!selectedLead || !profile?.id || !activityTitle.trim() || !activityDue) return;
    setSavingDetail(true);
    const dueDate = new Date(activityDue);
    const { error } = await supabase.from("activities").insert({
      lead_id: selectedLead.id,
      user_id: profile.id,
      title: activityTitle.trim(),
      description: activityTitle.trim(),
      type: "task",
      due_at: dueDate.toISOString(),
      reminder_at: new Date(dueDate.getTime() - 15 * 60 * 1000).toISOString(),
      status: "pending",
    });
    setSavingDetail(false);
    if (error) { setLoadError(error.message); return; }
    setActivityDue("");
    const { data: refreshed } = await supabase
      .from("activities")
      .select("*")
      .eq("lead_id", selectedLead.id)
      .order("created_at", { ascending: false });
    if (refreshed) setActivities(refreshed as Activity[]);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedLead || !profile) return;
    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          lead_id: selectedLead.id,
          user_id: profile.id,
          content: newNote,
        })
        .select()
        .single();
      
      if (!error && data) {
        setNotes([data as Note, ...notes]);
        setNewNote("");

        // Register Activity
        await supabase.from("activities").insert({
          lead_id: selectedLead.id,
          user_id: profile.id,
          description: `Nota agregada: "${newNote.slice(0, 30)}..."`,
          type: "note",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create / Update Lead Submit
  const handleSaveLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const payload = {
        ...formData,
        team_id: profile.team_id || null,
        agent_id: formData.agent_id || null,
      };

      if (selectedLead?.id) {
        // Update
        const { error } = await supabase
          .from("leads")
          .update(payload)
          .eq("id", selectedLead.id);
        
        if (!error) {
          // Log activity
          await supabase.from("activities").insert({
            lead_id: selectedLead.id,
            user_id: profile.id,
            description: `Prospecto actualizado: ${payload.first_name} ${payload.last_name}`,
            type: "update",
          });
        }
      } else {
        // Create
        const { data, error } = await supabase
          .from("leads")
          .insert(payload)
          .select()
          .single();
        
        if (!error && data) {
          // Log activity
          await supabase.from("activities").insert({
            lead_id: data.id,
            user_id: profile.id,
            description: `Prospecto creado: ${payload.first_name} ${payload.last_name}`,
            type: "creation",
          });
        }
      }
      setIsFormOpen(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Modal state
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; targetId: string; targetName: string}>({
    isOpen: false, targetId: "", targetName: ""
  });

  const confirmDeleteLead = async () => {
    try {
      if (confirmModal.targetId === "BULK") {
        const idsArray = Array.from(selectedIds);
        const { error } = await supabase.from("leads").delete().in("id", idsArray);
        if (!error) {
          setLeads(leads.filter(l => !selectedIds.has(l.id)));
          setSelectedIds(new Set());
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      } else {
        const { error } = await supabase.from("leads").delete().eq("id", confirmModal.targetId);
        if (!error) {
          setLeads(leads.filter(l => l.id !== confirmModal.targetId));
          if (selectedLead?.id === confirmModal.targetId) {
            setIsDrawerOpen(false);
            setSelectedLead(null);
          }
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Lead
  const handleDeleteLead = (leadId: string, name: string) => {
    setConfirmModal({ isOpen: true, targetId: leadId, targetName: name });
  };

  // Unique countries for the filter dropdown
  const uniqueCountries = Array.from(
    new Set(leads.map((lead) => lead.country).filter((country): country is string => Boolean(country))),
  ).sort();

  // ✅ Paginación respaldada por Supabase (incluye toda la base, no solo los primeros registros)
  const totalPages = Math.max(1, Math.ceil(totalLeadCount / pageSize));
  const paginatedLeads = leads;

  // ✅ Helpers de selección múltiple
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLeads.map(l => l.id)));
    }
  };

  // ✅ Asignación masiva de agente
  const handleBulkAssign = async () => {
    if (!bulkAgentId || selectedIds.size === 0) return;
    setBulkAssigning(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("leads")
        .update({ agent_id: bulkAgentId })
        .in("id", ids);
      if (!error) {
        setSelectedIds(new Set());
        setBulkAgentId("");
        fetchLeads();
      } else {
        setLoadError(error.message);
      }
    } catch (err) { console.error(err); }
    finally { setBulkAssigning(false); }
  };

  // ✅ Cambio masivo de estado
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);
  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkStatusUpdating(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("leads")
        .update({ status: bulkStatus })
        .in("id", ids);
      if (!error) {
        setSelectedIds(new Set());
        setBulkStatus("");
        fetchLeads();
      }
    } catch (err) { console.error(err); }
    finally { setBulkStatusUpdating(false); }
  };

  const handleBulkOutcomeUpdate = async () => {
    if (!bulkContactOutcome || selectedIds.size === 0) return;
    setBulkOutcomeUpdating(true);
    const { error } = await supabase
      .from("leads")
      .update({ contact_outcome: bulkContactOutcome })
      .in("id", Array.from(selectedIds));
    setBulkOutcomeUpdating(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setSelectedIds(new Set());
    setBulkContactOutcome("");
    void fetchLeads();
  };

  return (
    <div className="app-page">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-title font-bold text-[#F8FAFC]">Mesa de Prospectos</h1>
          <p className="text-xs text-[#94A3B8] mt-1">Gestión institucional de leads de inversión y trading</p>
        </div>
        <button 
          onClick={() => {
            setFormData({
              first_name: "",
              last_name: "",
              email: "",
              phone: "",
              country: "",
              investment_capacity: "",
              comments: "",
              status: "Nuevo",
              source: "Web",
              agent_id: profile?.id || "",
              contact_outcome: "pending",
            });
            setSelectedLead(null);
            setIsFormOpen(true);
          }}
          className="gold-button-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar Prospecto</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 p-4 glass-card md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, email o teléfono..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 pr-4 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
        <div>
          <select 
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
          >
            <option value="">-- Todos los Estados --</option>
            <option value="Nuevo">Nuevo</option>
            <option value="Contactado">Contactado</option>
            <option value="Interesado">Interesado</option>
            <option value="Asesoría">Asesoría</option>
            <option value="Depósito pendiente">Depósito pendiente</option>
            <option value="Ganado">Ganado</option>
            <option value="Perdido">Perdido</option>
          </select>
        </div>
        <div>
          <select
            value={filterContactOutcome}
            onChange={(e) => { setFilterContactOutcome(e.target.value); setCurrentPage(1); }}
            aria-label="Filtrar por resultado telefónico"
            className="h-10 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">-- Todos los números --</option>
            <option value="invalid_number">Número inexistente</option>
            <option value="direct_voicemail">Buzón directo</option>
            <option value="no_answer">No contestó</option>
            <option value="valid">Número válido</option>
            <option value="pending">Sin clasificar</option>
          </select>
        </div>
        <div>
          <select 
            value={filterCountry}
            onChange={(e) => { setFilterCountry(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
          >
            <option value="">-- Todos los Países --</option>
            {uniqueCountries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
        <div>
          <select 
            value={filterSource}
            onChange={(e) => { setFilterSource(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
          >
            <option value="">-- Todas las Fuentes --</option>
            <option value="Web">Web</option>
            <option value="Recomendado">Recomendado</option>
            <option value="Campaña">Campaña</option>
            <option value="Cold Call">Cold Call</option>
          </select>
        </div>
        <div>
          <select 
            value={filterAgent}
            onChange={(e) => { setFilterAgent(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
          >
            <option value="">-- Todos los Agentes --</option>
            <option value="__unassigned__">Sin asignar</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortOption); setCurrentPage(1); }}
            aria-label="Ordenar prospectos"
            className="px-3 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
          >
            {(Object.keys(SORT_CONFIG) as SortOption[]).map((option) => (
              <option key={option} value={option}>{SORT_CONFIG[option].label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setSearch("");
            setFilterStatus("");
            setFilterCountry("");
            setFilterSource("");
            setFilterAgent("");
            setFilterContactOutcome("");
            setSortBy("created_desc");
            setCurrentPage(1);
            setSelectedIds(new Set());
          }}
          className="gold-button-secondary py-2 text-sm rounded font-medium"
        >
          Limpiar filtros
        </button>
      </div>

      {/* ✅ NUEVO: Barra de acciones masivas */}
      {selectedIds.size > 0 && (

        <div className="flex flex-wrap items-center gap-3 rounded-lg p-3"
          style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)" }}>
          <Users className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-xs font-semibold text-[#D4AF37]">{selectedIds.size} seleccionados</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canAssignLeads && (
              <>
                <select
                  value={bulkAgentId}
                  onChange={(e) => setBulkAgentId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-[#0D1428] border border-[rgba(212,175,55,0.2)] rounded text-[#94A3B8] focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="">Asignar agente...</option>
                  {agents.map(a => (<option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={!bulkAgentId || bulkAssigning}
                  className="gold-button-primary px-3 py-1.5 text-xs font-bold rounded disabled:opacity-50"
                >
                  {bulkAssigning ? "Asignando..." : "Asignar"}
                </button>
              </>
            )}

            {/* ✅ NUEVO: Cambiar estado masivamente */}
            <>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#0D1428] border border-[rgba(212,175,55,0.2)] rounded text-[#94A3B8] focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="">Cambiar estado...</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Contactado">Contactado</option>
                <option value="Interesado">Interesado</option>
                <option value="Asesoría">Asesoría</option>
                <option value="Depósito pendiente">Depósito pendiente</option>
                <option value="Ganado">Ganado</option>
                <option value="Perdido">Perdido</option>
              </select>
              <button
                onClick={handleBulkStatusUpdate}
                disabled={!bulkStatus || bulkStatusUpdating}
                className="gold-button-primary px-3 py-1.5 text-xs font-bold rounded disabled:opacity-50"
              >
                {bulkStatusUpdating ? "Actualizando..." : "Actualizar"}
              </button>
            </>

            <div className="flex items-center gap-2">
              <select
                value={bulkContactOutcome}
                onChange={(event) => setBulkContactOutcome(event.target.value)}
                aria-label="Clasificar números seleccionados"
                className="h-9 rounded border border-border bg-background px-2 text-xs text-foreground"
              >
                <option value="">Clasificar número…</option>
                <option value="invalid_number">Número inexistente</option>
                <option value="direct_voicemail">Buzón directo</option>
                <option value="no_answer">No contestó</option>
                <option value="valid">Número válido</option>
              </select>
              <button
                type="button"
                onClick={() => void handleBulkOutcomeUpdate()}
                disabled={!bulkContactOutcome || bulkOutcomeUpdating}
                className="gold-button-primary min-h-9 rounded px-3 text-xs font-bold disabled:opacity-50"
              >
                {bulkOutcomeUpdating ? "Guardando…" : "Clasificar"}
              </button>
            </div>
            
            
            {/* Botón para agregar a la cola de llamadas */}
            <button
              onClick={async () => {
                try {
                  const idsArray = Array.from(selectedIds);
                  const { error } = await supabase.from('leads').update({ in_call_queue: true }).in('id', idsArray);
                  if (!error) {
                    alert("Agregados a la cola de llamadas exitosamente.");
                    setSelectedIds(new Set());
                  } else {
                    console.error("Error al agregar a la cola:", error);
                    alert("Error al agregar a la cola.");
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              className="px-3 py-1.5 text-xs font-bold rounded bg-[rgba(212,175,55,0.15)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.25)] transition-colors border border-[rgba(212,175,55,0.3)]"
            >
              Agregar a Cola
            </button>

            {/* Botón para eliminar múltiples (solo si tiene permisos) */}
            {canDelete && (
              <button
                onClick={() => setConfirmModal({ isOpen: true, targetId: "BULK", targetName: `${selectedIds.size} prospectos seleccionados` })}
                className="px-3 py-1.5 text-xs font-bold rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors border border-red-500/30"
              >
                Eliminar Seleccionados
              </button>
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#F8FAFC] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="text-center p-12 text-[#D4AF37]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#D4AF37] mx-auto mb-2"></div>
            Cargando base de prospectos...
          </div>
        ) : loadError ? (
          <div className="text-center p-12 text-red-400">
            {loadError}
          </div>
        ) : totalLeadCount === 0 ? (
          <div className="text-center p-12 text-[#94A3B8]">
            No hay prospectos que coincidan con la búsqueda.
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {paginatedLeads.map((lead) => (
                <article key={lead.id} className="p-4" onClick={() => handleOpenLeadDetails(lead)}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleSelect(lead.id)}
                      aria-label={`Seleccionar ${lead.first_name} ${lead.last_name}`}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold text-foreground">{lead.first_name} {lead.last_name}</h2>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{lead.email || "Sin correo"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{lead.phone || "Sin teléfono"}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{lead.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-1">{lead.source || "Sin fuente"}</span>
                        <span className="rounded-full bg-muted px-2 py-1">
                          {lead.contact_outcome === "invalid_number" ? "Número inexistente" : lead.contact_outcome === "direct_voicemail" ? "Buzón directo" : lead.contact_outcome === "no_answer" ? "No contestó" : lead.contact_outcome === "valid" ? "Número válido" : "Sin clasificar"}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-1" title={absoluteTime(lead.updated_at)}>
                          Actualizado {relativeTime(lead.updated_at)} · {clockTime(lead.updated_at)}
                        </span>
                      </div>
                      <div className="mt-3 flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLead(lead);
                            setFormData({ first_name: lead.first_name, last_name: lead.last_name, email: lead.email, phone: lead.phone, country: lead.country || "", investment_capacity: lead.investment_capacity || "", comments: lead.comments || "", status: lead.status, source: lead.source, agent_id: lead.agent_id || "", contact_outcome: lead.contact_outcome || "pending" });
                            setIsFormOpen(true);
                          }}
                          className="app-icon-button"
                          aria-label={`Editar ${lead.first_name} ${lead.last_name}`}
                        ><Edit3 className="h-4 w-4" /></button>
                        {canDelete && <button type="button" onClick={() => handleDeleteLead(lead.id, `${lead.first_name} ${lead.last_name}`)} className="app-icon-button hover:bg-destructive/10 hover:text-destructive" aria-label={`Eliminar ${lead.first_name} ${lead.last_name}`}><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <table className="hidden w-full border-collapse text-left md:table">
              <thead>
                <tr className="border-b border-[rgba(212,175,55,0.2)] bg-[#0D1428] text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">
                  {/* ✅ Checkbox selección masiva */}
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === paginatedLeads.length && paginatedLeads.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-[#D4AF37] h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4">Fuente</th>
                  <th className="p-4">Agente</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Últ. actualización</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`border-b border-[rgba(255,255,255,0.05)] table-row-hover transition-all text-sm cursor-pointer ${
                      selectedIds.has(lead.id) ? "bg-[rgba(212,175,55,0.04)]" : ""
                    }`}
                    onClick={() => handleOpenLeadDetails(lead)}
                  >
                    <td className="p-4" onClick={(e) => { e.stopPropagation(); toggleSelect(lead.id); }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="accent-[#D4AF37] h-3.5 w-3.5 cursor-pointer"
                      />
                    </td>
                    <td className="p-4 font-semibold text-[#F8FAFC]">{lead.first_name} {lead.last_name}</td>
                    <td className="p-4 text-[#94A3B8] font-mono">{lead.email || "-"}</td>
                    <td className="p-4 text-[#94A3B8] font-mono">{lead.phone || "-"}</td>
                    <td className="p-4 text-xs">
                      <span className="px-2 py-0.5 rounded bg-[#17213D] text-[#E6C766] border border-[rgba(212,175,55,0.15)]">
                        {lead.source}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-[#94A3B8] font-medium">
                      {agents.find(a => a.id === lead.agent_id)
                        ? `${agents.find(a => a.id === lead.agent_id)?.first_name} ${agents.find(a => a.id === lead.agent_id)?.last_name}`
                        : <span className="text-[10px] uppercase tracking-wider opacity-60">Sin asignar</span>}
                    </td>
                    <td className="p-4 text-xs">
                      <span className={`px-2 py-0.5 rounded border ${
                        lead.status === "Ganado" ? "bg-green-950/20 text-green-400 border-green-500/30" :
                        lead.status === "Perdido" ? "bg-red-950/20 text-red-400 border-red-500/30" :
                        "bg-[rgba(212,175,55,0.05)] text-[#D4AF37] border-[rgba(212,175,55,0.2)]"
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-xs text-[#94A3B8]" title={absoluteTime(lead.updated_at)}>
                      <span className="block">{relativeTime(lead.updated_at)}</span>
                      <span className="block text-[10px] opacity-70">{clockTime(lead.updated_at)}</span>
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedLead(lead);
                          setFormData({ first_name: lead.first_name, last_name: lead.last_name, email: lead.email, phone: lead.phone, country: lead.country || "", investment_capacity: lead.investment_capacity || "", comments: lead.comments || "", status: lead.status, source: lead.source, agent_id: lead.agent_id || "", contact_outcome: lead.contact_outcome || "pending" });
                          setIsFormOpen(true);
                        }}
                        className="p-1 hover:text-[#D4AF37] text-[#94A3B8]"
                        title="Editar"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button onClick={() => handleDeleteLead(lead.id, `${lead.first_name} ${lead.last_name}`)} className="p-1 hover:text-red-400 text-[#94A3B8]" title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ✅ NUEVO: Footer con paginación y selector de tamaño */}
            {/* Extra right padding keeps the pager clear of the floating chat dock. */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 pr-20 sm:pr-24">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#4A6080]">Mostrar</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); setSelectedIds(new Set()); }}
                  className="px-2 py-1 text-xs bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded text-[#94A3B8] focus:outline-none focus:border-[#D4AF37]"
                >
                  {PAGE_SIZE_OPTIONS.map(s => (<option key={s} value={s}>{s}</option>))}
                </select>
                <span className="text-[11px] text-[#4A6080]">de {totalLeadCount} registros</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setSelectedIds(new Set()); }}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded text-[#64748B] hover:text-[#D4AF37] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-[#94A3B8] px-2 font-mono">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setSelectedIds(new Set()); }}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded text-[#64748B] hover:text-[#D4AF37] disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drawer Details Lateral */}
      {isDrawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end backdrop-blur-sm" style={{ background: "var(--overlay)" }}>
          <div className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-background sm:max-w-[94vw] xl:max-w-[1180px]">

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate font-title text-xl font-bold text-foreground">
                  {selectedLead.first_name} {selectedLead.last_name}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-mono-numbers text-[11px] uppercase tracking-wider">ID: {selectedLead.id.slice(0, 8)}</span>
                  {selectedLead.phone && <span>{selectedLead.phone}</span>}
                  {agents.find((agent) => agent.id === selectedLead.agent_id) && (
                    <span>
                      Responsable: {agents.find((agent) => agent.id === selectedLead.agent_id)?.first_name}{" "}
                      {agents.find((agent) => agent.id === selectedLead.agent_id)?.last_name}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await supabase.from('leads').update({ in_call_queue: true }).eq('id', selectedLead.id);
                    if (!error) {
                      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, in_call_queue: true } : l));
                      setSelectedLead({ ...selectedLead, in_call_queue: true });
                      alert("Agregado a la cola de llamadas.");
                    } else {
                      alert("Error al agregar a la cola.");
                    }
                  }}
                  className="gold-button-secondary min-h-9 rounded-lg px-3 text-xs font-bold"
                  disabled={selectedLead.in_call_queue}
                >
                  {selectedLead.in_call_queue ? "📞 En cola" : "📞 Mandar a cola"}
                </button>
                {linkedDealId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/negociaciones?deal=${linkedDealId}`)}
                    className="gold-button-secondary min-h-9 rounded-lg px-3 text-xs font-bold"
                  >
                    Abrir negociación
                  </button>
                )}
                <button onClick={() => setIsDrawerOpen(false)} className="app-icon-button" aria-label="Cerrar detalle del prospecto">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Stage stepper */}
            <div className="border-b border-border bg-card px-4 py-3">
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-7" aria-label="Etapa del prospecto">
                {LEAD_STAGES.map((stage, index) => {
                  const active = selectedLead.status === stage;
                  const reached =
                    LEAD_STAGES.indexOf(selectedLead.status as (typeof LEAD_STAGES)[number]) >= index &&
                    selectedLead.status !== "Perdido";
                  return (
                    <button
                      key={stage}
                      type="button"
                      disabled={savingDetail || auditBlocked}
                      onClick={() => void patchSelectedLead({ status: stage })}
                      aria-current={active ? "step" : undefined}
                      className={`min-h-11 rounded-md border px-2 py-2 text-left text-[11px] font-semibold transition-colors disabled:opacity-50 ${active ? "border-primary bg-primary/12 text-primary" : reached ? "border-border bg-muted/40 text-foreground" : "border-border bg-muted/25 text-muted-foreground hover:bg-muted"}`}
                    >
                      <span className="block text-[9px] font-medium uppercase opacity-70">Paso {index + 1}</span>
                      <span className="block truncate">{stage}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Two columns, matching the negotiation workspace */}
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(280px,0.82fr)_minmax(430px,1.35fr)] lg:overflow-hidden">

              <aside className="space-y-4 border-b border-border p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                <section className="surface-card space-y-4 p-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Información de contacto</h4>
                  <div className="space-y-4">
                    <LeadInfoRow icon={Mail} label="Email" value={selectedLead.email || "Sin email"} />
                    <LeadInfoRow icon={Phone} label="Teléfono" value={selectedLead.phone || "Sin teléfono"} />
                    <LeadInfoRow icon={Globe} label="País" value={selectedLead.country || "País no especificado"} />
                    <LeadInfoRow icon={TrendingUp} label="Capacidad de inversión" value={selectedLead.investment_capacity || "Capacidad no indicada"} />
                    <LeadInfoRow icon={Tag} label="Fuente" value={selectedLead.source || "Sin fuente"} />
                    {selectedLead.campaign_name && <LeadInfoRow icon={Megaphone} label="Campaña" value={selectedLead.campaign_name} />}
                    <LeadInfoRow
                      icon={Calendar}
                      label="Registro"
                      value={new Date(selectedLead.registered_at || selectedLead.created_at).toLocaleDateString("es-MX")}
                    />
                    {selectedLead.comments && <LeadInfoRow icon={MessageSquare} label="Comentarios" value={selectedLead.comments} />}
                  </div>
                </section>

                <section className="surface-card p-5">
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Tipificación</h4>
                  <select
                    value={selectedLead.contact_outcome ?? "pending"}
                    disabled={savingDetail || auditBlocked}
                    onChange={(event) => void patchSelectedLead({ contact_outcome: event.target.value as Lead["contact_outcome"] })}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="pending">Sin clasificar</option>
                    <option value="valid">Número válido</option>
                    <option value="no_answer">No contestó</option>
                    <option value="direct_voicemail">Buzón directo</option>
                    <option value="invalid_number">Número inexistente</option>
                  </select>
                </section>

                {(isSuperAdmin || isManager) && !auditBlocked && (
                  <section className="surface-card p-5">
                    <h4 className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Enviar a Recovery</h4>
                    <p className="mb-3 text-[11px] text-muted-foreground">Manda la cuenta al proceso de recuperación con un agente de Retención.</p>
                    <select
                      value={recoveryAgent}
                      onChange={(event) => setRecoveryAgent(event.target.value)}
                      className="mb-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Selecciona un agente de Retención…</option>
                      {agents
                        .filter((agent) => agent.department === "Retencion" && agent.active)
                        .map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.first_name} {agent.last_name} · {agent.role}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void sendToRecovery()}
                      disabled={savingDetail || !recoveryAgent}
                      className="gold-button-secondary min-h-10 w-full rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      Enviar a Recovery
                    </button>
                  </section>
                )}

                {isCompliance && (
                  <section className="surface-card space-y-3 p-5">
                    <ComplianceDocs leadId={selectedLead.id} />
                  </section>
                )}
              </aside>

              <div className="space-y-4 p-4 lg:overflow-y-auto">
                {!auditBlocked && (
                  <section className="surface-card p-5">
                    <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Programar seguimiento</h4>
                    <input
                      value={activityTitle}
                      onChange={(event) => setActivityTitle(event.target.value)}
                      placeholder="¿Qué hay que hacer?"
                      className="mb-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="datetime-local"
                        value={activityDue}
                        onChange={(event) => setActivityDue(event.target.value)}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => void scheduleFollowUp()}
                        disabled={savingDetail || !activityDue || !activityTitle.trim()}
                        className="gold-button-primary min-h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                      >
                        Agendar
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Se te avisa 15 minutos antes.</p>
                  </section>
                )}

                <section className="surface-card space-y-4 p-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Comentario</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Agregar nota de la sesión…"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <button onClick={handleAddNote} className="gold-button-primary rounded-xl px-4 text-sm font-semibold">
                      Guardar
                    </button>
                  </div>
                </section>

                <section className="surface-card p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Historial</h4>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-3">
                    {[
                      ...notes.map((note) => ({ kind: "note" as const, date: note.created_at, text: note.content })),
                      ...activities.map((act) => ({ kind: "activity" as const, date: act.created_at, text: act.description })),
                    ]
                      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
                      .map((entry, index) => (
                        <div key={`${entry.kind}-${index}`} className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
                          <span
                            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                            style={{
                              background: `color-mix(in srgb, var(${entry.kind === "note" ? "--primary" : "--electric"}) 12%, transparent)`,
                              color: `var(${entry.kind === "note" ? "--primary" : "--electric"})`,
                            }}
                          >
                            {entry.kind === "note" ? <MessageSquare className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <p className="whitespace-pre-wrap text-sm text-foreground">{entry.text}</p>
                            <span className="mt-0.5 block font-mono-numbers text-[11px] text-muted-foreground">
                              {new Date(entry.date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                          </div>
                        </div>
                      ))}
                    {notes.length === 0 && activities.length === 0 && (
                      <p className="py-6 text-center text-xs text-muted-foreground">Sin actividad registrada.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveLeadSubmit}
            className="w-full max-w-lg bg-[#0D1428] border border-[rgba(212,175,55,0.2)] rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-title font-bold text-[#D4AF37] sticky top-0 bg-[#0D1428] pb-2 border-b border-[rgba(212,175,55,0.12)]">
              {selectedLead?.id ? "Editar Prospecto" : "Nuevo Prospecto"}
            </h3>

            {/* Name */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  disabled={auditBlocked || ((isRetention || isCompliance) && !isRealSuperAdmin)}
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Apellido</label>
                <input
                  type="text"
                  required
                  disabled={auditBlocked || ((isRetention || isCompliance) && !isRealSuperAdmin)}
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Email</label>
                <input
                  type="email"
                  disabled={auditBlocked || ((isRetention || isCompliance) && !isRealSuperAdmin)}
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Teléfono</label>
                <input
                  type="text"
                  disabled={auditBlocked || ((isRetention || isCompliance) && !isRealSuperAdmin)}
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Country + Investment Capacity + phone quality */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">País</label>
                <input
                  type="text"
                  placeholder="Ej. México"
                  disabled={auditBlocked || ((isRetention || isCompliance) && !isRealSuperAdmin)}
                  value={formData.country || ""}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Capacidad de Inversión</label>
                <select
                  value={formData.investment_capacity || ""}
                  disabled={auditBlocked || ((isRetention || isCompliance) && !isRealSuperAdmin)}
                  onChange={(e) => setFormData({ ...formData, investment_capacity: e.target.value })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8] disabled:opacity-50"
                >
                  <option value="">Seleccionar rango...</option>
                  <option value="Menos de $5,000">Menos de $5,000</option>
                  <option value="$5,000 - $25,000">$5,000 – $25,000</option>
                  <option value="$25,000 - $100,000">$25,000 – $100,000</option>
                  <option value="$100,000 - $500,000">$100,000 – $500,000</option>
                  <option value="Más de $500,000">Más de $500,000</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Resultado telefónico</label>
                <select
                  value={formData.contact_outcome || "pending"}
                  disabled={isCompliance}
                  onChange={(e) => setFormData({ ...formData, contact_outcome: e.target.value as Lead["contact_outcome"] })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8] disabled:opacity-50"
                >
                  <option value="pending">Sin clasificar</option>
                  <option value="valid">Número válido</option>
                  <option value="invalid_number">Número inexistente</option>
                  <option value="direct_voicemail">Buzón directo</option>
                  <option value="no_answer">No contestó</option>
                </select>
              </div>
            </div>

            {/* Status + Source */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Estado</label>
                <select
                  value={formData.status}
                  disabled={isCompliance}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8] disabled:opacity-50"
                >
                  {!isRetention && (
                    <>
                      <option value="Nuevo">Nuevo</option>
                      <option value="Contactado">Contactado</option>
                      <option value="Interesado">Interesado</option>
                      <option value="Asesoría">Asesoría</option>
                      <option value="Depósito pendiente">Depósito pendiente</option>
                      <option value="Ganado">Ganado</option>
                      <option value="Perdido">Perdido</option>
                    </>
                  )}
                  {isRetention && (
                    <>
                      <option value="Lead nuevo con comentarios">Lead nuevo con comentarios</option>
                      <option value="Venta 1">Venta 1</option>
                      <option value="Venta 2">Venta 2</option>
                      <option value="Venta 3">Venta 3</option>
                      <option value="Venta 4">Venta 4</option>
                      <option value="Venta 5">Venta 5</option>
                      <option value="Venta 6">Venta 6</option>
                      <option value="Venta 7">Venta 7</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Fuente</label>
                <select
                  value={formData.source}
                  disabled={auditBlocked || ((isRetention || isCompliance) && !isRealSuperAdmin)}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8] disabled:opacity-50"
                >
                  <option value="Web">Web</option>
                  <option value="Recomendado">Recomendado</option>
                  <option value="Campaña">Campaña</option>
                  <option value="Cold Call">Cold Call</option>
                </select>
              </div>
            </div>

            {/* Assigned agent */}
            {canAssignLeads && (
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Agente Asignado</label>
                <select
                  value={formData.agent_id || ""}
                  onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
                >
                  <option value="">Asignar agente...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Comments */}
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Comentarios</label>
              <textarea
                rows={3}
                placeholder="Observaciones iniciales, contexto del prospecto..."
                value={formData.comments || ""}
                disabled={isCompliance}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] resize-none disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="gold-button-secondary px-4 py-2 text-xs font-semibold rounded"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="gold-button-primary px-4 py-2 text-xs font-semibold rounded"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Eliminar Prospecto"
        message={`¿Estás seguro de que deseas eliminar a "${confirmModal.targetName}"? Esta acción borrará todas sus notas e historial y no se puede deshacer.`}
        onConfirm={confirmDeleteLead}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
};

const LeadInfoRow = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  </div>
);
