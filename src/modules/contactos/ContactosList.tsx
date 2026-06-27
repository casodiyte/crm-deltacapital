import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Contact, Note, Call, Deal } from "@/types";
import { 
  Plus, Search, Phone, Mail, Landmark, X, 
  Trash2, Edit3, Coins, Clock, BookOpen 
} from "lucide-react";

export const ContactosList = () => {
  const { profile } = useAuth();
  const { isAgent, canDelete } = usePermissions();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Details & History Modal state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Contact>>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
  });

  const fetchContacts = async () => {
    try {
      setLoading(true);
      let query = supabase.from("contacts").select("*").order("created_at", { ascending: false });

      if (isAgent && profile?.id) {
        query = query.eq("agent_id", profile.id);
      } else if (profile?.team_id && !isAgent) {
        query = query.eq("team_id", profile.team_id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setContacts(data as Contact[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchContacts();
    }
  }, [profile]);

  const handleOpenContactDetails = async (contact: Contact) => {
    setSelectedContact(contact);
    
    // Fetch Notes, Calls & Deals simultaneously
    const [notesRes, callsRes, dealsRes] = await Promise.all([
      supabase.from("notes").select("*").eq("contact_id", contact.id).order("created_at", { ascending: false }),
      supabase.from("calls").select("*").eq("contact_id", contact.id).order("created_at", { ascending: false }),
      supabase.from("deals").select("*").eq("lead_id", contact.id) // using lead_id or custom mapping
    ]);

    if (notesRes.data) setNotes(notesRes.data as Note[]);
    if (callsRes.data) setCalls(callsRes.data as Call[]);
    if (dealsRes.data) setDeals(dealsRes.data as Deal[]);
  };

  const handleSaveContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const payload = {
        ...formData,
        agent_id: profile.id,
        team_id: profile.team_id || null,
      };

      if (selectedContact?.id) {
        await supabase.from("contacts").update(payload).eq("id", selectedContact.id);
      } else {
        await supabase.from("contacts").insert(payload);
      }
      setIsFormOpen(false);
      setSelectedContact(null);
      fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("¿Está seguro de eliminar este contacto?")) return;
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", contactId);
      if (!error) {
        setContacts(contacts.filter(c => c.id !== contactId));
        if (selectedContact?.id === contactId) {
          setSelectedContact(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
    return fullName.includes(search.toLowerCase()) || 
           contact.email?.toLowerCase().includes(search.toLowerCase()) ||
           contact.company_name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 p-6 bg-[#050814] min-h-screen text-[#F8FAFC]">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-[rgba(212,175,55,0.15)] pb-4">
        <div>
          <h1 className="text-2xl font-title font-bold text-[#F8FAFC]">Directorio de Contactos</h1>
          <p className="text-xs text-[#94A3B8] mt-1">Cartera activa de clientes e inversores institucionales</p>
        </div>
        <button 
          onClick={() => {
            setFormData({
              first_name: "",
              last_name: "",
              email: "",
              phone: "",
              company_name: "",
            });
            setSelectedContact(null);
            setIsFormOpen(true);
          }}
          className="gold-button-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar Contacto</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
        <input 
          type="text" 
          placeholder="Buscar por nombre, email o institución..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-4 py-2 w-full text-sm bg-[#0D1428] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37]"
        />
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="text-center p-20 text-[#D4AF37]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#D4AF37] mx-auto mb-2"></div>
          Cargando cartera de inversión...
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center p-12 text-[#94A3B8] glass-card">
          No hay contactos registrados todavía.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map(contact => (
            <div 
              key={contact.id} 
              onClick={() => handleOpenContactDetails(contact)}
              className="glass-card p-5 cursor-pointer hover:border-[#D4AF37] hover:bg-[#111A33] transition-all space-y-4 shadow-md relative"
            >
              <div className="space-y-1">
                <h3 className="text-base font-title font-bold text-[#F8FAFC] truncate">
                  {contact.first_name} {contact.last_name}
                </h3>
                {contact.company_name && (
                  <p className="text-xs text-[#D4AF37] font-semibold flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5" /> {contact.company_name}
                  </p>
                )}
              </div>
              <div className="space-y-2 text-xs text-[#94A3B8] font-mono">
                {contact.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => {
                    setSelectedContact(contact);
                    setFormData({
                      first_name: contact.first_name,
                      last_name: contact.last_name,
                      email: contact.email,
                      phone: contact.phone,
                      company_name: contact.company_name,
                    });
                    setIsFormOpen(true);
                  }}
                  className="p-1 hover:text-[#D4AF37] text-[#94A3B8]"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                {canDelete && (
                  <button 
                    onClick={() => handleDeleteContact(contact.id)}
                    className="p-1 hover:text-red-400 text-[#94A3B8]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details & History Modal */}
      {selectedContact && !isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-[#0D1428] border border-[rgba(212,175,55,0.2)] rounded p-6 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-start border-b border-[rgba(212,175,55,0.15)] pb-4">
              <div>
                <h3 className="text-xl font-title font-bold text-[#F8FAFC]">
                  {selectedContact.first_name} {selectedContact.last_name}
                </h3>
                <p className="text-xs text-[#D4AF37] font-semibold">{selectedContact.company_name || "Inversor Individual"}</p>
              </div>
              <button 
                onClick={() => setSelectedContact(null)}
                className="p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Grid of details & histories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Notes & Calls */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-title tracking-wider text-[#D4AF37] font-semibold flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> Notas Comerciales
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {notes.map(n => (
                      <div key={n.id} className="p-3 bg-[#050814] rounded border border-[rgba(212,175,55,0.1)] text-xs">
                        <p className="text-[#F8FAFC]">{n.content}</p>
                        <span className="text-[9px] text-[#64748B] mt-1 block">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                    {notes.length === 0 && <p className="text-xs text-[#64748B] italic">No hay notas registradas.</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-title tracking-wider text-[#D4AF37] font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Historial de Llamadas
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {calls.map(c => (
                      <div key={c.id} className="p-3 bg-[#050814] rounded border border-[rgba(212,175,55,0.1)] text-xs flex justify-between">
                        <div>
                          <p className="text-[#F8FAFC] font-semibold">{c.disposition}</p>
                          <p className="text-[#94A3B8] mt-0.5">{c.notes || "Sin comentarios"}</p>
                        </div>
                        <span className="text-[10px] text-[#D4AF37] font-mono">{c.duration_seconds}s</span>
                      </div>
                    ))}
                    {calls.length === 0 && <p className="text-xs text-[#64748B] italic">No hay llamadas registradas.</p>}
                  </div>
                </div>
              </div>

              {/* Right Column: Deals */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-title tracking-wider text-[#D4AF37] font-semibold flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5" /> Negociaciones del Cliente
                </h4>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {deals.map(d => (
                    <div key={d.id} className="p-3 bg-[#050814] rounded border border-[rgba(212,175,55,0.1)] text-xs flex justify-between items-center">
                      <div>
                        <p className="text-[#F8FAFC] font-semibold">{d.name}</p>
                        <span className="text-[10px] text-[#94A3B8]">{d.stage}</span>
                      </div>
                      <span className="text-xs text-[#D4AF37] font-mono font-bold">${Number(d.value).toLocaleString()}</span>
                    </div>
                  ))}
                  {deals.length === 0 && <p className="text-xs text-[#64748B] italic">No hay negociaciones activas.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveContactSubmit} className="w-full max-w-md bg-[#0D1428] border border-[rgba(212,175,55,0.2)] rounded p-6 space-y-4">
            <h3 className="text-lg font-title font-bold text-[#D4AF37]">
              {selectedContact?.id ? "Editar Contacto" : "Agregar Contacto"}
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

            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Empresa / Institución</label>
              <input 
                type="text" 
                value={formData.company_name || ""}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none"
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
    </div>
  );
};
