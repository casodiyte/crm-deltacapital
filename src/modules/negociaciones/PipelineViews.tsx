import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Eye,
  GripVertical,
  Pencil,
  RotateCcw,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Activity, Deal, Lead } from "@/types";
import {
  CONTACT_OUTCOME_CONFIG,
  PIPELINE_STAGES,
  STAGE_CONFIG,
  formatCurrency,
  isPipelineStage,
  type PipelineStage,
} from "./pipeline";
import { stageMeta } from "./pipelines";
import { relativeTime, clockTime } from "@/lib/relativeTime";

type OutcomeValue = NonNullable<Lead["contact_outcome"]>;
type OutcomeChangeHandler = (lead: Lead, outcome: OutcomeValue) => void;

/** Cards rendered per column — the board stays responsive with large pipelines. */
const CARDS_PER_STAGE = 50;


/**
 * Typification chip. Read-only when no handler is supplied; otherwise an inline
 * select that writes straight to the prospect, so the pipeline and the
 * Prospectos screen always share one record.
 */
const OutcomeBadge = ({ lead, onOutcomeChange }: { lead?: Lead; onOutcomeChange?: OutcomeChangeHandler }) => {
  const outcome: OutcomeValue = lead?.contact_outcome ?? "pending";
  const config = CONTACT_OUTCOME_CONFIG[outcome] ?? CONTACT_OUTCOME_CONFIG.pending;

  if (!lead || !onOutcomeChange) {
    // A deal with no linked prospect has no typification to speak of. One that
    // does is always labelled, even when unclassified -- hiding it read it as
    // "the typification is missing" rather than "nobody has classified it yet".
    if (!lead) return null;
    return (
      <span
        className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
        style={{
          color: config.color,
          background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${config.color} 25%, transparent)`,
        }}
        title={`Tipificación: ${config.label}`}
      >
        {config.label}
      </span>
    );
  }

  return (
    <select
      value={outcome}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => { event.stopPropagation(); onOutcomeChange(lead, event.target.value as OutcomeValue); }}
      className="max-w-full cursor-pointer truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        color: config.color,
        background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${config.color} 25%, transparent)`,
      }}
      aria-label={`Tipificación de ${lead.first_name} ${lead.last_name}`}
      title="Tipificación del prospecto"
    >
      {(Object.keys(CONTACT_OUTCOME_CONFIG) as OutcomeValue[]).map((value) => (
        <option key={value} value={value} className="bg-popover font-semibold text-foreground">
          {CONTACT_OUTCOME_CONFIG[value].label}
        </option>
      ))}
    </select>
  );
};

interface SharedDealProps {
  deals: Deal[];
  leads: Lead[];
  onOpenDeal: (deal: Deal) => void;
  onEditDeal: (deal: Deal) => void;
  onDeleteDeal: (deal: Deal) => void;
  canDelete?: boolean;
  onOutcomeChange?: OutcomeChangeHandler;
}

interface KanbanViewProps extends SharedDealProps {
  /** Stages of the active pipeline — the board renders one column per stage. */
  stages: readonly PipelineStage[];
  leadsWithoutDeal: Lead[];
  dragOverStage: PipelineStage | null;
  onDragStart: (event: React.DragEvent, dealId: string) => void;
  onDragOver: (event: React.DragEvent, stage: PipelineStage) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent, stage: PipelineStage) => void;
  onCreateFromLead: (lead: Lead) => void;
  canDelete: boolean;
}

const getLead = (deal: Deal, leads: Lead[]) => leads.find((lead) => lead.id === deal.lead_id);

export const KanbanView = ({
  stages,
  deals,
  leads,
  leadsWithoutDeal,
  dragOverStage,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenDeal,
  onEditDeal,
  onDeleteDeal,
  onCreateFromLead,
  canDelete,
  onOutcomeChange,
}: KanbanViewProps) => (
  <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
    style={{ gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))` }}>
    {stages.map((stage) => {
      const config = stageMeta(stage);
      const stageDeals = deals.filter((deal) => deal.stage === stage);
      const showUnlinkedLeads = stage === "Nuevo lead";
      const total = stageDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
      const isDragTarget = dragOverStage === stage;

      return (
        <section
          key={stage}
          aria-label={`Etapa ${stage}`}
          onDragOver={(event) => onDragOver(event, stage)}
          onDragLeave={onDragLeave}
          onDrop={(event) => onDrop(event, stage)}
          className={`flex min-h-64 min-w-0 flex-col rounded-2xl border transition-colors ${isDragTarget ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border/60 bg-background/50"}`}
        >
          <header className="rounded-t-2xl border-b border-border/60 px-3 py-2.5" style={{ borderTop: `3px solid ${config.color}` }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: config.color }} />
                <h2 className="truncate text-[11px] font-bold uppercase tracking-wider" style={{ color: config.color }}>
                  {config.shortLabel}
                </h2>
              </div>
              <span className="inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold" style={{ color: config.color, background: `color-mix(in srgb, ${config.color} 14%, transparent)` }}>
                {stageDeals.length + (showUnlinkedLeads ? leadsWithoutDeal.length : 0)}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{formatCurrency(total)}</p>
          </header>

          <div className="flex-1 space-y-2.5 p-2.5">
            {stageDeals.slice(0, CARDS_PER_STAGE).map((deal) => {
              const lead = getLead(deal, leads);
              return (
                <article
                  key={deal.id}
                  draggable
                  onDragStart={(event) => onDragStart(event, deal.id)}
                  onClick={() => onOpenDeal(deal)}
                  className="group relative cursor-pointer rounded-xl border border-border bg-card p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                  style={{ borderLeft: `3px solid ${config.color}` }}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-foreground">{deal.name}</h3>
                      <p className="font-display mt-1 text-[15px] font-bold tabular-nums" style={{ color: config.color }}>
                        {formatCurrency(deal.value, deal.currency)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <OutcomeBadge lead={lead} onOutcomeChange={onOutcomeChange} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 border-t border-border pt-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      {lead ? (
                        <>
                          <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{lead.first_name} {lead.last_name}</span>
                        </>
                      ) : (
                        <span className="italic text-muted-foreground/60">Sin prospecto</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                      <Clock3 className="h-3 w-3 shrink-0" />
                      <span>{relativeTime(deal.updated_at)}</span>
                    </div>
                    <div className="mt-1.5 flex shrink-0 justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onEditDeal(deal); }}
                        className="app-icon-button min-h-8 min-w-8"
                        aria-label={`Editar ${deal.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); onDeleteDeal(deal); }}
                          className="app-icon-button min-h-8 min-w-8 hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Eliminar ${deal.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {stageDeals.length > CARDS_PER_STAGE && (
              <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                Mostrando {CARDS_PER_STAGE} de {stageDeals.length}. Usa la vista Lista para consultar todos.
              </p>
            )}

            {showUnlinkedLeads && leadsWithoutDeal.slice(0, 50).map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => onCreateFromLead(lead)}
                className="min-h-14 w-full rounded-lg border border-dashed border-border bg-muted/35 p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="block truncate text-xs font-semibold">{lead.first_name} {lead.last_name}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">Capturar depósito y crear negociación</span>
              </button>
            ))}

            {stageDeals.length === 0 && !(showUnlinkedLeads && leadsWithoutDeal.length > 0) && (
              <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                {isDragTarget ? "Suelta la negociación aquí" : "Sin negociaciones"}
              </div>
            )}
          </div>
        </section>
      );
    })}
  </div>
);

interface DealsListViewProps extends SharedDealProps {
  onStageChange?: (deal: Deal, stage: PipelineStage) => void;
  canMutate?: boolean;
}

export const DealsListView = ({ deals, leads, onOpenDeal, onEditDeal, onDeleteDeal, canDelete, onStageChange, canMutate, onOutcomeChange }: DealsListViewProps) => (
  <div className="app-surface overflow-hidden">
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Negociación</th>
            <th className="px-4 py-3 font-semibold">Etapa</th>
            <th className="px-4 py-3 font-semibold">Prospecto</th>
            <th className="px-4 py-3 text-right font-semibold">Importe</th>
            <th className="px-4 py-3 font-semibold">Actualizado</th>
            <th className="w-32 px-4 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const stage = isPipelineStage(deal.stage) ? deal.stage : "Nuevo lead";
            const config = STAGE_CONFIG[stage];
            const lead = getLead(deal, leads);
            return (
              <tr key={deal.id} className="border-t border-border transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onOpenDeal(deal)} className="font-semibold text-foreground hover:text-primary hover:underline">
                    {deal.name}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {canMutate && onStageChange ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Circle className="h-2.5 w-2.5 shrink-0 fill-current" style={{ color: config.color }} />
                      <select
                        value={stage}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onStageChange(deal, event.target.value as PipelineStage)}
                        className="cursor-pointer rounded-md border border-transparent bg-transparent py-1 pl-1 pr-5 text-xs font-semibold outline-none transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ color: config.color }}
                        aria-label={`Cambiar etapa de ${deal.name}`}
                      >
                        {PIPELINE_STAGES.map((option) => (
                          <option key={option} value={option} className="bg-popover text-foreground">{STAGE_CONFIG[option].shortLabel}</option>
                        ))}
                      </select>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: config.color }}>
                      <Circle className="h-2.5 w-2.5 fill-current" /> {config.shortLabel}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate">{lead ? `${lead.first_name} ${lead.last_name}` : "Sin asociar"}</span>
                    <OutcomeBadge lead={lead} onOutcomeChange={onOutcomeChange} />
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(deal.value, deal.currency)}</td>
                <td className="px-4 py-3 text-[11px] text-muted-foreground">
                  <span className="block">{relativeTime(deal.updated_at)}</span>
                  <span className="block font-semibold">{clockTime(deal.updated_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => onOpenDeal(deal)} className="app-icon-button" aria-label={`Ver ${deal.name}`}><Eye className="h-4 w-4" /></button>
                    <button type="button" onClick={() => onEditDeal(deal)} className="app-icon-button" aria-label={`Editar ${deal.name}`}><Pencil className="h-4 w-4" /></button>
                    {canDelete && <button type="button" onClick={() => onDeleteDeal(deal)} className="app-icon-button hover:bg-destructive/10 hover:text-destructive" aria-label={`Eliminar ${deal.name}`}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <div className="divide-y divide-border md:hidden">
      {deals.map((deal) => {
        const stage = isPipelineStage(deal.stage) ? deal.stage : "Nuevo lead";
        const config = STAGE_CONFIG[stage];
        const lead = getLead(deal, leads);
        return (
          <button key={deal.id} type="button" onClick={() => onOpenDeal(deal)} className="min-h-24 w-full p-4 text-left transition-colors hover:bg-muted/40">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{deal.name}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{lead ? `${lead.first_name} ${lead.last_name}` : "Sin prospecto"}</span>
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(deal.value, deal.currency)}</span>
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: config.color }}>
                <Circle className="h-2.5 w-2.5 fill-current" /> {config.label}
              </span>
              <OutcomeBadge lead={lead} />
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

interface ActivitiesViewProps {
  activities: Activity[];
  deals: Deal[];
  onOpenDeal: (deal: Deal) => void;
  onComplete: (activity: Activity) => void;
  onPostpone: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  canManage?: (activity: Activity) => boolean;
}

const getActivityDate = (activity: Activity) => new Date(activity.due_at || activity.created_at);

export const ActivitiesView = ({ activities, deals, onOpenDeal, onComplete, onPostpone, onDelete, canManage = () => true }: ActivitiesViewProps) => {
  const orderedActivities = [...activities].sort((left, right) => getActivityDate(left).getTime() - getActivityDate(right).getTime());

  return (
    <div className="app-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Seguimiento programado</h2>
        <p className="text-xs text-muted-foreground">Completa, pospón o elimina actividades sin perder el historial.</p>
      </div>
      <div className="divide-y divide-border">
        {orderedActivities.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Aún no hay actividades programadas.</div>
        )}
        {orderedActivities.map((activity) => {
          const deal = deals.find((item) => item.id === activity.deal_id);
          const isCompleted = activity.status === "completed" || Boolean(activity.completed_at);
          const date = getActivityDate(activity);
          const isOverdue = !isCompleted && date.getTime() < Date.now();
          const manageable = canManage(activity);
          return (
            <article key={activity.id} className="grid gap-3 p-4 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isCompleted ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <h3 className={`truncate text-sm font-semibold ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {activity.title || activity.description}
                  </h3>
                  {activity.title && activity.description && activity.title !== activity.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{activity.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className={isOverdue ? "font-semibold text-destructive" : undefined}>
                      {date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    {deal && (
                      <button type="button" onClick={() => onOpenDeal(deal)} className="font-medium text-primary hover:underline">{deal.name}</button>
                    )}
                  </div>
                </div>
              </div>
              {manageable && <div className="flex flex-wrap items-center gap-2 pl-12 md:pl-0">
                {!isCompleted && (
                  <Button size="sm" onClick={() => onComplete(activity)}><CheckCircle2 /> Completar</Button>
                )}
                {!isCompleted && (
                  <Button size="sm" variant="outline" onClick={() => onPostpone(activity)}><RotateCcw /> Posponer</Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => onDelete(activity)} aria-label="Eliminar actividad" className="hover:bg-destructive/10 hover:text-destructive"><Trash2 /></Button>
              </div>}
            </article>
          );
        })}
      </div>
    </div>
  );
};

interface CalendarViewProps {
  activities: Activity[];
  deals: Deal[];
  month: Date;
  onMonthChange: (month: Date) => void;
  onOpenDeal: (deal: Deal) => void;
}

const startOfCalendar = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);
};

export const CalendarView = ({ activities, deals, month, onMonthChange, onOpenDeal }: CalendarViewProps) => {
  const start = startOfCalendar(month);
  const days = Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const monthActivities = [...activities].sort((left, right) => getActivityDate(left).getTime() - getActivityDate(right).getTime());

  return (
    <div className="app-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-title text-base font-semibold capitalize">{month.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</h2>
          <p className="text-xs text-muted-foreground">Agenda de seguimientos y recordatorios</p>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mes anterior"><ChevronLeft /></Button>
          <Button size="icon" variant="ghost" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mes siguiente"><ChevronRight /></Button>
        </div>
      </div>

      <div className="hidden grid-cols-7 md:grid">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div key={day} className="border-b border-r border-border bg-muted/50 px-2 py-2 text-center text-xs font-semibold text-muted-foreground last:border-r-0">{day}</div>
        ))}
        {days.map((day) => {
          const items = monthActivities.filter((activity) => getActivityDate(activity).toDateString() === day.toDateString());
          const inMonth = day.getMonth() === month.getMonth();
          const today = day.toDateString() === new Date().toDateString();
          return (
            <div key={day.toISOString()} className={`min-h-28 border-b border-r border-border p-2 last:border-r-0 ${inMonth ? "bg-card" : "bg-muted/25 text-muted-foreground"}`}>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs ${today ? "bg-primary font-bold text-primary-foreground" : ""}`}>{day.getDate()}</span>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((activity) => {
                  const deal = deals.find((item) => item.id === activity.deal_id);
                  return (
                    <button key={activity.id} type="button" onClick={() => deal && onOpenDeal(deal)} className="block w-full truncate rounded bg-primary/10 px-1.5 py-1 text-left text-[10px] font-medium text-primary hover:bg-primary/15">
                      {getActivityDate(activity).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} {activity.title || activity.description}
                    </button>
                  );
                })}
                {items.length > 3 && <p className="text-[10px] text-muted-foreground">+{items.length - 3} más</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="divide-y divide-border md:hidden">
        {monthActivities.filter((activity) => getActivityDate(activity).getMonth() === month.getMonth()).map((activity) => {
          const deal = deals.find((item) => item.id === activity.deal_id);
          return (
            <button key={activity.id} type="button" onClick={() => deal && onOpenDeal(deal)} className="flex min-h-16 w-full items-center gap-3 p-4 text-left hover:bg-muted/30">
              <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="text-[9px] uppercase">{getActivityDate(activity).toLocaleDateString("es-MX", { month: "short" })}</span>
                <span className="text-sm font-bold">{getActivityDate(activity).getDate()}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{activity.title || activity.description}</span>
                <span className="block text-xs text-muted-foreground">{getActivityDate(activity).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
              </span>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
        {monthActivities.filter((activity) => getActivityDate(activity).getMonth() === month.getMonth()).length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Sin actividades este mes.</p>
        )}
      </div>
    </div>
  );
};
