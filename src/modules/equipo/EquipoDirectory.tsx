import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Crown,
  Mail,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Department, Profile, Team } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEPARTMENTS: Department[] = ["Ventas", "Retencion", "Cumplimiento"];
const DEPARTMENT_LABELS: Record<Department, string> = {
  Ventas: "Ventas",
  Retencion: "Retención",
  Cumplimiento: "Cumplimiento",
};

interface TeamFormState {
  id: string | null;
  name: string;
  description: string;
  department: Department;
  leaderId: string;
  memberIds: string[];
  active: boolean;
}

const emptyTeamForm = (department: Department): TeamFormState => ({
  id: null,
  name: "",
  description: "",
  department,
  leaderId: "",
  memberIds: [],
  active: true,
});

const fullName = (profile?: Profile) =>
  profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email : "Sin asignar";

export const EquipoDirectory = () => {
  const { profile: currentProfile } = useAuth();
  const { isSuperAdmin, isManager, auditBlocked, isRealSuperAdmin } = usePermissions();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<Department | "">("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [teamForm, setTeamForm] = useState<TeamFormState>(() =>
    emptyTeamForm(currentProfile?.department ?? "Ventas"),
  );
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const canConfigure = !auditBlocked && (isSuperAdmin || isManager || isRealSuperAdmin);

  const fetchDirectory = useCallback(async () => {
    setLoading(true);
    const [{ data: profileData }, { data: teamData }] = await Promise.all([
      supabase.from("profiles").select("*").not("is_trading_client", "is", true).eq("active", true).order("first_name"),
      supabase.from("teams").select("*").order("name"),
    ]);
    setProfiles((profileData ?? []) as Profile[]);
    setTeams((teamData ?? []) as Team[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDirectory();
  }, [fetchDirectory]);

  const visibleTeams = useMemo(() => {
    const managerDepartment = isManager ? currentProfile?.department : undefined;
    return teams.filter((team) => {
      if (managerDepartment && team.department !== managerDepartment) return false;
      if (department && team.department !== department) return false;
      if (search && !team.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [currentProfile?.department, department, isManager, search, teams]);

  const ungroupedProfiles = useMemo(
    () => profiles.filter((person) => !person.team_id && person.role !== "SUPERADMIN"),
    [profiles],
  );

  const filteredPeople = useMemo(() => {
    const term = search.toLowerCase();
    return profiles.filter((person) => {
      if (department && person.department !== department) return false;
      if (!term) return true;
      return `${fullName(person)} ${person.email} ${person.role}`.toLowerCase().includes(term);
    });
  }, [department, profiles, search]);

  const openCreateTeam = () => {
    const baseDepartment = isManager ? currentProfile?.department ?? "Ventas" : department || "Ventas";
    setTeamForm(emptyTeamForm(baseDepartment));
    setFormError("");
    setTeamDialogOpen(true);
  };

  const openEditTeam = (team: Team) => {
    setTeamForm({
      id: team.id,
      name: team.name,
      description: team.description ?? "",
      department: team.department ?? currentProfile?.department ?? "Ventas",
      leaderId: team.leader_id ?? "",
      memberIds: profiles
        .filter((person) => person.team_id === team.id && person.id !== team.leader_id && person.role !== "SUPERADMIN")
        .map((person) => person.id),
      active: team.active !== false,
    });
    setFormError("");
    setTeamDialogOpen(true);
  };

  const saveTeam = async () => {
    if (!teamForm.name.trim() || !teamForm.leaderId) {
      setFormError("Indica un nombre y selecciona al líder del equipo.");
      return;
    }
    setSaving(true);
    setFormError("");
    const { error } = await supabase.rpc("configure_department_team", {
      target_team_id: teamForm.id,
      team_name: teamForm.name.trim(),
      team_department: teamForm.department,
      team_leader_id: teamForm.leaderId,
      member_ids: teamForm.memberIds,
      team_description: teamForm.description.trim() || null,
      team_active: teamForm.active,
    });
    setSaving(false);
    if (error) {
      setFormError(error.message || "No se pudo guardar el equipo.");
      return;
    }
    setTeamDialogOpen(false);
    await fetchDirectory();
  };

  const leaderCandidates = profiles.filter(
    (person) =>
      person.department === teamForm.department &&
      (person.role === "SUPERVISOR" || person.role === "MANAGER") &&
      (!person.team_id || person.team_id === teamForm.id || person.id === teamForm.leaderId),
  );
  const memberCandidates = profiles.filter(
    (person) =>
      person.department === teamForm.department &&
      person.role !== "SUPERADMIN" &&
      person.id !== teamForm.leaderId &&
      (!person.team_id || person.team_id === teamForm.id),
  );

  return (
    <section className="app-page" aria-labelledby="team-directory-title">
      <header className="app-page-header">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <UsersRound className="h-4 w-4" /> Organización comercial
          </p>
          <h1 id="team-directory-title" className="font-title text-2xl font-bold text-foreground sm:text-3xl">Equipos y colaboradores</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cada equipo pertenece a un departamento, tiene un líder responsable y define exactamente qué operación puede supervisar.
          </p>
        </div>
        {canConfigure && (
          <button type="button" onClick={openCreateTeam} className="gold-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold">
            <Plus className="h-4 w-4" /> Crear equipo
          </button>
        )}
      </header>

      <div className="app-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
        <label className="relative">
          <span className="sr-only">Buscar equipos o colaboradores</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar equipo, persona o correo"
            className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <select
          value={department}
          onChange={(event) => setDepartment(event.target.value as Department | "")}
          aria-label="Filtrar por departamento"
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todos los departamentos</option>
          {DEPARTMENTS.map((item) => <option key={item} value={item}>{DEPARTMENT_LABELS[item]}</option>)}
        </select>
        <button type="button" onClick={() => { setSearch(""); setDepartment(""); }} className="h-11 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-accent">
          Limpiar
        </button>
      </div>

      {loading ? (
        <div className="app-panel grid min-h-56 place-items-center text-sm text-muted-foreground">Cargando organización…</div>
      ) : (
        <>
          <section aria-labelledby="teams-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="teams-heading" className="font-title text-lg font-semibold text-foreground">Estructura de equipos</h2>
              <span className="text-xs text-muted-foreground">{visibleTeams.length} equipos</span>
            </div>
            {visibleTeams.length === 0 ? (
              <div className="app-panel p-8 text-center">
                <Building2 className="mx-auto mb-3 h-9 w-9 text-primary" />
                <p className="font-semibold text-foreground">Aún no hay equipos configurados</p>
                <p className="mt-1 text-sm text-muted-foreground">Crea el primer equipo y asigna a su líder y agentes desde esta pantalla.</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {visibleTeams.map((team) => {
                  const leaders = profiles.filter((person) => person.team_id === team.id && (person.id === team.leader_id || person.role === "SUPERVISOR" || person.role === "MANAGER"));
                  const members = profiles.filter((person) => person.team_id === team.id && !leaders.find(l => l.id === person.id));
                  return (
                    <article key={team.id} className="app-panel overflow-hidden">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{team.name}</h3>
                            {!team.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Inactivo</span>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{team.department ? DEPARTMENT_LABELS[team.department] : "Sin departamento"} · {members.length + leaders.length} colaboradores</p>
                        </div>
                        {canConfigure && (
                          <button type="button" onClick={() => openEditTeam(team)} className="app-icon-button h-11 w-11" aria-label={`Editar ${team.name}`}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="p-4 sm:p-5">
                        <div className="grid gap-2 mb-3">
                          {leaders.map(leader => (
                            <button key={leader.id} type="button" onClick={() => setSelectedProfile(leader)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3 text-left hover:bg-primary/15">
                              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                {leader?.first_name?.[0] ?? "?"}{leader?.last_name?.[0] ?? ""}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"><Crown className="h-3.5 w-3.5" /> Líder</span>
                                <span className="block truncate text-sm font-semibold text-foreground">{fullName(leader)}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {members.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sin agentes asignados.</span>
                          ) : members.map((member) => (
                            <button key={member.id} type="button" onClick={() => setSelectedProfile(member)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-accent">
                              <UserRound className="h-3.5 w-3.5 text-primary" /> {fullName(member)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {ungroupedProfiles.length > 0 && canConfigure && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
              <strong>{ungroupedProfiles.length} colaboradores sin equipo.</strong>{" "}
              Asígnalos para que la visibilidad de líderes funcione correctamente.
            </div>
          )}

          <section aria-labelledby="directory-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="directory-heading" className="font-title text-lg font-semibold text-foreground">Directorio</h2>
              <span className="text-xs text-muted-foreground">{filteredPeople.length} colaboradores</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPeople.map((person) => (
                <button key={person.id} type="button" onClick={() => setSelectedProfile(person)} className="app-panel flex min-h-24 items-center gap-3 p-4 text-left transition-colors hover:border-primary/35 hover:bg-accent/45">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{person.first_name?.[0] ?? "?"}{person.last_name?.[0] ?? ""}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">{fullName(person)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{person.role} · {DEPARTMENT_LABELS[person.department]}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{person.email}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{teamForm.id ? "Editar equipo" : "Crear equipo"}</DialogTitle>
            <DialogDescription>El líder seleccionado podrá consultar y gestionar únicamente la operación de estos agentes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Nombre del equipo
              <input value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} className="h-11 rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Departamento
              <select
                value={teamForm.department}
                disabled={isManager}
                onChange={(event) => setTeamForm({ ...teamForm, department: event.target.value as Department, leaderId: "", memberIds: [] })}
                className="h-11 rounded-lg border border-input bg-background px-3 outline-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {DEPARTMENTS.map((item) => <option key={item} value={item}>{DEPARTMENT_LABELS[item]}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
              Descripción
              <textarea rows={2} value={teamForm.description} onChange={(event) => setTeamForm({ ...teamForm, description: event.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
              Líder responsable
              <select value={teamForm.leaderId} onChange={(event) => setTeamForm({ ...teamForm, leaderId: event.target.value })} className="h-11 rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Seleccionar líder…</option>
                {leaderCandidates.map((person) => <option key={person.id} value={person.id}>{fullName(person)} ({person.role})</option>)}
              </select>
            </label>
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="text-sm font-medium text-foreground">Colaboradores asignados (agentes y co-líderes)</legend>
              <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
                {memberCandidates.length === 0 ? <p className="text-sm text-muted-foreground">No hay colaboradores disponibles en este departamento.</p> : memberCandidates.map((person) => (
                  <label key={person.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={teamForm.memberIds.includes(person.id)}
                      onChange={(event) => setTeamForm({
                        ...teamForm,
                        memberIds: event.target.checked
                          ? [...teamForm.memberIds, person.id]
                          : teamForm.memberIds.filter((id) => id !== person.id),
                      })}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm text-foreground">{fullName(person)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
              <input type="checkbox" checked={teamForm.active} onChange={(event) => setTeamForm({ ...teamForm, active: event.target.checked })} className="h-4 w-4 accent-primary" />
              <span className="text-sm font-medium text-foreground">Equipo activo</span>
            </label>
          </div>
          {formError && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <button type="button" onClick={() => setTeamDialogOpen(false)} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-accent">Cancelar</button>
            <button type="button" onClick={() => void saveTeam()} disabled={saving} className="gold-button-primary min-h-11 rounded-lg px-4 text-sm font-bold disabled:opacity-50">{saving ? "Guardando…" : "Guardar equipo"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedProfile)} onOpenChange={(open) => !open && setSelectedProfile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fullName(selectedProfile ?? undefined)}</DialogTitle>
            <DialogDescription>Perfil interno del colaborador.</DialogDescription>
          </DialogHeader>
          {selectedProfile && (
            <div className="grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 p-4">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{selectedProfile.first_name?.[0]}{selectedProfile.last_name?.[0]}</span>
                <div>
                  <p className="font-semibold text-foreground">{selectedProfile.role}</p>
                  <p className="text-sm text-muted-foreground">{DEPARTMENT_LABELS[selectedProfile.department]}</p>
                </div>
              </div>
              <p className="flex items-center gap-2 text-sm text-foreground"><Mail className="h-4 w-4 text-primary" /> {selectedProfile.email}</p>
              <p className="flex items-center gap-2 text-sm text-foreground"><Building2 className="h-4 w-4 text-primary" /> {teams.find((team) => team.id === selectedProfile.team_id)?.name || "Sin equipo asignado"}</p>
              <p className="flex items-center gap-2 text-sm text-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Cuenta {selectedProfile.active ? "activa" : "inactiva"}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
