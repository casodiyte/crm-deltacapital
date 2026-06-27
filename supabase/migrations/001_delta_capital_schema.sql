-- Delta Capital CRM Database Schema Migration
-- Designed for Supabase PostgreSQL

-- Cleanup existing schema if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_team(UUID) CASCADE;

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS automations CASCADE;
DROP TABLE IF EXISTS rules CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS lead_status CASCADE;
DROP TYPE IF EXISTS deal_stage CASCADE;
DROP TYPE IF EXISTS call_disposition CASCADE;
DROP TYPE IF EXISTS channel_type CASCADE;
DROP TYPE IF EXISTS rule_status CASCADE;

-- Create Custom Types / Enums
CREATE TYPE user_role AS ENUM ('SUPERADMIN', 'MANAGER', 'AGENT', 'SUPERVISOR');
CREATE TYPE lead_status AS ENUM ('Nuevo', 'Contactado', 'Interesado', 'Asesoría', 'Depósito pendiente', 'Ganado', 'Perdido');
CREATE TYPE deal_stage AS ENUM ('Nuevo lead', 'Contactado', 'Interesado', 'Asesoría', 'Depósito pendiente', 'Ganado', 'Perdido');
CREATE TYPE call_disposition AS ENUM ('Interesado', 'No interesado', 'Buzón', 'Callback', 'Depósito confirmado');
CREATE TYPE channel_type AS ENUM ('general', 'ventas', 'soporte', 'alertas');
CREATE TYPE rule_status AS ENUM ('active', 'inactive');

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles Table (Extends Supabase Auth users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    role user_role DEFAULT 'AGENT' NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Leads Table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    status lead_status DEFAULT 'Nuevo' NOT NULL,
    source VARCHAR(100),
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Deals Table
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    value NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    stage deal_stage DEFAULT 'Nuevo lead' NOT NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Contacts Table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company_name VARCHAR(255),
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activities Table
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    type VARCHAR(100) NOT NULL, -- e.g., 'call', 'note', 'stage_change', 'creation'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Calls Table
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    duration_seconds INTEGER DEFAULT 0 NOT NULL,
    disposition call_disposition NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notes Table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Channels Table (Chat channels)
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    type channel_type DEFAULT 'general' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Messages Table (Chat messages)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Rules Table
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    condition_json JSONB NOT NULL,
    action_json JSONB NOT NULL,
    priority INTEGER DEFAULT 0 NOT NULL,
    status rule_status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Automations Table
CREATE TABLE automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(255) NOT NULL,
    config_json JSONB NOT NULL,
    status rule_status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Updated At Triggers helper function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach Updated At triggers to tables
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Enablement
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Indexing for performance
CREATE INDEX idx_profiles_team ON profiles(team_id);
CREATE INDEX idx_leads_agent ON leads(agent_id);
CREATE INDEX idx_leads_team ON leads(team_id);
CREATE INDEX idx_deals_agent ON deals(agent_id);
CREATE INDEX idx_deals_team ON deals(team_id);
CREATE INDEX idx_contacts_agent ON contacts(agent_id);
CREATE INDEX idx_contacts_team ON contacts(team_id);
CREATE INDEX idx_activities_lead ON activities(lead_id);
CREATE INDEX idx_activities_deal ON activities(deal_id);
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- SECURITY DEFINER Helper Functions to prevent RLS recursion
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS user_role AS $$
BEGIN
  RETURN (SELECT role FROM profiles WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_team(user_uuid UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT team_id FROM profiles WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS Policies Setup

-- Profiles Policies
CREATE POLICY "Superadmins can do all on profiles" ON profiles FOR ALL USING (
    get_user_role(auth.uid()) = 'SUPERADMIN'
);
CREATE POLICY "Users can read their own profile" ON profiles FOR SELECT USING (
    auth.uid() = id
);
CREATE POLICY "Managers can read profiles of their team" ON profiles FOR SELECT USING (
    get_user_team(auth.uid()) = team_id
);

-- Teams Policies
CREATE POLICY "Superadmins can manage teams" ON teams FOR ALL USING (
    get_user_role(auth.uid()) = 'SUPERADMIN'
);
CREATE POLICY "Users can read teams" ON teams FOR SELECT USING (
    auth.role() = 'authenticated'
);

-- Leads Policies
CREATE POLICY "Superadmins can do all on leads" ON leads FOR ALL USING (
    get_user_role(auth.uid()) = 'SUPERADMIN'
);
CREATE POLICY "Managers can read and edit leads of their team" ON leads FOR ALL USING (
    get_user_team(auth.uid()) = team_id
);
CREATE POLICY "Agents can manage their own leads" ON leads FOR ALL USING (
    agent_id = auth.uid()
);
CREATE POLICY "Supervisors can read leads of their team" ON leads FOR SELECT USING (
    get_user_team(auth.uid()) = team_id
);

-- Deals Policies
CREATE POLICY "Superadmins can do all on deals" ON deals FOR ALL USING (
    get_user_role(auth.uid()) = 'SUPERADMIN'
);
CREATE POLICY "Managers can read and edit deals of their team" ON deals FOR ALL USING (
    get_user_team(auth.uid()) = team_id
);
CREATE POLICY "Agents can manage their own deals" ON deals FOR ALL USING (
    agent_id = auth.uid()
);
CREATE POLICY "Supervisors can read deals of their team" ON deals FOR SELECT USING (
    get_user_team(auth.uid()) = team_id
);

-- Contacts Policies
CREATE POLICY "Superadmins can do all on contacts" ON contacts FOR ALL USING (
    get_user_role(auth.uid()) = 'SUPERADMIN'
);
CREATE POLICY "Managers can read and edit contacts of their team" ON contacts FOR ALL USING (
    get_user_team(auth.uid()) = team_id
);
CREATE POLICY "Agents can manage their own contacts" ON contacts FOR ALL USING (
    agent_id = auth.uid()
);
CREATE POLICY "Supervisors can read contacts of their team" ON contacts FOR SELECT USING (
    get_user_team(auth.uid()) = team_id
);

-- Activities Policies
CREATE POLICY "Superadmins can manage all activities" ON activities FOR ALL USING (
    get_user_role(auth.uid()) = 'SUPERADMIN'
);
CREATE POLICY "Users can view activities of their team or ownership" ON activities FOR SELECT USING (
    get_user_role(auth.uid()) IN ('SUPERADMIN', 'MANAGER', 'SUPERVISOR') 
    OR user_id = auth.uid()
);
CREATE POLICY "Authenticated users can insert activities" ON activities FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

-- Calls Policies
CREATE POLICY "Superadmins can manage all calls" ON calls FOR ALL USING (
    get_user_role(auth.uid()) = 'SUPERADMIN'
);
CREATE POLICY "Managers can read and edit calls of their team" ON calls FOR ALL USING (
    get_user_team(auth.uid()) = get_user_team(agent_id)
);
CREATE POLICY "Agents can manage their own calls" ON calls FOR ALL USING (
    agent_id = auth.uid()
);
CREATE POLICY "Supervisors can read calls of their team" ON calls FOR SELECT USING (
    get_user_team(auth.uid()) = get_user_team(agent_id)
);

-- Notes Policies
CREATE POLICY "Superadmins can manage all notes" ON notes FOR ALL USING (
    get_user_role(auth.uid()) = 'SUPERADMIN'
);
CREATE POLICY "Authenticated users can view/manage notes depending on team/owner" ON notes FOR ALL USING (
    get_user_role(auth.uid()) IN ('SUPERADMIN', 'MANAGER', 'SUPERVISOR')
    OR user_id = auth.uid()
);

-- Channels Policies
CREATE POLICY "Authenticated users can read and join chat channels" ON channels FOR SELECT USING (
    auth.role() = 'authenticated'
);
CREATE POLICY "Superadmins and Managers can manage channels" ON channels FOR ALL USING (
    get_user_role(auth.uid()) IN ('SUPERADMIN', 'MANAGER')
);

-- Messages Policies
CREATE POLICY "Authenticated users can read messages" ON messages FOR SELECT USING (
    auth.role() = 'authenticated'
);
CREATE POLICY "Authenticated users can send messages" ON messages FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND user_id = auth.uid()
);
CREATE POLICY "Users can delete/update their own messages" ON messages FOR ALL USING (
    user_id = auth.uid()
);

-- Rules Policies
CREATE POLICY "Superadmins and Managers can view and manage rules" ON rules FOR ALL USING (
    get_user_role(auth.uid()) IN ('SUPERADMIN', 'MANAGER')
);

-- Automations Policies
CREATE POLICY "Superadmins and Managers can view and manage automations" ON automations FOR ALL USING (
    get_user_role(auth.uid()) IN ('SUPERADMIN', 'MANAGER')
);

-- Notifications Policies
CREATE POLICY "Users can manage their own notifications" ON notifications FOR ALL USING (
    user_id = auth.uid()
);

-- Create a Trigger to sync Supabase Auth Users with profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'AGENT'::user_role),
    true
  );
  RETURN new;
END;
$$ language plpgsql security definer;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- COMMENTS / GUIDES FOR SEEDING DATA
-- Seeding default chat channels
-- INSERT INTO channels (name, type) VALUES ('general', 'general'), ('ventas', 'ventas'), ('soporte', 'soporte'), ('alertas', 'alertas');
