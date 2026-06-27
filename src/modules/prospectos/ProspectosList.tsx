import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Lead, Profile, Note, Activity } from "@/types";
import { 
  Search, Plus, Tag, Trash2, 
  Edit3, X, Phone, Mail, CheckCircle2 
} from "lucide-react";

export const ProspectosList = () => {
  const { profile } = useAuth();
  const { isSuperAdmin, isManager, isAgent, canDelete } = usePermissions();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterAgent, setFilterAgent] = useState("");

  // Drawer / Form state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    status: "Nuevo",
    source: "Web",
    agent_id: "",
  });

  // Notes & Activity state inside drawer
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newNote, setNewNote] = useState("");

  const fetchLeads = async () => {
    try {
      setLoading(true);
      let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

      if (isAgent && profile?.id) {
        query = query.eq("agent_id", profile.id);
      } else if (profile?.team_id && !isAgent) {
        query = query.eq("team_id", profile.team_id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setLeads(data as Lead[]);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ["AGENT", "MANAGER"]);
      if (!error && data) {
        setAgents(data as Profile[]);
      }
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchLeads();
      fetchAgents();
    }
  }, [profile]);

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
  };

  // Add Note
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

  // Delete Lead
  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("¿Está seguro de eliminar este prospecto?")) return;
    try {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (!error) {
        setLeads(leads.filter(l => l.id !== leadId));
        if (selectedLead?.id === leadId) {
          setIsDrawerOpen(false);
          setSelectedLead(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const fullName = `${lead.first_name} ${lead.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase()) || 
                          lead.email?.toLowerCase().includes(search.toLowerCase()) ||
                          lead.phone?.includes(search);
    const matchesStatus = filterStatus ? lead.status === filterStatus : true;
    const matchesSource = filterSource ? lead.source === filterSource : true;
    const matchesAgent = filterAgent ? lead.agent_id === filterAgent : true;

    return matchesSearch && matchesStatus && matchesSource && matchesAgent;
  });

  return (
    <div className="space-y-6 p-6 bg-[#050814] min-h-screen text-[#F8FAFC]">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-[rgba(212,175,55,0.15)] pb-4">
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
              status: "Nuevo",
              source: "Web",
              agent_id: profile?.id || "",
            });
            setSelectedLead(null);
            setIsFormOpen(true);
          }}
          className="gold-button-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar Prospecto</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 glass-card">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
          <input 
            type="text" 
            placeholder="Buscar por nombre..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
        <div>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
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
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
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
            onChange={(e) => setFilterAgent(e.target.value)}
            className="px-3 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
          >
            <option value="">-- Todos los Agentes --</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => {
            setSearch("");
            setFilterStatus("");
            setFilterSource("");
            setFilterAgent("");
          }}
          className="gold-button-secondary py-2 text-sm rounded font-medium"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Leads Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="text-center p-12 text-[#D4AF37]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#D4AF37] mx-auto mb-2"></div>
            Cargando base de prospectos...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center p-12 text-[#94A3B8]">
            No hay prospectos que coincidan con la búsqueda.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[rgba(212,175,55,0.2)] bg-[#0D1428] text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">
                <th className="p-4">Nombre</th>
                <th className="p-4">Email</th>
                <th className="p-4">Teléfono</th>
                <th className="p-4">Fuente</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr 
                  key={lead.id} 
                  className="border-b border-[rgba(255,255,255,0.05)] table-row-hover transition-all text-sm cursor-pointer"
                  onClick={() => handleOpenLeadDetails(lead)}
                >
                  <td className="p-4 font-semibold text-[#F8FAFC]">
                    {lead.first_name} {lead.last_name}
                  </td>
                  <td className="p-4 text-[#94A3B8] font-mono">{lead.email || "-"}</td>
                  <td className="p-4 text-[#94A3B8] font-mono">{lead.phone || "-"}</td>
                  <td className="p-4 text-xs">
                    <span className="px-2 py-0.5 rounded bg-[#17213D] text-[#E6C766] border border-[rgba(212,175,55,0.15)]">
                      {lead.source}
                    </span>
                  </td>
                  <td className="p-4 text-xs">
                    <span className={`px-2 py-0.5 rounded border ${
                      lead.status === "Ganado" 
                        ? "bg-green-950/20 text-green-400 border-green-500/30" 
                        : lead.status === "Perdido" 
                        ? "bg-red-950/20 text-red-400 border-red-500/30" 
                        : "bg-[rgba(212,175,55,0.05)] text-[#D4AF37] border-[rgba(212,175,55,0.2)]"
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => {
                        setSelectedLead(lead);
                        setFormData({
                          first_name: lead.first_name,
                          last_name: lead.last_name,
                          email: lead.email,
                          phone: lead.phone,
                          status: lead.status,
                          source: lead.source,
                          agent_id: lead.agent_id || "",
                        });
                        setIsFormOpen(true);
                      }}
                      className="p-1 hover:text-[#D4AF37] text-[#94A3B8]"
                      title="Editar"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    {canDelete && (
                      <button 
                        onClick={() => handleDeleteLead(lead.id)}
                        className="p-1 hover:text-red-400 text-[#94A3B8]"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer Details Lateral */}
      {isDrawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0D1428] border-l border-[rgba(212,175,55,0.2)] h-full overflow-y-auto p-6 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Top Drawer Header */}
              <div className="flex justify-between items-start border-b border-[rgba(212,175,55,0.12)] pb-4">
                <div>
                  <h3 className="text-xl font-title font-bold text-[#F8FAFC]">
                    {selectedLead.first_name} {selectedLead.last_name}
                  </h3>
                  <span className="text-[10px] tracking-wider text-[#D4AF37] uppercase">ID: {selectedLead.id.slice(0,8)}</span>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Contact Information */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-[#94A3B8]">
                  <Mail className="h-4 w-4 text-[#D4AF37]" />
                  <span>{selectedLead.email || "Sin email"}</span>
                </div>
                <div className="flex items-center gap-3 text-[#94A3B8]">
                  <Phone className="h-4 w-4 text-[#D4AF37]" />
                  <span>{selectedLead.phone || "Sin teléfono"}</span>
                </div>
                <div className="flex items-center gap-3 text-[#94A3B8]">
                  <Tag className="h-4 w-4 text-[#D4AF37]" />
                  <span>Fuente: {selectedLead.source}</span>
                </div>
                <div className="flex items-center gap-3 text-[#94A3B8]">
                  <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                  <span>Estado: {selectedLead.status}</span>
                </div>
              </div>

              {/* Notes Feed */}
              <div className="space-y-3 pt-4 border-t border-[rgba(212,175,55,0.12)]">
                <h4 className="text-sm font-title font-semibold text-[#D4AF37]">Notas Comerciales</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Agregar nota de la sesión..." 
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none"
                  />
                  <button 
                    onClick={handleAddNote}
                    className="gold-button-primary px-3 text-xs font-semibold rounded"
                  >
                    Guardar
                  </button>
                </div>
                
                <div className="space-y-2 h-40 overflow-y-auto">
                  {notes.length === 0 ? (
                    <p className="text-[10px] text-[#64748B] text-center pt-4">No hay notas registradas para este lead.</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="p-2.5 bg-[#050814] border border-[rgba(212,175,55,0.1)] rounded text-xs">
                        <p className="text-[#F8FAFC]">{note.content}</p>
                        <span className="text-[9px] text-[#64748B] block mt-1">{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Activity Logs */}
              <div className="space-y-3 pt-4 border-t border-[rgba(212,175,55,0.12)]">
                <h4 className="text-sm font-title font-semibold text-[#D4AF37]">Historial de Actividades</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {activities.map((act) => (
                    <div key={act.id} className="flex gap-2.5 items-start text-xs">
                      <div className="mt-1 h-2 w-2 rounded-full bg-[#D4AF37]" />
                      <div>
                        <p className="text-[#94A3B8]">{act.description}</p>
                        <span className="text-[9px] text-[#64748B]">{new Date(act.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveLeadSubmit} className="w-full max-w-md bg-[#0D1428] border border-[rgba(212,175,55,0.2)] rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-title font-bold text-[#D4AF37]">
              {selectedLead?.id ? "Editar Prospecto" : "Nuevo Prospecto"}
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Nombre</label>
                <input 
                  type="text" 
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Apellido</label>
                <input 
                  type="text" 
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Email</label>
              <input 
                type="email" 
                value={formData.email || ""}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Teléfono</label>
              <input 
                type="text" 
                value={formData.phone || ""}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Estado</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none text-[#94A3B8]"
                >
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
                <label className="block text-xs text-[#94A3B8] mb-1">Fuente</label>
                <select 
                  value={formData.source}
                  onChange={(e) => setFormData({...formData, source: e.target.value})}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none text-[#94A3B8]"
                >
                  <option value="Web">Web</option>
                  <option value="Recomendado">Recomendado</option>
                  <option value="Campaña">Campaña</option>
                  <option value="Cold Call">Cold Call</option>
                </select>
              </div>
            </div>

            {(isSuperAdmin || isManager) && (
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Agente Asignado</label>
                <select 
                  value={formData.agent_id || ""}
                  onChange={(e) => setFormData({...formData, agent_id: e.target.value})}
                  className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none text-[#94A3B8]"
                >
                  <option value="">Asignar agente...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                  ))}
                </select>
              </div>
            )}

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
    </div>
  );
};
