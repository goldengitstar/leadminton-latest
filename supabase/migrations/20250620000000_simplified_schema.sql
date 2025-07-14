-- ==================================================
-- LEADMINTON GAME - SIMPLIFIED SCHEMA (TABLES ONLY)
-- ==================================================
-- This migration creates all necessary tables without functions, triggers, or RLS policies
-- All business logic will be handled in JavaScript code

-- ==================================================
-- DROP EXISTING TABLES AND FUNCTIONS
-- ==================================================

-- Drop all existing functions first
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS refresh_resource_balances() CASCADE;
DROP FUNCTION IF EXISTS batch_resource_transactions(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS update_facility(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS update_player_rank(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_tournaments_with_rounds_matches() CASCADE;
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS assign_cpu_players_to_tournament(uuid, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS generate_cpu_players_for_team(text, integer) CASCADE;
DROP FUNCTION IF EXISTS log_admin_activity(uuid, text, text, uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS get_total_user_count() CASCADE;
DROP FUNCTION IF EXISTS get_admin_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS register_player_for_tournament(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_tournament_registrations() CASCADE;
DROP FUNCTION IF EXISTS start_tournament(uuid) CASCADE;
DROP FUNCTION IF EXISTS populate_first_round_matches(uuid) CASCADE;
DROP FUNCTION IF EXISTS array_shuffle(uuid[]) CASCADE;
DROP FUNCTION IF EXISTS populate_next_round(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_tournament_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_next_match(uuid) CASCADE;
DROP FUNCTION IF EXISTS advance_tournament_round(uuid) CASCADE;
DROP FUNCTION IF EXISTS distribute_tournament_rewards(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_tournament_results(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_tournament_automation_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS schedule_next_tournament_round(uuid) CASCADE;
DROP FUNCTION IF EXISTS cancel_tournament_automation(uuid) CASCADE;
DROP FUNCTION IF EXISTS execute_tournament_round(uuid) CASCADE;
DROP FUNCTION IF EXISTS auto_advance_tournament_round(uuid, uuid) CASCADE;  
DROP FUNCTION IF EXISTS check_and_advance_tournament(uuid) CASCADE;
DROP FUNCTION IF EXISTS execute_match(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_tournament_progress(uuid) CASCADE;
DROP FUNCTION IF EXISTS admin_register_player_for_tournament(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_interclub_groups(uuid) CASCADE;
DROP FUNCTION IF EXISTS admin_change_user_password(uuid, text) CASCADE;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS user_resource_balances CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.match CASCADE;
DROP TABLE IF EXISTS public.round CASCADE;
DROP TABLE IF EXISTS public.player_training_history CASCADE;
DROP TABLE IF EXISTS public.player_equipment_history CASCADE;
DROP TABLE IF EXISTS public.player_equipment CASCADE;
DROP TABLE IF EXISTS public.player_strategy CASCADE;
DROP TABLE IF EXISTS public.player_levels CASCADE;
DROP TABLE IF EXISTS public.player_stats CASCADE;
DROP TABLE IF EXISTS public.player_play_history CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.player_team_assignments CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.managers CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;
DROP TABLE IF EXISTS public.resource_transactions CASCADE;
DROP TABLE IF EXISTS public.tournament_list CASCADE;
DROP TABLE IF EXISTS public.user_tournament_registrations CASCADE;
DROP TABLE IF EXISTS public.season_list CASCADE;

-- Drop admin tables
DROP TABLE IF EXISTS public.admin_activity_logs CASCADE;
DROP TABLE IF EXISTS public.tournament_admin_settings CASCADE;
DROP TABLE IF EXISTS public.interclub_matches CASCADE;
DROP TABLE IF EXISTS public.interclub_registrations CASCADE;
DROP TABLE IF EXISTS public.interclub_seasons CASCADE;
DROP TABLE IF EXISTS public.cpu_teams CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS gender_enum CASCADE;

-- ==================================================
-- CREATE ENUM TYPES
-- ==================================================

CREATE TYPE gender_enum AS ENUM ('male', 'female', 'non_binary', 'other');

-- ==================================================
-- CREATE MAIN GAME TABLES
-- ==================================================

-- Tournament list table
CREATE TABLE public.tournament_list (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  start_date timestamp with time zone NOT NULL,
  end_date timestamp without time zone NULL,
  tier integer NOT NULL,
  status integer NULL DEFAULT 0,
  entry_fee json NULL,
  prize_pool json NULL,
  min_player_level bigint NULL,
  max_participants bigint NULL,
  current_participants bigint NOT NULL DEFAULT 0,
  name character varying NULL,
  registered_players json[] NULL,
  round_interval_minutes INTEGER DEFAULT 10,
  next_round_start_time TIMESTAMPTZ,
  current_round_level INTEGER DEFAULT 0,
  automation_enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournament_list_pkey PRIMARY KEY (id)
);

-- Season list table
CREATE TABLE public.season_list (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  entry_fee json NULL,
  prize_pool json NULL,
  group_list uuid[] NULL,
  start_date timestamp without time zone NULL,
  match_days timestamp without time zone[] NULL,
  type integer NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT season_list_pkey PRIMARY KEY (id)
);

-- Player play history table
CREATE TABLE public.player_play_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  player1_id uuid NULL,
  player2_id uuid NULL,
  result boolean NULL,
  player1_rank double precision NULL,
  player2_rank double precision NULL,
  CONSTRAINT player_play_history_pkey PRIMARY KEY (id)
);

-- Players table
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name character varying NOT NULL,
  level integer NULL DEFAULT 1,
  max_level integer NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  rank double precision NULL,
  gender gender_enum NULL DEFAULT 'male'::gender_enum,
  is_cpu boolean DEFAULT false,
  training json NULL,
  equipment json NULL,
  injuries json NULL,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id),
  CONSTRAINT valid_level CHECK (level >= 1 AND level <= max_level)
);

-- Facilities table
CREATE TABLE public.facilities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name character varying NOT NULL,
  type character varying NOT NULL,
  level integer NULL DEFAULT 1,
  production_rate integer NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  max_players integer NULL DEFAULT 0,
  upgrade_cost json NULL,
  upgrading json NULL,
  resource_type character varying NULL,
  CONSTRAINT facilities_pkey PRIMARY KEY (id),
  CONSTRAINT facilities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id),
  CONSTRAINT valid_facility_type CHECK (type IN ('shuttlecock-machine', 'canteen', 'sponsors', 'training-center')),
  CONSTRAINT valid_level CHECK (level >= 1),
  CONSTRAINT valid_production_rate CHECK (production_rate >= 0)
);

-- Managers table
CREATE TABLE public.managers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NULL DEFAULT auth.uid(),
  name character varying NULL,
  facility_type character varying NULL,
  production_bonus real NULL DEFAULT 0,
  active boolean NULL DEFAULT false,
  image_url character varying NULL,
  cost integer NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  purchasing json NULL,
  CONSTRAINT managers_pkey PRIMARY KEY (id),
  CONSTRAINT managers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
);

-- Resource transactions table
CREATE TABLE public.resource_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  resource_type text NOT NULL,
  amount integer NOT NULL,
  source text NOT NULL,
  source_id uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT resource_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT resource_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id),
  CONSTRAINT valid_resource_type CHECK (resource_type IN ('shuttlecocks', 'meals', 'coins', 'diamonds')),
  CONSTRAINT valid_source CHECK (source IN ('facility_production', 'training_cost', 'upgrade_cost', 'equipment_purchase', 'tournament_reward', 'initial_resources', 'manual_adjustment', 'shop_purchase'))
);

-- Public round
create table public.round (
  id uuid not null default gen_random_uuid (),
  tournament_id uuid not null,
  name character varying null,
  level integer not null,
  constraint round_pkey primary key (id),
  constraint round_tournament_id_fkey foreign KEY (tournament_id) references tournament_list (id) on delete CASCADE
) TABLESPACE pg_default;

-- Player stats table
CREATE TABLE public.player_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  endurance integer null default 50,
  strength integer null default 50,
  agility integer null default 50,
  speed integer null default 50,
  explosiveness integer null default 50,
  injury_prevention integer null default 50,
  smash integer null default 50,
  defense integer null default 50,
  serve integer null default 50,
  stick integer null default 50,
  slice integer null default 50,
  drop integer null default 50,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_stats_pkey PRIMARY KEY (id),
  CONSTRAINT player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT unique_player_stats UNIQUE (player_id)
);

-- Player levels table
CREATE TABLE public.player_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  endurance integer NULL DEFAULT 0,
  strength integer NULL DEFAULT 0,
  agility integer NULL DEFAULT 0,
  speed integer NULL DEFAULT 0,
  explosiveness integer NULL DEFAULT 0,
  injury_prevention integer NULL DEFAULT 0,
  smash integer NULL DEFAULT 0,
  defense integer NULL DEFAULT 0,
  serve integer NULL DEFAULT 0,
  stick integer NULL DEFAULT 0,
  slice integer NULL DEFAULT 0,
  drop integer NULL DEFAULT 0,

  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_levels_pkey PRIMARY KEY (id),
  CONSTRAINT player_levels_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT unique_player_levels UNIQUE (player_id)
);

-- Player strategy table
CREATE TABLE public.player_strategy (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  physical_commitment integer NULL DEFAULT 5,
  play_style integer NULL DEFAULT 5,
  movement_speed integer NULL DEFAULT 5,
  fatigue_management integer NULL DEFAULT 5,
  rally_consistency integer NULL DEFAULT 5,
  risk_taking integer NULL DEFAULT 5,
  attack integer NULL DEFAULT 5,
  soft_attack integer NULL DEFAULT 5,
  serving integer NULL DEFAULT 5,
  court_defense integer NULL DEFAULT 5,
  mental_toughness integer NULL DEFAULT 5,
  self_confidence integer NULL DEFAULT 5,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_strategy_pkey PRIMARY KEY (id),
  CONSTRAINT player_strategy_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT unique_player_strategy UNIQUE (player_id)
);

-- Player equipment table
CREATE TABLE public.player_equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  equipment_type character varying NOT NULL,
  equipment_id character varying NOT NULL,
  equipped_at timestamp with time zone NULL DEFAULT now(),
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_equipment_pkey PRIMARY KEY (id),
  CONSTRAINT player_equipment_player_id_fkey FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT unique_player_equipment_type UNIQUE (player_id, equipment_type)
);

-- Match table
CREATE TABLE public.match (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES round(id),
  tournament_id uuid NOT NULL,
  player1_id uuid NULL,
  player2_id uuid NULL,
  winner_id uuid NULL,
  round_level integer DEFAULT 0,
  completed boolean DEFAULT false,
  status text DEFAULT 'pending',
  score text NULL,
  scheduled_start_time timestamptz,
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT match_pkey PRIMARY KEY (id),
  CONSTRAINT match_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournament_list (id) ON DELETE CASCADE
);

-- ==================================================
-- CREATE ADMIN TABLES
-- ==================================================

-- Admin users table
CREATE TABLE public.admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    permissions jsonb DEFAULT '{"tournaments": true, "interclub": true, "users": true, "cpu_teams": true}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- CPU teams table for AI opponents
CREATE TABLE public.cpu_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    skill_level text DEFAULT 'intermediate' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert', 'master')),
    player_count integer DEFAULT 6,
    gender_balance text DEFAULT 'mixed' CHECK (gender_balance IN ('mixed', 'male', 'female')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure player_team_assignments table exists with proper foreign keys
CREATE TABLE public.player_team_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id uuid NOT NULL REFERENCES cpu_teams(id) ON DELETE CASCADE,
    assigned_at timestamptz DEFAULT now(),
    UNIQUE(player_id, team_id)
);

-- Interclub seasons table
CREATE TABLE public.interclub_seasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    start_date timestamptz NOT NULL,
    end_date timestamptz NOT NULL,
    registration_deadline timestamptz NOT NULL,
    status text DEFAULT 'draft' CHECK (
        status IN (
            'draft',
            'registration_open',
            'registration_closed',
            'active',
            'completed'
        )
    ),
    groups jsonb DEFAULT '[]'::jsonb,
    
    entry_fee jsonb DEFAULT '{}'::jsonb,
    prize_pool jsonb DEFAULT '{}'::jsonb,

    max_teams_per_group integer DEFAULT 8,
    created_by uuid REFERENCES admin_users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);


-- Interclub team registrations
CREATE TABLE public.interclub_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id uuid REFERENCES interclub_seasons(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    team_name text NOT NULL,
    players jsonb NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    group_assignment integer,
    reviewed_by uuid REFERENCES admin_users(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(season_id, user_id)
);

-- Interclub matches table
CREATE TABLE public.interclub_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id uuid REFERENCES interclub_seasons(id) ON DELETE CASCADE NOT NULL,
    week_number integer NOT NULL,
    group_number integer NOT NULL,
    home_team_id uuid,
    away_team_id uuid,
    home_team_type text DEFAULT 'user' CHECK (home_team_type IN ('user', 'cpu')),
    away_team_type text DEFAULT 'user' CHECK (away_team_type IN ('user', 'cpu')),
    match_date timestamptz NOT NULL,
    status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
    home_lineup jsonb,
    away_lineup jsonb,
    results jsonb,
    winner_team_id uuid,
    winner_team_type text CHECK (winner_team_type IN ('user', 'cpu')),
    final_score text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tournament admin settings
CREATE TABLE public.tournament_admin_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL,
    created_by uuid REFERENCES admin_users(id),
    custom_entry_fee integer,
    custom_prize_pool integer,
    cpu_teams_assigned uuid[] DEFAULT '{}',
    max_participants integer,
    registration_deadline timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Activity logs for admin actions
CREATE TABLE public.admin_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
    action_type text NOT NULL,
    target_type text,
    target_id uuid,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- ==================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ==================================================

-- Players indexes
CREATE INDEX IF NOT EXISTS players_user_id_idx ON public.players(user_id);
CREATE INDEX IF NOT EXISTS players_level_idx ON public.players(level);
CREATE INDEX IF NOT EXISTS active_players_idx ON public.players(user_id) WHERE (level < max_level);

-- Facilities indexes
CREATE INDEX IF NOT EXISTS facilities_user_id_idx ON public.facilities(user_id);
CREATE INDEX IF NOT EXISTS facilities_type_idx ON public.facilities(type);
CREATE INDEX IF NOT EXISTS active_facilities_idx ON public.facilities(user_id, type) WHERE (level < 10);

-- Resource transactions indexes
CREATE INDEX IF NOT EXISTS resource_transactions_user_id_idx ON public.resource_transactions(user_id);
CREATE INDEX IF NOT EXISTS resource_transactions_type_idx ON public.resource_transactions(resource_type);
CREATE INDEX IF NOT EXISTS resource_transactions_created_at_idx ON public.resource_transactions(created_at);

-- Player related indexes
CREATE INDEX IF NOT EXISTS player_stats_player_id_idx ON public.player_stats(player_id);
CREATE INDEX IF NOT EXISTS player_levels_player_id_idx ON public.player_levels(player_id);
CREATE INDEX IF NOT EXISTS player_equipment_player_id_idx ON public.player_equipment(player_id);
CREATE INDEX IF NOT EXISTS player_strategy_player_id_idx ON public.player_strategy(player_id);

-- Tournament related indexes
CREATE INDEX IF NOT EXISTS tournament_list_start_date_idx ON public.tournament_list(start_date);
CREATE INDEX IF NOT EXISTS tournament_list_status_idx ON public.tournament_list(status);
CREATE INDEX IF NOT EXISTS round_tournament_id_idx ON public.round(tournament_id);
CREATE INDEX IF NOT EXISTS match_round_id_idx ON public.match(round_id);
CREATE INDEX IF NOT EXISTS match_player1_id_idx ON public.match(player1_id);
CREATE INDEX IF NOT EXISTS match_player2_id_idx ON public.match(player2_id);

-- Admin indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_cpu_teams_skill_level ON cpu_teams(skill_level);
CREATE INDEX IF NOT EXISTS idx_interclub_seasons_status ON interclub_seasons(status);
CREATE INDEX IF NOT EXISTS idx_interclub_registrations_season_id ON interclub_registrations(season_id);
CREATE INDEX IF NOT EXISTS idx_interclub_registrations_user_id ON interclub_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_interclub_registrations_status ON interclub_registrations(status);
CREATE INDEX IF NOT EXISTS idx_interclub_matches_season_id ON interclub_matches(season_id);
CREATE INDEX IF NOT EXISTS idx_interclub_matches_status ON interclub_matches(status);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_user_id ON admin_activity_logs(admin_user_id);

-- ==================================================
-- DISABLE RLS POLICIES
-- ==================================================

-- Disable RLS on all tables for development
ALTER TABLE public.tournament_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_play_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_strategy DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.round DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.match DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpu_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interclub_seasons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interclub_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interclub_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_admin_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs DISABLE ROW LEVEL SECURITY;

ALTER TABLE resource_transactions DROP CONSTRAINT IF EXISTS valid_source;

-- -- Add the updated constraint with all valid sources // this is currently disabled for supporting the any data
-- ALTER TABLE resource_transactions ADD CONSTRAINT valid_source CHECK (
--     source IN (
--         'facility_production',
--         'training_cost',
--         'upgrade_cost',
--         'equipment_purchase',
--         'tournament_reward',
--         'tournament_registration',
--         'tournament_registration_refund',
--         'initial_resources',
--         'player_recruitment',
--         'manual_adjustment',
--         'shop_purchase'
--     )
-- ); 
-- ==================================================
-- CREATE MATERIALIZED VIEW (optional for performance)
-- ==================================================

CREATE MATERIALIZED VIEW user_resource_balances AS
SELECT 
    user_id,
    resource_type,
    COALESCE(SUM(amount), 0) as balance
FROM resource_transactions
GROUP BY user_id, resource_type;

CREATE UNIQUE INDEX IF NOT EXISTS user_resource_balances_idx 
ON user_resource_balances (user_id, resource_type);



-- Add user profiles table for team names and other user-specific data
-- This table links to auth.users and stores team names and other profile info

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    team_name text,
    display_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON public.user_profiles(user_id);

-- Disable RLS for development (consistent with other tables)
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;


-- Create user tournament registrations tracking table
CREATE TABLE IF NOT EXISTS user_tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournament_list(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'eliminated', 'winner')),
    final_position INTEGER,
    rewards_distributed BOOLEAN DEFAULT false,
    UNIQUE(tournament_id, player_id)
);

ALTER TABLE public.user_tournament_registrations DISABLE ROW LEVEL SECURITY;
