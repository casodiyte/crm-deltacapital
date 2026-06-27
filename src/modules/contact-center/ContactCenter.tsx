import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import type { Call } from "@/types";
import { 
  PhoneCall, PhoneOff, Save, 
  Clock, History, ListCollapse 
} from "lucide-react";

export const ContactCenter = () => {
  const { profile } = useAuth();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active call state
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "active" | "wrap_up">("idle");
  const [duration, setDuration] = useState(0);
  const [disposition, setDisposition] = useState<string>("Interesado");
  const [notes, setNotes] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Historical calls log state
  const [callHistory, setCallHistory] = useState<Call[]>([]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      // Construct call queue from leads that are in 'Nuevo' or 'Contactado' status
      const { data: leadData } = await supabase
        .from("leads")
        .select("id, first_name, last_name, phone, email, status")
        .in("status", ["Nuevo", "Contactado"])
        .order("updated_at", { ascending: false });

      if (leadData) {
        setQueue(leadData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      if (profile?.id) {
        const { data } = await supabase
          .from("calls")
          .select("*")
          .eq("agent_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (data) setCallHistory(data as Call[]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchQueue();
      fetchHistory();
    }
  }, [profile]);

  // Timer effect
  useEffect(() => {
    if (callStatus === "active") {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Start Call
  const handleInitiateCall = (target: any) => {
    setActiveCall(target);
    setCallStatus("calling");
    setDuration(0);
    
    // Simulate connection after 2 seconds
    setTimeout(() => {
      setCallStatus("active");
    }, 2000);
  };

  // Hangup
  const handleHangup = () => {
    setCallStatus("wrap_up");
  };

  // Save Call disposition
  const handleSaveCallDisposition = async () => {
    if (!activeCall || !profile) return;
    try {
      const callData = {
        lead_id: activeCall.id,
        agent_id: profile.id,
        duration_seconds: duration,
        disposition: disposition as any,
        notes: notes,
      };

      const { data, error } = await supabase
        .from("calls")
        .insert(callData)
        .select()
        .single();

      if (!error && data) {
        // Log activity
        await supabase.from("activities").insert({
          lead_id: activeCall.id,
          user_id: profile.id,
          description: `Llamada completada (${duration}s). Disposición: ${disposition}. Notas: ${notes}`,
          type: "call",
        });

        // If disposition is "Depósito confirmado", update Lead status to "Depósito pendiente"
        if (disposition === "Depósito confirmado") {
          await supabase
            .from("leads")
            .update({ status: "Depósito pendiente" })
            .eq("id", activeCall.id);
        } else if (disposition === "Interesado") {
          await supabase
            .from("leads")
            .update({ status: "Interesado" })
            .eq("id", activeCall.id);
        }

        // Refresh Queue & History
        fetchQueue();
        fetchHistory();

        // Reset Active States
        setActiveCall(null);
        setCallStatus("idle");
        setNotes("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-[#050814] min-h-screen text-[#F8FAFC]">
      {/* Header */}
      <div className="border-b border-[rgba(212,175,55,0.15)] pb-4">
        <h1 className="text-2xl font-title font-bold text-[#F8FAFC]">Contact Center</h1>
        <p className="text-xs text-[#94A3B8] mt-1 font-sans">Cola de marcación institucional y registro de disposiciones de llamadas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Call Queue */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[rgba(212,175,55,0.1)]">
            <ListCollapse className="h-5 w-5 text-[#D4AF37]" />
            <h3 className="text-sm font-title font-bold text-[#D4AF37] uppercase tracking-wider">Cola de Llamadas</h3>
          </div>
          
          {loading ? (
            <div className="text-center py-10 text-[#D4AF37] text-xs">Cargando cola...</div>
          ) : queue.length === 0 ? (
            <div className="text-center py-10 text-[#64748B] text-xs">No hay llamadas pendientes en la cola.</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {queue.map(item => (
                <div 
                  key={item.id}
                  className="p-3 bg-[#0D1428] border border-[rgba(212,175,55,0.1)] rounded flex items-center justify-between hover:border-[#D4AF37] transition-all"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-[#F8FAFC]">{item.first_name} {item.last_name}</p>
                    <p className="text-[10px] text-[#94A3B8] font-mono">{item.phone || "Sin número"}</p>
                  </div>
                  <button 
                    disabled={callStatus !== "idle" || !item.phone}
                    onClick={() => handleInitiateCall(item)}
                    className="p-2 rounded-full bg-[rgba(212,175,55,0.1)] hover:bg-[#D4AF37] hover:text-[#050814] text-[#D4AF37] disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <PhoneCall className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center Column: Active Call Panel */}
        <div className="glass-card p-6 flex flex-col justify-between min-h-[450px]">
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[rgba(212,175,55,0.1)]">
              <PhoneCall className="h-5 w-5 text-[#D4AF37]" />
              <h3 className="text-sm font-title font-bold text-[#D4AF37] uppercase tracking-wider">Llamada Activa</h3>
            </div>

            {/* Calling / Active View */}
            {activeCall ? (
              <div className="space-y-6 text-center py-4">
                <div className="space-y-2">
                  <h4 className="text-lg font-title font-bold text-[#F8FAFC]">
                    {activeCall.first_name} {activeCall.last_name}
                  </h4>
                  <p className="text-sm text-[#D4AF37] font-mono">{activeCall.phone}</p>
                </div>

                {/* Status Indicator */}
                <div className="flex flex-col items-center gap-2">
                  <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                    callStatus === "calling" ? "bg-amber-950/20 text-amber-400 border border-amber-500/30 animate-pulse" :
                    callStatus === "active" ? "bg-green-950/20 text-green-400 border border-green-500/30" :
                    "bg-[#17213D] text-[#E6C766]"
                  }`}>
                    {callStatus === "calling" ? "Conectando..." : 
                     callStatus === "active" ? "En Línea" : 
                     "Tipificación"}
                  </span>
                  
                  {callStatus === "active" && (
                    <div className="text-2xl font-mono-numbers text-[#D4AF37] font-bold flex items-center gap-2 mt-2">
                      <Clock className="h-5 w-5 text-[#D4AF37]" />
                      <span>
                        {Math.floor(duration / 60).toString().padStart(2, "0")}:
                        {(duration % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Hang up button */}
                {(callStatus === "calling" || callStatus === "active") && (
                  <button 
                    onClick={handleHangup}
                    className="mx-auto flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-xs uppercase transition-all"
                  >
                    <PhoneOff className="h-4 w-4" /> Colgar
                  </button>
                )}

                {/* Wrap Up Form */}
                {callStatus === "wrap_up" && (
                  <div className="space-y-4 text-left pt-4 border-t border-[rgba(212,175,55,0.12)]">
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1">Disposición</label>
                      <select 
                        value={disposition}
                        onChange={(e) => setDisposition(e.target.value)}
                        className="px-3 py-1.5 w-full text-xs bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
                      >
                        <option value="Interesado">Interesado</option>
                        <option value="No interesado">No interesado</option>
                        <option value="Buzón">Buzón</option>
                        <option value="Callback">Callback</option>
                        <option value="Depósito confirmado">Depósito confirmado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1">Notas Comerciales</label>
                      <textarea 
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Escribe comentarios de la llamada..."
                        className="px-3 py-1.5 w-full text-xs bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#F8FAFC]"
                      />
                    </div>
                    <button 
                      onClick={handleSaveCallDisposition}
                      className="w-full gold-button-primary py-2 text-xs font-semibold rounded flex items-center justify-center gap-1.5"
                    >
                      <Save className="h-4 w-4" /> Guardar Disposición
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-[#64748B] text-xs">
                Selecciona un prospecto de la cola para iniciar la llamada institucional.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Historical logs */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[rgba(212,175,55,0.1)]">
            <History className="h-5 w-5 text-[#D4AF37]" />
            <h3 className="text-sm font-title font-bold text-[#D4AF37] uppercase tracking-wider">Llamadas Recientes</h3>
          </div>
          
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {callHistory.map(call => (
              <div key={call.id} className="p-3 bg-[#050814] border border-[rgba(212,175,55,0.08)] rounded text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    call.disposition === "Depósito confirmado" ? "bg-green-950/20 text-green-400" :
                    call.disposition === "Interesado" ? "bg-[rgba(212,175,55,0.05)] text-[#D4AF37]" :
                    "bg-[#17213D] text-[#94A3B8]"
                  }`}>
                    {call.disposition}
                  </span>
                  <span className="font-mono text-[#64748B]">{call.duration_seconds}s</span>
                </div>
                {call.notes && <p className="text-[#94A3B8] italic">"{call.notes}"</p>}
                <span className="text-[9px] text-[#64748B] block">{new Date(call.created_at).toLocaleString()}</span>
              </div>
            ))}
            {callHistory.length === 0 && (
              <p className="text-center text-xs text-[#64748B] py-10">No has registrado llamadas hoy.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
