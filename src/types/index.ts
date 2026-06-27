export type UserRole = 'SUPERADMIN' | 'MANAGER' | 'AGENT' | 'SUPERVISOR';
export type LeadStatus = 'Nuevo' | 'Contactado' | 'Interesado' | 'Asesoría' | 'Depósito pendiente' | 'Ganado' | 'Perdido';
export type DealStage = 'Nuevo lead' | 'Contactado' | 'Interesado' | 'Asesoría' | 'Depósito pendiente' | 'Ganado' | 'Perdido';
export type CallDisposition = 'Interesado' | 'No interesado' | 'Buzón' | 'Callback' | 'Depósito confirmado';
export type ChannelType = 'general' | 'ventas' | 'soporte' | 'alertas';
export type RuleStatus = 'active' | 'inactive';

export interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  team_id?: string | null;
  active: boolean;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
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
  agent_id?: string | null;
  team_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  name: string;
  value: number;
  stage: DealStage;
  lead_id?: string;
  agent_id?: string | null;
  team_id?: string | null;
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
  description: string;
  type: string;
  created_at: string;
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
}

export interface Note {
  id: string;
  lead_id?: string;
  deal_id?: string;
  contact_id?: string;
  user_id?: string;
  content: string;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id?: string;
  content: string;
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
  created_at: string;
}
