import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Download, Filter } from 'lucide-react';
import type { Lead, Profile } from '@/types';
import { exportToCSV, exportToXLSX, applyExportFilters, type ExportFilters } from './exportUtils';

const STATUS_OPTIONS = ['Nuevo','Contactado','Interesado','Asesoría','Depósito pendiente','Ganado','Perdido'];
const ASSET_OPTIONS  = ['Oro','Petróleo','Plata','Forex','Crypto','Acciones'];

export function ExportLeadsPanel() {
  const { profile } = useAuth();
  const { isSuperAdmin, isManager, canExport } = usePermissions();

  const [agents, setAgents] = useState<Profile[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const [filters, setFilters] = useState<ExportFilters>({});

  useEffect(() => {
    if (!profile) return;
    // Load agents for filter
    supabase.from('profiles').select('*').not('is_trading_client', 'is', true).in('role', ['AGENT', 'SUPERVISOR']).then(({ data }) => {
      if (data) setAgents(data as Profile[]);
    });
    // Unique campaign names
    supabase.from('leads').select('campaign_name').not('campaign_name', 'is', null).then(({ data }) => {
      if (data) {
        const unique = [...new Set((data as Array<{ campaign_name: string }>).map((r) => r.campaign_name).filter(Boolean))];
        setCampaigns(unique.sort());
      }
    });
  }, [profile]);

  // Count matching leads
  useEffect(() => {
    const estimate = async () => {
      let q = supabase.from('leads').select('id', { count: 'exact', head: true });
      if (!isSuperAdmin && !isManager && profile?.id) q = q.eq('agent_id', profile.id);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.agentId) q = q.eq('agent_id', filters.agentId);
      if (filters.campaignName) q = q.eq('campaign_name', filters.campaignName);
      if (filters.campaignAsset) q = q.eq('campaign_asset', filters.campaignAsset);
      if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom);
      if (filters.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59');
      const { count: c } = await q;
      setCount(c ?? 0);
    };
    estimate();
  }, [filters, profile, isSuperAdmin, isManager]);

  const fetchLeads = async (): Promise<Lead[]> => {
    let q = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!isSuperAdmin && !isManager && profile?.id) q = q.eq('agent_id', profile.id);
    const { data } = await q;
    const leads = (data ?? []) as Lead[];
    return applyExportFilters(leads, filters);
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!canExport && !(isSuperAdmin || isManager)) return;
    setLoading(true);
    try {
      const leads = await fetchLeads();
      const fileName = `leads_delta_${new Date().toISOString().slice(0,10)}`;
      if (format === 'csv') exportToCSV(leads, fileName);
      else exportToXLSX(leads, fileName);
    } finally {
      setLoading(false);
    }
  };

  const setFilter = (key: keyof ExportFilters, val: string) => {
    setFilters((prev) => ({ ...prev, [key]: val || undefined }));
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#D4AF37]" />
          <h3 className="text-sm font-title font-semibold text-[#E2E8F0]">Filtros de Exportación</h3>
          {count !== null && (
            <span className="ml-auto text-xs text-[#4A6080]">
              <span className="text-[#D4AF37] font-mono font-bold">{count}</span> leads coinciden
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] text-[#4A6080] mb-1 uppercase tracking-wider font-semibold">Estado</label>
            <select
              value={filters.status ?? ''}
              onChange={(e) => setFilter('status', e.target.value)}
              className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
            >
              <option value="">— Todos los estados —</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {(isSuperAdmin || isManager) && (
            <div>
              <label className="block text-[10px] text-[#4A6080] mb-1 uppercase tracking-wider font-semibold">Agente</label>
              <select
                value={filters.agentId ?? ''}
                onChange={(e) => setFilter('agentId', e.target.value)}
                className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
              >
                <option value="">— Todos los agentes —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-[#4A6080] mb-1 uppercase tracking-wider font-semibold">Campaña</label>
            <select
              value={filters.campaignName ?? ''}
              onChange={(e) => setFilter('campaignName', e.target.value)}
              className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
            >
              <option value="">— Todas las campañas —</option>
              {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#4A6080] mb-1 uppercase tracking-wider font-semibold">Activo</label>
            <select
              value={filters.campaignAsset ?? ''}
              onChange={(e) => setFilter('campaignAsset', e.target.value)}
              className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
            >
              <option value="">— Todos los activos —</option>
              {ASSET_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#4A6080] mb-1 uppercase tracking-wider font-semibold">Desde</label>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => setFilter('dateFrom', e.target.value)}
              className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[#4A6080] mb-1 uppercase tracking-wider font-semibold">Hasta</label>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => setFilter('dateTo', e.target.value)}
              className="px-3 py-2 w-full text-sm bg-[#050814] border border-[rgba(212,175,55,0.15)] rounded focus:outline-none focus:border-[#D4AF37] text-[#94A3B8]"
            />
          </div>
        </div>

        <button
          onClick={() => setFilters({})}
          className="text-xs text-[#4A6080] hover:text-[#94A3B8] underline"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Export buttons */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-title font-semibold text-[#E2E8F0]">Descargar</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleExport('xlsx')}
            disabled={loading || count === 0}
            className="gold-button-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded disabled:opacity-40"
          >
            {loading
              ? <div className="h-4 w-4 rounded-full border-2 border-[rgba(5,8,20,0.3)] border-t-[#050814] animate-spin" />
              : <Download className="h-4 w-4" />
            }
            Exportar .XLSX
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={loading || count === 0}
            className="gold-button-secondary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Exportar .CSV
          </button>
        </div>

        {count === 0 && (
          <p className="text-xs text-[#4A6080]">
            No hay leads que coincidan con los filtros aplicados.
          </p>
        )}
      </div>
    </div>
  );
}
