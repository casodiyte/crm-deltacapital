import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Hash,
  Image as ImageIcon,
  Lock,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Smile,
  Copy,
  Sticker,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Channel, ChannelType, FileAttachment, Message, Profile } from "@/types";
import { getAttachmentUrl, isRenderableImage, openAttachment, removeAttachment, uploadAttachment, validateAttachment } from "@/lib/attachments";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmojiPicker } from "./EmojiPicker";

const STICKERS =["🎉", "🔥", "💯", "👏", "🚀", "🤝", "💰", "📈", "✅", "🙌", "😎", "🥳", "👀", "💪", "⭐", "🏆", "📞", "💬", "🫡", "🤑", "👍", "🙏", "😂", "❤️"];

const fullName = (profile?: Pick<Profile, "first_name" | "last_name" | "email">) =>
  profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email : "Usuario";

// A short message made only of emoji renders as a large "sticker", chat-style.
const isEmojiOnly = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 12 || /[0-9a-zA-Z]/.test(trimmed)) return false;
  return /\p{Extended_Pictographic}/u.test(trimmed);
};


/** Initials + a stable colour per person, so senders are told apart at a glance. */
const AVATAR_COLORS = ["#d4af37", "#00c9ff", "#22c55e", "#a78bfa", "#f59e0b", "#ef4444", "#38bdf8", "#f97316"];

const initialsOf = (profile?: Pick<Profile, "first_name" | "last_name" | "email">) => {
  if (!profile) return "?";
  const first = profile.first_name?.[0] ?? "";
  const last = profile.last_name?.[0] ?? "";
  return (first + last).toUpperCase() || (profile.email?.[0] ?? "?").toUpperCase();
};

const colorFor = (key: string) => {
  let hash = 0;
  for (let index = 0; index < key.length; index++) hash = (hash * 31 + key.charCodeAt(index)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const DAY_LABEL = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

const clockOf = (value: string) =>
  new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

/** Consecutive messages from the same person within 5 minutes read as one block. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const AttachmentPreview = ({ attachment }: { attachment: FileAttachment }) => {
  const [url, setUrl] = useState(attachment.url ?? "");
  useEffect(() => {
    let active = true;
    if (!attachment.url && isRenderableImage(attachment)) {
      void getAttachmentUrl(attachment).then((signedUrl) => active && setUrl(signedUrl)).catch(() => undefined);
    }
    return () => { active = false; };
  }, [attachment]);

  if (url && (isRenderableImage(attachment) || attachment.url)) {
    return (
      <button type="button" onClick={() => void openAttachment(attachment)} className="block overflow-hidden rounded-lg border border-border bg-muted/40">
        <img src={url} alt={attachment.name} className="max-h-56 w-full object-contain" loading="lazy" />
      </button>
    );
  }
  return (
    <button type="button" onClick={() => void openAttachment(attachment)} className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-xs text-foreground hover:border-primary/40">
      <FileText className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{attachment.name}</span>
    </button>
  );
};

export const ChatInterno = () => {
  const { profile } = useAuth();
  const { isSuperAdmin, isManager, auditBlocked, isRealSuperAdmin } = usePermissions();
  const canManagePublicChannels = !auditBlocked && (isSuperAdmin || isManager || isRealSuperAdmin);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [gifUrl, setGifUrl] = useState("");
  const [showGifInput, setShowGifInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<ChannelType>("privado");
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [confirmChannel, setConfirmChannel] = useState<Channel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const fetchChannels = useCallback(async () => {
    const { data, error: channelError } = await supabase.from("channels").select("*").order("name");
    if (channelError) { setError(channelError.message); return; }
    const nextChannels = (data ?? []) as Channel[];
    setChannels(nextChannels);
    setSelectedChannel((current) => nextChannels.find((item) => item.id === current?.id) ?? nextChannels[0] ?? null);
  }, []);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      fetchChannels(),
      supabase.from("profiles").select("*").not("is_trading_client", "is", true).eq("active", true).order("first_name").then(({ data }) => setAllUsers((data ?? []) as Profile[])),
    ]);
  }, [fetchChannels, profile]);

  const fetchMessages = useCallback(async (channelId: string) => {
    const { data, error: messageError } = await supabase
      .from("messages")
      .select("*, profiles(first_name, last_name, email)")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (messageError) { setError(messageError.message); return; }
    setMessages((data ?? []) as Message[]);
    window.setTimeout(scrollToBottom, 50);
  }, []);

  useEffect(() => {
    if (!selectedChannel) { setMessages([]); return; }
    void fetchMessages(selectedChannel.id);
    const subscription = supabase
      .channel(`messages_${selectedChannel.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${selectedChannel.id}` }, async (payload) => {
        if (payload.new.user_id === profile?.id) return;
        const { data: sender } = await supabase.from("profiles").select("first_name,last_name,email").eq("id", payload.new.user_id).maybeSingle();
        setMessages((current) => current.some((item) => item.id === payload.new.id) ? current : [...current, { ...(payload.new as Message), profiles: sender ?? undefined }]);
        window.setTimeout(scrollToBottom, 30);
      })
      .subscribe();
    return () => { void supabase.removeChannel(subscription); };
  }, [fetchMessages, profile?.id, selectedChannel]);

  const createChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id || !newChannelName.trim()) return;
    const type = canManagePublicChannels ? newChannelType : "privado";
    if (newChannelMembers.length === 0) {
      setError("Selecciona al menos un colaborador para el chat.");
      return;
    }
    setCreatingChannel(true); setError("");
    const members = Array.from(new Set([profile.id, ...newChannelMembers]));
    const { error: createError } = await supabase.from("channels").insert({
      name: newChannelName.trim(), type, members, created_by: profile.id,
    });
    setCreatingChannel(false);
    if (createError) { setError(createError.message); return; }
    setNewChannelName(""); setNewChannelType("privado"); setNewChannelMembers([]); setCreateOpen(false);
    await fetchChannels();
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id || !selectedChannel || auditBlocked || sending) return;
    const content = inputMessage.trim();
    const externalGif = gifUrl.trim();
    if (!content && pendingFiles.length === 0 && !externalGif) return;
    if (externalGif && !/^https:\/\//i.test(externalGif)) {
      setError("El GIF debe usar una URL segura que comience con https://");
      return;
    }
    setSending(true); setError("");
    const uploaded: FileAttachment[] = [];
    try {
      for (const file of pendingFiles) uploaded.push(await uploadAttachment(file, profile.id, `chat/${selectedChannel.id}`));
      if (externalGif) uploaded.push({ name: "GIF", path: `external-${crypto.randomUUID()}`, url: externalGif, type: "image/gif" });
      const tempId = crypto.randomUUID();
      const optimistic: Message = {
        id: tempId, channel_id: selectedChannel.id, user_id: profile.id,
        content: content || (externalGif ? "GIF" : "Archivo adjunto"), attachments: uploaded,
        created_at: new Date().toISOString(), profiles: profile,
      };
      setMessages((current) => [...current, optimistic]);
      setInputMessage(""); setPendingFiles([]); setGifUrl(""); setShowGifInput(false); setShowEmojiPicker(false); setShowStickers(false);
      window.setTimeout(scrollToBottom, 30);
      const { data, error: sendError } = await supabase.from("messages").insert({
        channel_id: selectedChannel.id, user_id: profile.id,
        content: optimistic.content, attachments: uploaded,
      }).select().single();
      if (sendError) throw sendError;
      setMessages((current) => current.map((message) => message.id === tempId ? { ...message, id: data.id } : message));
    } catch (sendError) {
      await Promise.allSettled(uploaded.filter((item) => !item.url).map(removeAttachment));
      setError(sendError instanceof Error ? sendError.message : "No se pudo enviar el mensaje.");
      await fetchMessages(selectedChannel.id);
    } finally {
      setSending(false);
    }
  };

  /** Accepts files from the picker and from a pasted screenshot alike. */
  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const rejected = incoming.map(validateAttachment).find(Boolean);
    setError(rejected ?? "");
    setPendingFiles((current) => [...current, ...incoming.filter((file) => !validateAttachment(file))]);
  };

  const sendSticker = async (emoji: string) => {
    if (!profile?.id || !selectedChannel || auditBlocked || sending) return;
    setShowStickers(false);
    setSending(true); setError("");
    const tempId = crypto.randomUUID();
    const optimistic: Message = {
      id: tempId, channel_id: selectedChannel.id, user_id: profile.id,
      content: emoji, attachments: [], created_at: new Date().toISOString(), profiles: profile,
    };
    setMessages((current) => [...current, optimistic]);
    window.setTimeout(scrollToBottom, 30);
    const { data, error: sendError } = await supabase.from("messages").insert({
      channel_id: selectedChannel.id, user_id: profile.id, content: emoji, attachments: [],
    }).select().single();
    if (sendError) { setError(sendError.message); await fetchMessages(selectedChannel.id); }
    else setMessages((current) => current.map((message) => message.id === tempId ? { ...message, id: data.id } : message));
    setSending(false);
  };

  const deleteChannel = async () => {
    if (!confirmChannel) return;
    const { error: deleteError } = await supabase.from("channels").delete().eq("id", confirmChannel.id);
    if (deleteError) setError(deleteError.message);
    else {
      setSelectedChannel(null);
      await fetchChannels();
    }
    setConfirmChannel(null);
  };

  const canDeleteChannel = (channel: Channel) => canManagePublicChannels || channel.created_by === profile?.id;

  return (
    <section className="app-page gap-3" aria-labelledby="chat-title">
      <header className="app-page-header">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><MessageSquare className="h-4 w-4" /> Colaboración interna</p><h1 id="chat-title" className="font-title text-2xl font-bold text-foreground sm:text-3xl">Chat interno</h1><p className="mt-1 text-sm text-muted-foreground">Canales por área, grupos privados y archivos en un solo espacio.</p></div>
        {canManagePublicChannels && <button type="button" onClick={() => setCreateOpen(true)} className="gold-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold"><Plus className="h-4 w-4" /> Nuevo chat</button>}
      </header>
      {error && <div role="alert" className="flex justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => setError("")} className="font-semibold underline">Cerrar</button></div>}

      <div className="app-panel relative flex min-h-[600px] flex-1 overflow-hidden lg:h-[calc(100dvh-250px)]">
        {mobileChannelsOpen && <button type="button" aria-label="Cerrar canales" onClick={() => setMobileChannelsOpen(false)} className="absolute inset-0 z-20 bg-black/45 lg:hidden" />}
        <aside className={`absolute inset-y-0 left-0 z-30 flex w-[min(19rem,86vw)] flex-col border-r border-border bg-card transition-transform lg:static lg:w-72 lg:translate-x-0 ${mobileChannelsOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex min-h-16 items-center justify-between border-b border-border px-4">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Conversaciones</p><p className="text-[11px] text-muted-foreground">{channels.length} disponibles</p></div>
            <button type="button" onClick={() => setMobileChannelsOpen(false)} className="app-icon-button lg:hidden" aria-label="Cerrar lista"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {channels.map((channel) => (
              <div key={channel.id} className="group relative">
                <button
                  type="button"
                  onClick={() => { setSelectedChannel(channel); setMobileChannelsOpen(false); }}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 pr-11 text-left transition-colors ${selectedChannel?.id === channel.id ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold"
                    style={{
                      background: `color-mix(in srgb, ${colorFor(channel.id)} 18%, transparent)`,
                      color: colorFor(channel.id),
                    }}
                  >
                    {channel.type === "privado" ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{channel.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {(channel.members?.length ?? 0) > 0
                        ? `${channel.members?.length} participante${channel.members?.length === 1 ? "" : "s"}`
                        : channel.type === "privado" ? "Privado" : channel.type}
                    </span>
                  </span>
                </button>
                {canDeleteChannel(channel) && <button type="button" onClick={() => setConfirmChannel(channel)} className="app-icon-button absolute right-1.5 top-1.5 h-9 w-9 opacity-100 hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100" aria-label={`Eliminar ${channel.name}`}><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
            {channels.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No hay conversaciones disponibles.</p>}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-16 items-center gap-3 border-b border-border px-3 sm:px-4">
            <button type="button" onClick={() => setMobileChannelsOpen(true)} className="app-icon-button lg:hidden" aria-label="Abrir canales"><Menu className="h-4 w-4" /></button>
            {selectedChannel ? <><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">{selectedChannel.type === "privado" ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}</span><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-foreground">{selectedChannel.name}</h2><p className="text-xs text-muted-foreground">{selectedChannel.type === "privado" ? `${selectedChannel.members?.length ?? 0} participantes` : "Canal interno"}</p></div></> : <p className="text-sm text-muted-foreground">Selecciona una conversación</p>}
          </div>

          {selectedChannel ? (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-5">
                {messages.map((message, index) => {
                  const own = message.user_id === profile?.id;
                  const previous = index > 0 ? messages[index - 1] : undefined;
                  const sticker = isEmojiOnly(message.content ?? "") && (!message.attachments || message.attachments.length === 0);

                  const newDay = !previous || DAY_LABEL(previous.created_at) !== DAY_LABEL(message.created_at);
                  const grouped =
                    !newDay &&
                    previous?.user_id === message.user_id &&
                    new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < GROUP_WINDOW_MS;

                  const senderName = fullName(message.profiles);
                  const accent = colorFor(message.user_id ?? senderName);

                  return (
                    <div key={message.id}>
                      {newDay && (
                        <div className="my-4 flex items-center gap-3">
                          <span className="h-px flex-1 bg-border" />
                          <span className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {DAY_LABEL(message.created_at)}
                          </span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                      )}

                      <article
                        className={`group/msg flex max-w-[92%] select-text items-end gap-2 sm:max-w-[76%] ${grouped ? "mt-0.5" : "mt-3"} ${own ? "ml-auto flex-row-reverse" : ""}`}
                      >
                        {grouped ? (
                          <span className="w-8 shrink-0" aria-hidden="true" />
                        ) : (
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                            style={{ background: `color-mix(in srgb, ${accent} 20%, transparent)`, color: accent }}
                            title={senderName}
                          >
                            {initialsOf(message.profiles)}
                          </span>
                        )}

                        <div className={`min-w-0 ${own ? "items-end" : "items-start"} flex flex-col`}>
                          {!grouped && !own && (
                            <span className="mb-1 px-1 text-[11px] font-bold" style={{ color: accent }}>
                              {senderName}
                            </span>
                          )}

                          {sticker ? (
                            <p className="px-1 text-[3rem] leading-none">{message.content}</p>
                          ) : (
                            <div
                              className={`relative px-3 py-2 text-left text-sm leading-relaxed shadow-sm ${
                                own
                                  ? `bg-primary text-primary-foreground ${grouped ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"}`
                                  : `border border-border bg-card text-foreground ${grouped ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-sm"}`
                              }`}
                            >
                              {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className={`grid gap-2 ${message.content ? "mt-2" : ""}`}>
                                  {message.attachments.map((attachment) => (
                                    <AttachmentPreview key={`${attachment.path}-${attachment.url ?? ""}`} attachment={attachment} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <span className={`mt-0.5 flex items-center gap-2 px-1 ${own ? "flex-row-reverse" : ""}`}>
                            <span className="text-[10px] tabular-nums text-muted-foreground">{clockOf(message.created_at)}</span>
                            {message.content && !sticker && (
                              <button
                                type="button"
                                onClick={() => void navigator.clipboard.writeText(message.content).catch(() => undefined)}
                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/msg:opacity-100 focus-visible:opacity-100"
                                title="Copiar mensaje"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        </div>
                      </article>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="grid h-full min-h-64 place-items-center text-center">
                    <div>
                      <MessageSquare className="mx-auto mb-3 h-9 w-9 text-primary/45" />
                      <p className="font-semibold text-foreground">Inicia la conversación</p>
                      <p className="text-sm text-muted-foreground">Comparte una actualización o adjunta un archivo.</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {!auditBlocked && <form onSubmit={sendMessage} className="relative border-t border-border bg-card p-3 sm:p-4">
                {pendingFiles.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{pendingFiles.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted px-2.5 text-xs"><Paperclip className="h-3.5 w-3.5 text-primary" /><span className="max-w-40 truncate">{file.name}</span><button type="button" onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Quitar ${file.name}`}><X className="h-3.5 w-3.5" /></button></span>)}</div>}
                {showGifInput && <div className="mb-2 flex gap-2"><input value={gifUrl} onChange={(event) => setGifUrl(event.target.value)} placeholder="Pega una URL https:// de GIF" className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /><button type="button" onClick={() => { setShowGifInput(false); setGifUrl(""); }} className="app-icon-button" aria-label="Quitar GIF"><X className="h-4 w-4" /></button></div>}
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-2 z-40 mb-2 shadow-2xl">
                    <EmojiPicker onSelect={(emoji) => setInputMessage((current) => `${current}${emoji}`)} />
                  </div>
                )}
                {showStickers && (
                  <div className="absolute bottom-full left-2 z-40 mb-2 w-[min(20rem,90vw)] rounded-xl border border-border bg-popover p-2 shadow-2xl">
                    <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Stickers</p>
                    <div className="grid grid-cols-6 gap-1">
                      {STICKERS.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => void sendSticker(emoji)} className="grid h-11 w-11 place-items-center rounded-lg text-2xl transition-transform hover:scale-110 hover:bg-accent" aria-label={`Enviar sticker ${emoji}`}>{emoji}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex gap-1">
                    <label className="app-icon-button cursor-pointer" aria-label="Adjuntar archivos"><Paperclip className="h-4 w-4" /><input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" className="sr-only" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
                    <button type="button" onClick={() => { setShowEmojiPicker((value) => !value); setShowStickers(false); }} className={`app-icon-button ${showEmojiPicker ? "bg-accent text-primary" : ""}`} aria-label="Agregar emoji"><Smile className="h-4 w-4" /></button>
                    <button type="button" onClick={() => { setShowStickers((value) => !value); setShowEmojiPicker(false); }} className={`app-icon-button ${showStickers ? "bg-accent text-primary" : ""}`} aria-label="Enviar sticker"><Sticker className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setShowGifInput((value) => !value)} className="app-icon-button" aria-label="Agregar GIF"><ImageIcon className="h-4 w-4" /></button>
                  </div>
                  <textarea rows={1} value={inputMessage} onChange={(event) => setInputMessage(event.target.value)} onPaste={(event) => { const pasted = Array.from(event.clipboardData.files); if (pasted.length === 0) return; event.preventDefault(); addFiles(pasted); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`Mensaje en ${selectedChannel.name}`} className="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <button type="submit" disabled={sending || (!inputMessage.trim() && pendingFiles.length === 0 && !gifUrl.trim())} className="gold-button-primary grid h-11 w-11 shrink-0 place-items-center rounded-lg disabled:opacity-45" aria-label="Enviar mensaje"><Send className="h-4 w-4" /></button>
                </div>
              </form>}
            </>
          ) : <div className="grid flex-1 place-items-center p-8 text-center"><div><Hash className="mx-auto mb-3 h-10 w-10 text-primary/40" /><p className="font-semibold text-foreground">Selecciona una conversación</p><p className="text-sm text-muted-foreground">Abre un canal o crea un chat privado.</p></div></div>}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Nuevo chat</DialogTitle><DialogDescription>{canManagePublicChannels ? "Crea un canal general o una conversación privada." : "Crea una conversación privada con uno o varios colaboradores."}</DialogDescription></DialogHeader>
          <form id="create-channel-form" onSubmit={createChannel} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">Nombre<input value={newChannelName} onChange={(event) => setNewChannelName(event.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            {canManagePublicChannels && <label className="grid gap-1.5 text-sm font-medium">Tipo<select value={newChannelType} onChange={(event) => setNewChannelType(event.target.value as ChannelType)} className="h-11 rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="privado">Privado</option><option value="general">General</option><option value="ventas">Ventas</option><option value="soporte">Supervisión</option><option value="alertas">Líderes</option></select></label>}
            <fieldset className="grid gap-2"><legend className="text-sm font-medium">Participantes</legend><div className="grid max-h-60 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">{allUsers.filter((user) => user.id !== profile?.id).map((user) => <label key={user.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-accent"><input type="checkbox" checked={newChannelMembers.includes(user.id)} onChange={(event) => setNewChannelMembers((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} className="h-4 w-4 accent-primary" /><span className="min-w-0 text-sm"><span className="block truncate font-medium">{fullName(user)}</span><span className="block truncate text-[10px] text-muted-foreground">{user.department}</span></span></label>)}</div></fieldset>
          </form>
          <DialogFooter><button type="button" onClick={() => setCreateOpen(false)} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-accent">Cancelar</button><button form="create-channel-form" type="submit" disabled={creatingChannel} className="gold-button-primary min-h-11 rounded-lg px-4 text-sm font-bold disabled:opacity-50">{creatingChannel ? "Creando…" : "Crear chat"}</button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmModal isOpen={Boolean(confirmChannel)} title="Eliminar conversación" message={`¿Deseas eliminar “${confirmChannel?.name ?? "esta conversación"}” y todos sus mensajes?`} onConfirm={() => void deleteChannel()} onCancel={() => setConfirmChannel(null)} />
    </section>
  );
};
