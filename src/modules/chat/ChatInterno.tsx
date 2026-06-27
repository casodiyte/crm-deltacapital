import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import type { Channel, Message } from "@/types";
import { MessageSquare, Send, Hash, User } from "lucide-react";

export const ChatInterno = () => {
  const { profile } = useAuth();
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch Channels
  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("name", { ascending: true });

      if (!error && data) {
        setChannels(data as Channel[]);
        if (data.length > 0) {
          setSelectedChannel(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  // Fetch Messages for Selected Channel
  const fetchMessages = async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*, profiles(first_name, last_name, email)")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id);

      // Subscribe to Realtime messages for the channel
      const subscription = supabase
        .channel(`messages_channel_${selectedChannel.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${selectedChannel.id}`,
          },
          async (payload) => {
            // Fetch profile for the new message
            const { data: profileData } = await supabase
              .from("profiles")
              .select("first_name, last_name, email")
              .eq("id", payload.new.user_id)
              .single();

            const newMessageWithProfile: Message = {
              ...(payload.new as Message),
              profiles: profileData || undefined,
            };

            setMessages((prev) => [...prev, newMessageWithProfile]);
            setTimeout(scrollToBottom, 100);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [selectedChannel]);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedChannel || !profile) return;

    try {
      const { error } = await supabase.from("messages").insert({
        channel_id: selectedChannel.id,
        user_id: profile.id,
        content: inputMessage,
      });

      if (!error) {
        setInputMessage("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-[#050814] text-[#F8FAFC]">
      {/* Channels Sidebar */}
      <div className="w-64 bg-[#0D1428] border-r border-[rgba(212,175,55,0.15)] flex flex-col">
        <div className="p-4 border-b border-[rgba(212,175,55,0.12)] bg-[#111A33] flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#D4AF37]" />
          <h3 className="text-sm font-title font-bold text-[#D4AF37] uppercase tracking-wider">Canales de Chat</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {channels.map((chan) => (
            <button
              key={chan.id}
              onClick={() => setSelectedChannel(chan)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded font-medium transition-all ${
                selectedChannel?.id === chan.id
                  ? "bg-[rgba(212,175,55,0.12)] text-[#D4AF37] border-l-2 border-[#D4AF37]"
                  : "text-[#94A3B8] hover:bg-[rgba(212,175,55,0.05)] hover:text-[#F8FAFC]"
              }`}
            >
              <Hash className="h-3.5 w-3.5" />
              <span className="truncate">{chan.name}</span>
            </button>
          ))}
          {channels.length === 0 && (
            <p className="text-center text-xs text-[#64748B] pt-4">No hay canales de comunicación.</p>
          )}
        </div>
      </div>

      {/* Messages Panel */}
      <div className="flex-1 flex flex-col justify-between bg-[rgba(13,20,40,0.2)]">
        {selectedChannel ? (
          <>
            {/* Active Channel Header */}
            <div className="p-4 border-b border-[rgba(212,175,55,0.12)] bg-[#111A33] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-[#D4AF37]" />
                <h4 className="text-sm font-title font-bold text-[#F8FAFC]">{selectedChannel.name}</h4>
              </div>
              <span className="text-[10px] bg-[rgba(212,175,55,0.05)] border border-[rgba(212,175,55,0.15)] px-2 py-0.5 rounded text-[#D4AF37] uppercase font-bold tracking-wider">
                {selectedChannel.type}
              </span>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => {
                const isOwnMessage = msg.user_id === profile?.id;
                return (
                  <div 
                    key={msg.id}
                    className={`flex items-start gap-3 max-w-[70%] ${isOwnMessage ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)]">
                      <User className="h-4 w-4 text-[#D4AF37]" />
                    </div>
                    
                    <div className="space-y-1">
                      <div className={`flex items-center gap-2 text-[10px] text-[#64748B] ${isOwnMessage ? "justify-end" : ""}`}>
                        <span className="font-semibold text-[#94A3B8]">
                          {msg.profiles?.first_name ? `${msg.profiles.first_name} ${msg.profiles.last_name}` : msg.profiles?.email || "Usuario"}
                        </span>
                        <span>•</span>
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      
                      <div className={`p-3 rounded text-xs leading-relaxed ${
                        isOwnMessage 
                          ? "bg-[#D4AF37] text-[#050814] rounded-tr-none font-medium" 
                          : "bg-[#111A33] border border-[rgba(212,175,55,0.15)] text-[#F8FAFC] rounded-tl-none"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-[rgba(212,175,55,0.15)] bg-[#0D1428] flex gap-3">
              <input 
                type="text" 
                placeholder={`Escribe un mensaje en #${selectedChannel.name}...`}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 px-4 py-2 text-xs bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-white"
              />
              <button 
                type="submit"
                className="gold-button-primary p-2 px-4 rounded text-xs font-semibold flex items-center gap-1.5"
              >
                <Send className="h-4 w-4" /> Enviar
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#64748B] space-y-2">
            <Hash className="h-10 w-10 text-[rgba(212,175,55,0.2)]" />
            <p className="text-xs">No hay ningún canal seleccionado.</p>
          </div>
        )}
      </div>
    </div>
  );
};
