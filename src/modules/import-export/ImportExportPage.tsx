import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Upload, Download, History, ArrowLeft, ArrowRight,
  CheckCircle2, FileSpreadsheet, Users, Settings2,
} from 'lucide-react';
import type { Profile } from '@/types';
import { FileDropzone } from './FileDropzone';
import { ColumnMapper } from './ColumnMapper';
import { ImportSummaryCards } from './ImportSummaryCards';
import { ImportPreviewTable } from './ImportPreviewTable';
import { ImportHistoryTable } from './ImportHistoryTable';
import { ExportLeadsPanel } from './ExportLeadsPanel';
import { useLeadImport, type AssignmentMode, type DuplicateAction } from './useLeadImport';

type MainTab = 'import' | 'export' | 'history';

const STEPS = [
  { n: 1, label: 'Subir archivo' },
  { n: 2, label: 'Mapear columnas' },
  { n: 3, label: 'Validar datos' },
  { n: 4, label: 'Opciones' },
  { n: 5, label: 'Confirmar' },
  { n: 6, label: 'Resumen' },
];

export const ImportExportPage = () => {
  const { profile } = useAuth();
  const { isSuperAdmin, isManager } = usePermissions();
  const [tab, setTab] = useState<MainTab>('import');
  const [agents, setAgents] = useState<Profile[]>([]);

  const imp = useLeadImport();

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('profiles')
      .select('*')
      .not('is_trading_client', 'is', true)
      .eq('role', 'AGENT')
      .then(({ data }) => { if (data) setAgents(data as Profile[]); });
  }, [profile]);

  const canGoNext = () => {
    if (imp.step === 2) {
      const vals = Object.values(imp.mapping);
      return vals.includes('full_name') && (vals.includes('email') || vals.includes('phone'));
    }
    if (imp.step === 5) {
      const importable = imp.rows.filter((r) => r._status !== 'error').length;
      return importable > 0;
    }
    return true;
  };

  const handleNext = async () => {
    if (imp.step === 2) await imp.handleMappingConfirmed();
    else if (imp.step === 3) imp.handlePreviewConfirmed();
    else if (imp.step === 4) imp.setStep(5);
    else if (imp.step === 5) await imp.handleImportConfirmed(agents);
  };

  const handleBack = () => {
    if (imp.step > 1) imp.setStep((imp.step - 1) as any);
  };

  // ── UI helpers ───────────────────────────────────────────────────────────

  const TabBtn = ({ id, icon: Icon, label }: { id: MainTab; icon: typeof Upload; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
        tab === id
          ? 'bg-[rgba(212,175,55,0.12)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]'
          : 'text-[#4A6080] hover:text-[#94A3B8] border border-transparent'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  const StepBar = () => (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1 shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
            imp.step === s.n
              ? 'bg-[#D4AF37] text-[#050814]'
              : imp.step > s.n
              ? 'bg-[rgba(34,197,94,0.12)] text-green-400 border border-green-500/30'
              : 'text-[#334155] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'
          }`}>
            {imp.step > s.n ? <CheckCircle2 className="h-3 w-3" /> : <span>{s.n}</span>}
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-4 ${imp.step > s.n ? 'bg-green-500/40' : 'bg-[rgba(255,255,255,0.06)]'}`} />
          )}
        </div>
      ))}
    </div>
  );

  // ── Step content ─────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (imp.step) {
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-sm text-[#4A6080]">
              Sube un archivo <span className="text-[#D4AF37]">.xlsx</span> o <span className="text-[#D4AF37]">.csv</span> con los leads de tu campaña.
              Soporta el formato estándar de Flow Markets y una columna opcional <span className="text-[#D4AF37]">Depósito</span> o <span className="text-[#D4AF37]">Monto depósito</span> para crear negociaciones con importe.
            </p>
            <FileDropzone
              onFileAccepted={imp.handleFileAccepted}
              loading={imp.loading}
              error={imp.error}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm text-[#F8FAFC] font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-[#D4AF37]" />
                  {imp.parsedFile?.fileName}
                </p>
                <p className="text-xs text-[#4A6080] mt-0.5">
                  {imp.parsedFile?.rowCount.toLocaleString()} filas · {((imp.parsedFile?.fileSize ?? 0) / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <ColumnMapper
              headers={imp.parsedFile?.headers ?? []}
              mapping={imp.mapping}
              onChange={imp.setMapping}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            {imp.loading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <div className="h-6 w-6 rounded-full border-2 border-[rgba(212,175,55,0.2)] border-t-[#D4AF37] animate-spin" />
                <span className="text-sm text-[#4A6080]">Validando {imp.parsedFile?.rowCount} filas…</span>
              </div>
            ) : (
              <>
                {imp.stats && <ImportSummaryCards stats={imp.stats} />}
                <ImportPreviewTable rows={imp.rows} />
              </>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            {imp.stats && <ImportSummaryCards stats={imp.stats} />}

            {/* Duplicate handling */}
            <div className="glass-card p-5 space-y-3">
              <h4 className="text-sm font-title font-semibold text-[#E2E8F0] flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-[#D4AF37]" />
                Opciones de importación
              </h4>

              <div>
                <label className="block text-xs text-[#4A6080] mb-2 font-semibold">Duplicados ({imp.stats?.duplicates ?? 0} encontrados)</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { v: 'skip',          l: 'Omitir duplicados' },
                    { v: 'update',        l: 'Actualizar existente' },
                    { v: 'import_anyway', l: 'Importar de todos modos' },
                  ] as Array<{ v: DuplicateAction; l: string }>).map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => imp.setOptions({ ...imp.options, duplicateAction: v })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        imp.options.duplicateAction === v
                          ? 'bg-[#D4AF37] text-[#050814] border-[#D4AF37]'
                          : 'border-[rgba(212,175,55,0.2)] text-[#4A6080] hover:border-[#D4AF37]'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#4A6080] mb-2 font-semibold flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Asignación de agente
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {([
                    { v: 'none',        l: 'Sin asignar' },
                    { v: 'single',      l: 'Asignar a uno' },
                    { v: 'round_robin', l: 'Distribuir automáticamente' },
                  ] as Array<{ v: AssignmentMode; l: string }>).map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => imp.setOptions({ ...imp.options, assignmentMode: v })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        imp.options.assignmentMode === v
                          ? 'bg-[#D4AF37] text-[#050814] border-[#D4AF37]'
                          : 'border-[rgba(212,175,55,0.2)] text-[#4A6080] hover:border-[#D4AF37]'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                {imp.options.assignmentMode === 'single' && (
                  <select
                    value={imp.options.selectedAgentId}
                    onChange={(e) => imp.setOptions({ ...imp.options, selectedAgentId: e.target.value })}
                    className="px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8] w-full max-w-xs"
                  >
                    <option value="">Seleccionar agente...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                )}
                {imp.options.assignmentMode === 'round_robin' && agents.length === 0 && (
                  <p className="text-xs text-yellow-400">No hay agentes disponibles en tu equipo.</p>
                )}
                {imp.options.assignmentMode === 'round_robin' && agents.length > 0 && (
                  <p className="text-xs text-[#4A6080]">
                    Se distribuirán entre {agents.length} agente{agents.length > 1 ? 's' : ''}.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-[#4A6080] mb-2 font-semibold">Estado inicial de leads</label>
                <select
                  value={imp.options.status}
                  onChange={(e) => imp.setOptions({ ...imp.options, status: e.target.value })}
                  className="px-3 py-2 text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
                >
                  <option value="Nuevo">Nuevo</option>
                  <option value="Contactado">Contactado</option>
                  <option value="Interesado">Interesado</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            {imp.stats && <ImportSummaryCards stats={imp.stats} />}
            <div className="glass-card p-5 space-y-3">
              <h4 className="text-sm font-title font-semibold text-[#E2E8F0]">Resumen de importación</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#4A6080]">
                <span>Archivo:</span>
                <span className="text-[#F8FAFC] font-medium">{imp.parsedFile?.fileName}</span>
                <span>Total filas:</span>
                <span className="text-[#F8FAFC] font-mono">{imp.stats?.total}</span>
                <span>A importar:</span>
                <span className="text-green-400 font-mono">{(imp.stats?.valid ?? 0) + (imp.stats?.warnings ?? 0)}</span>
                <span>Duplicados:</span>
                <span className="text-[#D4AF37] font-mono">{imp.stats?.duplicates} ({imp.options.duplicateAction === 'skip' ? 'omitir' : imp.options.duplicateAction})</span>
                <span>Errores:</span>
                <span className="text-red-400 font-mono">{imp.stats?.errors} (se omiten)</span>
                <span>Con depósito:</span>
                <span className="text-[#D4AF37] font-mono">{imp.rows.filter((row) => (row.deposit_amount ?? 0) > 0).length} negociaciones</span>
                <span>Asignación:</span>
                <span className="text-[#F8FAFC]">{
                  imp.options.assignmentMode === 'none' ? 'Sin asignar' :
                  imp.options.assignmentMode === 'round_robin' ? `Round-robin (${agents.length} agentes)` :
                  `Agente único`
                }</span>
              </div>
            </div>
            {imp.error && (
              <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-400 text-xs">
                {imp.error}
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="glass-card p-8 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-950/20 border border-green-500/30 mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <h3 className="text-xl font-title font-bold text-[#F8FAFC]">¡Importación completada!</h3>

              {imp.result && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  {[
                    { label: 'Importados', val: imp.result.imported, color: 'text-green-400' },
                    { label: 'Omitidos', val: imp.result.skipped, color: 'text-[#4A6080]' },
                    { label: 'Duplicados', val: imp.result.duplicates, color: 'text-[#D4AF37]' },
                    { label: 'Errores', val: imp.result.errors, color: 'text-red-400' },
                  ].map((item) => (
                    <div key={item.label} className="glass-card p-4 text-center">
                      <p className={`text-2xl font-mono-numbers font-bold ${item.color}`}>{item.val}</p>
                      <p className="text-[10px] text-[#4A6080] uppercase tracking-wider mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={imp.reset}
                className="gold-button-primary px-5 py-2.5 text-sm font-semibold rounded flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Nueva importación
              </button>
              <button
                onClick={() => setTab('history')}
                className="gold-button-secondary px-5 py-2.5 text-sm font-semibold rounded flex items-center gap-2"
              >
                <History className="h-4 w-4" />
                Ver historial
              </button>
            </div>
          </div>
        );
    }
  };

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6 bg-[#050814] min-h-screen text-[#F8FAFC]">
      {/* Header */}
      <div className="border-b border-[rgba(212,175,55,0.15)] pb-4">
        <h1 className="text-2xl font-title font-bold text-[#F8FAFC]">Importar / Exportar</h1>
        <p className="text-xs text-[#94A3B8] mt-1">
          Gestión masiva de leads · Delta Capital CRM
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabBtn id="import"  icon={Upload}   label="Importar Leads" />
        <TabBtn id="export"  icon={Download} label="Exportar Leads" />
        {(isSuperAdmin || isManager) && (
          <TabBtn id="history" icon={History}  label="Historial" />
        )}
      </div>

      {/* Import tab */}
      {tab === 'import' && (
        <div className="space-y-5">
          <StepBar />

          <div className="glass-card p-6 min-h-[320px]">
            {renderStep()}
          </div>

          {/* Nav buttons (steps 1–5) */}
          {imp.step < 6 && (
            <div className="flex justify-between items-center">
              <button
                onClick={imp.step === 1 ? undefined : handleBack}
                disabled={imp.step === 1 || imp.loading}
                className="gold-button-secondary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                {imp.step === 1 ? 'Inicio' : 'Atrás'}
              </button>

              {imp.step > 1 && (
                <button
                  onClick={handleNext}
                  disabled={!canGoNext() || imp.loading}
                  className="gold-button-primary flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded disabled:opacity-40"
                >
                  {imp.loading
                    ? <div className="h-4 w-4 rounded-full border-2 border-[rgba(5,8,20,0.3)] border-t-[#050814] animate-spin" />
                    : null
                  }
                  {imp.step === 5 ? 'Importar ahora' : 'Siguiente'}
                  {!imp.loading && <ArrowRight className="h-4 w-4" />}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Export tab */}
      {tab === 'export' && <ExportLeadsPanel />}

      {/* History tab */}
      {tab === 'history' && (isSuperAdmin || isManager) && <ImportHistoryTable />}
    </div>
  );
};
