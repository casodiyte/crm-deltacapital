export type UserRole = 'SUPERADMIN' | 'MANAGER' | 'AGENT' | 'SUPERVISOR';
export type Department = 'Ventas' | 'Retencion' | 'Cumplimiento';
export type LeadStatus = 'Nuevo' | 'Contactado' | 'Interesado' | 'Asesoría' | 'Depósito pendiente' | 'Ganado' | 'Perdido' | 'Lead nuevo con comentarios' | 'Venta 1' | 'Venta 2' | 'Venta 3' | 'Venta 4' | 'Venta 5' | 'Venta 6' | 'Venta 7';
export type SalesStage = 'Nuevo lead' | 'Contactado' | 'Interesado' | 'Asesoría' | 'Depósito pendiente' | 'Ganado' | 'Perdido';
export type ComplianceStage = 'KYC pendiente' | 'Documentos en revisión' | 'Contrato pendiente' | 'Aprobado' | 'Rechazado';
export type RecoveryStage = 'REC1 Asignado' | 'REC2 Contactado' | 'REC3 En negociación' | 'REC4 Re-depósito' | 'REC5 Recuperado' | 'REC6 No recuperado';
export type RetentionStage = 'R1 Bienvenida' | 'R2 Perfil de riesgo' | 'R3 Primera estrategia' | 'R4 Seguimiento inicial' | 'R5 Re-depósito' | 'R6 Consolidación' | 'R7 Fidelización';

export type DealStage = SalesStage | ComplianceStage | RetentionStage | RecoveryStage | 'Lead nuevo con comentarios' | 'Venta 1' | 'Venta 2' | 'Venta 3' | 'Venta 4' | 'Venta 5' | 'Venta 6' | 'Venta 7';

export type DealPipeline = 'Ventas' | 'Cumplimiento' | 'Retencion';
export type CallDisposition = 'Interesado' | 'No interesado' | 'Buzón' | 'Número inexistente' | 'Callback' | 'Depósito confirmado' | 'No contestó';
export type LeadContactOutcome = 'pending' | 'valid' | 'invalid_number' | 'direct_voicemail' | 'no_answer';
export type ChannelType = 'general' | 'ventas' | 'soporte' | 'alertas' | 'privado';
export type RuleStatus = 'active' | 'inactive';

export interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  department: Department;
  team_id?: string | null;
  active: boolean;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
  /** true = cliente de la plataforma de trading (comparte auth/profiles), no un agente del CRM. */
  is_trading_client?: boolean;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  department?: Department | null;
  leader_id?: string | null;
  active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  status: LeadStatus;
  source?: string;
  country?: string | null;
  investment_capacity?: string | null;
  comments?: string | null;
  campaign_name?: string | null;
  campaign_asset?: string | null;
  interest_intent?: string | null;
  registered_at?: string | null;
  import_batch_id?: string | null;
  raw_data?: Record<string, unknown>;
  agent_id?: string | null;
  team_id?: string | null;
  in_call_queue?: boolean;
  created_by?: string | null;
  is_burned?: boolean;
  burned_at?: string | null;
  burn_reason?: string | null;
  contact_outcome?: LeadContactOutcome;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  id: string;
  created_at: string;
  created_by: string | null;
  team_id: string | null;
  file_name: string;
  file_type: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  duplicate_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  options: Record<string, unknown>;
  profiles?: { first_name?: string; last_name?: string; email: string };
}

export interface ImportError {
  id: string;
  batch_id: string;
  row_number: number;
  error_type: string;
  message: string;
  raw_data: Record<string, unknown>;
  created_at: string;
}

export interface Deal {
  id: string;
  name: string;
  value: number;
  stage: DealStage;
  pipeline?: DealPipeline;
  sales_agent_id?: string | null;
  lead_id?: string;
  agent_id?: string | null;
  team_id?: string | null;
  currency?: string;
  expected_closing_date?: string | null;
  closed_at?: string | null;
  close_reason?: string | null;
  loss_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  agent_id?: string | null;
  team_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  lead_id?: string;
  deal_id?: string;
  contact_id?: string;
  user_id?: string;
  title?: string | null;
  description: string;
  type: string;
  due_at?: string | null;
  reminder_at?: string | null;
  status?: 'pending' | 'completed' | 'postponed' | 'cancelled';
  completed_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface FileAttachment {
  name: string;
  path: string;
  url?: string;
  type?: string;
  size?: number;
}

export interface Call {
  id: string;
  contact_id?: string;
  lead_id?: string;
  agent_id?: string;
  duration_seconds: number;
  disposition: CallDisposition;
  notes?: string;
  created_at: string;
  leads?: Pick<Lead, 'first_name' | 'last_name'> | null;
  profiles?: Pick<Profile, 'first_name' | 'last_name'> | null;
}

export interface Note {
  id: string;
  lead_id?: string;
  deal_id?: string;
  contact_id?: string;
  user_id: string;
  content: string;
  attachments?: FileAttachment[];
  created_at: string;
}

export interface ComplianceDocument {
  id: string;
  lead_id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  uploaded_by?: string | null;
  status?: 'pendiente' | 'aprobado' | 'rechazado';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  members?: string[] | null;
  created_by?: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id?: string;
  content: string;
  attachments?: FileAttachment[];
  created_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
}

export interface Rule {
  id: string;
  name: string;
  condition_json: any;
  action_json: any;
  priority: number;
  status: RuleStatus;
  created_at: string;
  updated_at: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger_event: string;
  config_json: any;
  status: RuleStatus;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  content: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}
