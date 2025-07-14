-- Admin System Setup Migration
-- Adds tables for admin management, CPU teams, interclub seasons, and registrations

-- Create a secure function to check admin status
-- This function has SECURITY DEFINER which means it runs with the privileges of the function creator (bypassing RLS)
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE user_id = check_user_id
    );
END;
$$;

-- Enhanced execute_match function to return more detailed results
CREATE OR REPLACE FUNCTION execute_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    match_record record;
    player1_id uuid;
    player2_id uuid;
    player1_info record;
    player2_info record;
    winner_id uuid;
    match_score text;
    round_advancement jsonb;
    result jsonb;
BEGIN
    -- Get match details with round info
    SELECT m.*, r.tournament_id, r.level as round_level, r.name as round_name
    INTO match_record
    FROM match m
    JOIN round r ON m.round_id = r.id
    WHERE m.match_id = p_match_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found with ID: %', p_match_id;
    END IF;

    -- Check if match is already completed
    IF match_record.completed THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Match already completed',
            'matchId', p_match_id
        );
    END IF;

    -- Validate that both players exist
    IF match_record.players[1] IS NULL OR match_record.players[2] IS NULL THEN
        RAISE EXCEPTION 'Match cannot be executed: missing players';
    END IF;

    player1_id := match_record.players[1];
    player2_id := match_record.players[2];

    -- Get detailed player info
    SELECT p.*, ps.* INTO player1_info
    FROM players p
    LEFT JOIN player_stats ps ON p.id = ps.player_id
    WHERE p.id = player1_id;

    SELECT p.*, ps.* INTO player2_info
    FROM players p
    LEFT JOIN player_stats ps ON p.id = ps.player_id
    WHERE p.id = player2_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'One or both players not found';
    END IF;

    -- Simple match simulation based on player levels
    -- In a real system, this would be more sophisticated
    IF (player1_info.level + random()) > (player2_info.level + random()) THEN
        winner_id := player1_id;
        match_score := '21-' || (15 + floor(random() * 6)::integer)::text || ', ' || 
                      '21-' || (10 + floor(random() * 11)::integer)::text;
    ELSE
        winner_id := player2_id;
        match_score := (15 + floor(random() * 6)::integer)::text || '-21, ' || 
                      (10 + floor(random() * 11)::integer)::text || '-21';
    END IF;

    -- Update match with results and timestamp
    UPDATE match 
    SET 
        winner = winner_id,
        score = match_score,
        completed = true,
        actual_start_time = now(),
        completed_at = now()
    WHERE match_id = p_match_id;

    -- Check if this match completion advances the tournament
    round_advancement := check_and_advance_tournament(match_record.round_id);

    result := jsonb_build_object(
        'success', true,
        'matchId', p_match_id,
        'winner', winner_id,
        'score', match_score,
        'tournamentId', match_record.tournament_id,
        'roundLevel', match_record.round_level,
        'roundName', match_record.round_name,
        'message', 'Match completed successfully',
        'player1', jsonb_build_object(
            'id', player1_id, 
            'name', player1_info.name, 
            'level', player1_info.level,
            'is_cpu', COALESCE(player1_info.is_cpu, false)
        ),
        'player2', jsonb_build_object(
            'id', player2_id, 
            'name', player2_info.name, 
            'level', player2_info.level,
            'is_cpu', COALESCE(player2_info.is_cpu, false)
        ),
        'roundAdvancement', round_advancement
    );

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to execute match: %', SQLERRM;
END;
$$;

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    permissions jsonb DEFAULT '{"tournaments": true, "interclub": true, "users": true, "cpu_teams": true}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- CPU teams table for AI opponents
CREATE TABLE IF NOT EXISTS cpu_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    skill_level integer DEFAULT 1 CHECK (skill_level >= 1 AND skill_level <= 10),
    players jsonb NOT NULL, -- Array of CPU players with stats
    created_by uuid REFERENCES admin_users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Interclub seasons table
CREATE TABLE IF NOT EXISTS interclub_seasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    start_date timestamptz NOT NULL,
    end_date timestamptz NOT NULL,
    registration_deadline timestamptz NOT NULL,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'registration_open', 'registration_closed', 'active', 'completed')),
    groups jsonb DEFAULT '[]'::jsonb, -- Array of groups with team assignments
    max_teams_per_group integer DEFAULT 8,
    created_by uuid REFERENCES admin_users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Interclub team registrations
CREATE TABLE IF NOT EXISTS interclub_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id uuid REFERENCES interclub_seasons(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    team_name text NOT NULL,
    players jsonb NOT NULL, -- 5 players with positions: mens_singles, womens_singles, mens_doubles, womens_doubles, mixed_doubles
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    group_assignment integer,
    reviewed_by uuid REFERENCES admin_users(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(season_id, user_id)
);

-- Interclub matches table for tracking team vs team matches
CREATE TABLE IF NOT EXISTS interclub_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id uuid REFERENCES interclub_seasons(id) ON DELETE CASCADE NOT NULL,
    week_number integer NOT NULL,
    group_number integer NOT NULL,
    home_team_id uuid, -- Can reference interclub_registrations.id or cpu_teams.id
    away_team_id uuid, -- Can reference interclub_registrations.id or cpu_teams.id
    home_team_type text DEFAULT 'user' CHECK (home_team_type IN ('user', 'cpu')),
    away_team_type text DEFAULT 'user' CHECK (away_team_type IN ('user', 'cpu')),
    match_date timestamptz NOT NULL,
    status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
    home_lineup jsonb, -- 5 players lineup for home team
    away_lineup jsonb, -- 5 players lineup for away team
    results jsonb, -- Individual match results (mens_singles, womens_singles, etc.)
    winner_team_id uuid,
    winner_team_type text CHECK (winner_team_type IN ('user', 'cpu')),
    final_score text, -- "3-2", "4-1", etc.
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tournament admin settings (extends existing tournaments)
CREATE TABLE IF NOT EXISTS tournament_admin_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL, -- References existing tournaments table
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
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
    action_type text NOT NULL, -- 'tournament_created', 'season_launched', 'user_password_changed', etc.
    target_type text, -- 'tournament', 'user', 'season', etc.
    target_id uuid,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_cpu_teams_skill_level ON cpu_teams(skill_level);
CREATE INDEX IF NOT EXISTS idx_interclub_seasons_status ON interclub_seasons(status);
CREATE INDEX IF NOT EXISTS idx_interclub_registrations_season_id ON interclub_registrations(season_id);
CREATE INDEX IF NOT EXISTS idx_interclub_registrations_user_id ON interclub_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_interclub_registrations_status ON interclub_registrations(status);
CREATE INDEX IF NOT EXISTS idx_interclub_matches_season_id ON interclub_matches(season_id);
CREATE INDEX IF NOT EXISTS idx_interclub_matches_status ON interclub_matches(status);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_user_id ON admin_activity_logs(admin_user_id);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cpu_teams_updated_at BEFORE UPDATE ON cpu_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interclub_seasons_updated_at BEFORE UPDATE ON interclub_seasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interclub_registrations_updated_at BEFORE UPDATE ON interclub_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interclub_matches_updated_at BEFORE UPDATE ON interclub_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tournament_admin_settings_updated_at BEFORE UPDATE ON tournament_admin_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpu_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin users can manage everything
CREATE POLICY "Admin users can manage admin_users" ON admin_users FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admin users can manage cpu_teams" ON cpu_teams FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admin users can manage interclub_seasons" ON interclub_seasons FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Users can view seasons and register
CREATE POLICY "Users can view interclub_seasons" ON interclub_seasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage their own registrations" ON interclub_registrations FOR ALL TO authenticated USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view their group matches" ON interclub_matches FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM interclub_registrations ir 
        WHERE ir.user_id = auth.uid() 
        AND (ir.id::text = home_team_id::text OR ir.id::text = away_team_id::text)
    ) OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admin users can manage matches" ON interclub_matches FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admin users can manage tournament settings" ON tournament_admin_settings FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admin users can view activity logs" ON admin_activity_logs FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);


-- Fix Admin Activity Logs RLS Policy
-- Allow admins to insert activity logs

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admin users can view activity logs" ON admin_activity_logs;
DROP POLICY IF EXISTS "Admin users can insert activity logs" ON admin_activity_logs;

-- Create policies for SELECT and INSERT operations
CREATE POLICY "Admin users can view activity logs" ON admin_activity_logs 
FOR SELECT TO authenticated 
USING (is_admin());

CREATE POLICY "Admin users can insert activity logs" ON admin_activity_logs 
FOR INSERT TO authenticated 
WITH CHECK (is_admin());

-- Update the log_admin_activity function to use proper RLS context
CREATE OR REPLACE FUNCTION log_admin_activity(
    p_admin_user_id uuid,
    p_action_type text,
    p_target_type text DEFAULT NULL,
    p_target_id uuid DEFAULT NULL,
    p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
BEGIN
    INSERT INTO admin_activity_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (p_admin_user_id, p_action_type, p_target_type, p_target_id, p_details);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_admin_activity TO authenticated; 



-- Add function to get total user count
-- Since auth.users is not directly accessible from client, we need a function

CREATE OR REPLACE FUNCTION get_total_user_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Count users from auth.users table
    RETURN (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL);
END;
$$;

-- Grant execute permission to authenticated users (admins will use this)
GRANT EXECUTE ON FUNCTION get_total_user_count TO authenticated;

-- Also create a function to get user stats for admin dashboard
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Only allow admins to call this function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    SELECT jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL),
        'total_players', (SELECT COUNT(*) FROM players),
        'active_tournaments', (SELECT COUNT(*) FROM tournament_list WHERE status = 1),
        'active_seasons', (SELECT COUNT(*) FROM interclub_seasons WHERE status IN ('registration_open', 'active')),
        'total_cpu_teams', (SELECT COUNT(*) FROM cpu_teams),
        'total_admins', (SELECT COUNT(*) FROM admin_users)
    ) INTO result;

    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats TO authenticated; 




-- Fix CPU Teams Schema Issues
-- This migration ensures the database schema is consistent and fixes all issues

-- First, ensure the players table has the is_cpu column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'is_cpu') THEN
        ALTER TABLE players ADD COLUMN is_cpu boolean DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_players_is_cpu ON players(is_cpu);
    END IF;
END $$;

-- Ensure cpu_teams table has the correct structure
DO $$
BEGIN
    -- Check if cpu_teams table exists with old structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cpu_teams') THEN
        -- Check if we have the old jsonb structure
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cpu_teams' AND column_name = 'players' AND data_type = 'jsonb') THEN
            -- Drop the old structure and recreate with proper schema
            DROP TABLE IF EXISTS cpu_teams CASCADE;
        END IF;
    END IF;
    
    -- Create the correct cpu_teams table structure
    CREATE TABLE IF NOT EXISTS cpu_teams (
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
END $$;

-- Ensure player_team_assignments table exists with proper foreign keys
CREATE TABLE IF NOT EXISTS player_team_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id uuid NOT NULL REFERENCES cpu_teams(id) ON DELETE CASCADE,
    assigned_at timestamptz DEFAULT now(),
    UNIQUE(player_id, team_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cpu_teams_skill_level ON cpu_teams(skill_level);
CREATE INDEX IF NOT EXISTS idx_cpu_teams_active ON cpu_teams(is_active);
CREATE INDEX IF NOT EXISTS idx_player_team_assignments_player_id ON player_team_assignments(player_id);
CREATE INDEX IF NOT EXISTS idx_player_team_assignments_team_id ON player_team_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_players_is_cpu ON players(is_cpu);

-- Enable RLS on tables
ALTER TABLE cpu_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_team_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies to avoid conflicts
DROP POLICY IF EXISTS "Admin users can manage cpu_teams" ON cpu_teams;
DROP POLICY IF EXISTS "Users can view active cpu_teams" ON cpu_teams;
DROP POLICY IF EXISTS "Admin users can manage player_team_assignments" ON player_team_assignments;

-- Create RLS policies
CREATE POLICY "Admin users can manage cpu_teams" ON cpu_teams FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can view active cpu_teams" ON cpu_teams FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admin users can manage player_team_assignments" ON player_team_assignments FOR ALL TO authenticated USING (is_admin());

-- Create update trigger for cpu_teams
CREATE TRIGGER update_cpu_teams_updated_at 
    BEFORE UPDATE ON cpu_teams 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Ensure the generate_cpu_players_for_team function exists and is correct
CREATE OR REPLACE FUNCTION generate_cpu_players_for_team(
    team_id uuid,
    skill_level text,
    player_count integer,
    gender_balance text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i integer;
    player_name text;
    player_gender gender_enum;
    new_player_id uuid;
    dummy_user_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Only allow admins to call this function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Ensure the dummy user exists in auth.users (this is a workaround for CPU players)
    INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
    VALUES (dummy_user_id, 'cpu@system.local', now(), now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Generate players based on count and gender balance
    FOR i IN 1..player_count LOOP
        -- Generate player name
        player_name := 'CPU Player ' || i || ' (Team: ' || (SELECT name FROM cpu_teams WHERE id = team_id) || ')';
        
        -- Determine gender based on balance setting
        IF gender_balance = 'male' THEN
            player_gender := 'male';
        ELSIF gender_balance = 'female' THEN
            player_gender := 'female';
        ELSE -- mixed
            player_gender := CASE WHEN i % 2 = 0 THEN 'male' ELSE 'female' END;
        END IF;

        -- Create CPU player
        INSERT INTO players (user_id, name, level, max_level, gender, is_cpu)
        VALUES (
            dummy_user_id,
            player_name,
            CASE skill_level
                WHEN 'beginner' THEN 1 + (random() * 2)::integer
                WHEN 'intermediate' THEN 3 + (random() * 3)::integer
                WHEN 'advanced' THEN 6 + (random() * 3)::integer
                WHEN 'expert' THEN 9 + (random() * 3)::integer
                WHEN 'master' THEN 12 + (random() * 3)::integer
                ELSE 5
            END,
            15, -- max level
            player_gender,
            true -- is_cpu
        )
        RETURNING id INTO new_player_id;

        -- Create default stats for the CPU player
        INSERT INTO player_stats (player_id, endurance, strength, agility, speed, explosiveness, injury_prevention, smash, defense, serve, stick, slice, drop)
        VALUES (
            new_player_id,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END,
            CASE skill_level
                WHEN 'beginner' THEN 30 + (random() * 20)::integer
                WHEN 'intermediate' THEN 50 + (random() * 20)::integer
                WHEN 'advanced' THEN 70 + (random() * 20)::integer
                WHEN 'expert' THEN 90 + (random() * 20)::integer
                WHEN 'master' THEN 110 + (random() * 20)::integer
                ELSE 50
            END
        );

        -- Create default levels for the CPU player
        INSERT INTO player_levels (player_id)
        VALUES (new_player_id);

        -- Create default strategy for the CPU player
        INSERT INTO player_strategy (player_id)
        VALUES (new_player_id);

        -- Assign player to team
        INSERT INTO player_team_assignments (player_id, team_id)
        VALUES (new_player_id, team_id);
    END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_cpu_players_for_team TO authenticated;


CREATE POLICY "Admin users can read all players" 
ON public.players 
FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));





-- Migration: Tournament Registration System
-- Adds function to register players for tournaments

-- Function to register a player for a tournament
CREATE OR REPLACE FUNCTION register_player_for_tournament(
    p_tournament_id uuid,
    p_player_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    player_record players%ROWTYPE;
    result jsonb := '{"success": true, "message": "Registration successful"}'::jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Check tournament status - must be upcoming (0)
    IF tournament_record.status != 0 THEN
        IF tournament_record.status = 1 THEN
            RAISE EXCEPTION 'Tournament has already started - registration is closed';
        ELSIF tournament_record.status = 2 THEN
            RAISE EXCEPTION 'Tournament has ended - registration is no longer available';
        ELSE
            RAISE EXCEPTION 'Tournament registration is not available';
        END IF;
    END IF;

    -- Check if tournament start time has passed (additional safety check)
    IF tournament_record.start_date <= now() THEN
        RAISE EXCEPTION 'Tournament registration period has ended - tournament is starting or has started';
    END IF;

    -- Check if tournament is full
    IF tournament_record."current_Participants" >= tournament_record.max_participants THEN
        RAISE EXCEPTION 'Tournament is full - no more spots available';
    END IF;

    -- Get player details
    SELECT * INTO player_record FROM players WHERE id = p_player_id AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found or not owned by user';
    END IF;

    -- Check player level requirement
    IF player_record.level < tournament_record."min_PlayerLevel" THEN
        RAISE EXCEPTION 'Player level (%) is too low for this tournament (minimum level: %)', 
            player_record.level, tournament_record."min_PlayerLevel";
    END IF;

    -- Check if player is already registered
    IF tournament_record."registeredPlayers" IS NOT NULL AND array_length(tournament_record."registeredPlayers", 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM unnest(tournament_record."registeredPlayers") AS elem
            WHERE (elem->>'playerId')::uuid = p_player_id
        ) THEN
            RAISE EXCEPTION 'Player is already registered for this tournament';
        END IF;
    END IF;

    -- Add player to tournament registration (using timestamp instead of epoch milliseconds)
    UPDATE tournament_list 
    SET 
        "registeredPlayers" = COALESCE("registeredPlayers", ARRAY[]::json[]) || 
            ARRAY[json_build_object(
                'playerId', p_player_id,
                'playerName', player_record.name,
                'clubId', 'user-club-' || auth.uid()::text,
                'clubName', 'User Club',
                'registered', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )::json],
        "current_Participants" = COALESCE("current_Participants", 0) + 1
    WHERE id = p_tournament_id;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Registration failed: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION register_player_for_tournament TO authenticated;

-- Function to get user's tournament registrations
CREATE OR REPLACE FUNCTION get_user_tournament_registrations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_tournaments jsonb := '[]'::jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'tournamentId', t.id,
            'tournamentName', t.name,
            'playerId', (elem->>'playerId')::uuid,
            'playerName', elem->>'playerName',
            'registered', elem->>'registered'  -- Keep as string timestamp
        )
    ) INTO user_tournaments
    FROM tournament_list t,
         unnest(COALESCE(t."registeredPlayers", ARRAY[]::json[])) AS elem
    WHERE (elem->>'playerId')::uuid IN (
        SELECT id FROM players WHERE user_id = auth.uid()
    );

    RETURN COALESCE(user_tournaments, '[]'::jsonb);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_tournament_registrations TO authenticated; 






-- Migration: Fix Tournament Registration Timestamps
-- Use proper timestamp types instead of bigint

-- First, update the resource constraint to allow tournament sources
ALTER TABLE resource_transactions DROP CONSTRAINT IF EXISTS valid_source;
ALTER TABLE resource_transactions ADD CONSTRAINT valid_source CHECK (
    source = ANY (
        ARRAY[
            'facility_production'::text,
            'training_cost'::text,
            'upgrade_cost'::text,
            'equipment_purchase'::text,
            'tournament_reward'::text,
            'tournament_registration'::text,
            'tournament_registration_refund'::text,
            'shop_purchase'::text
        ]
    )
);

-- Function to register a player for a tournament
CREATE OR REPLACE FUNCTION register_player_for_tournament(
    p_tournament_id uuid,
    p_player_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    player_record players%ROWTYPE;
    result jsonb := '{"success": true, "message": "Registration successful"}'::jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Check tournament status
    IF tournament_record.status != 0 THEN -- 0 = upcoming
        RAISE EXCEPTION 'Tournament registration is closed';
    END IF;

    -- Check if tournament is full
    IF tournament_record."current_Participants" >= tournament_record.max_participants THEN
        RAISE EXCEPTION 'Tournament is full';
    END IF;

    -- Get player details
    SELECT * INTO player_record FROM players WHERE id = p_player_id AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found or not owned by user';
    END IF;

    -- Check player level requirement
    IF player_record.level < tournament_record."min_PlayerLevel" THEN
        RAISE EXCEPTION 'Player level too low for this tournament';
    END IF;

    -- Get user resources (assuming we have a user_resources table or similar)
    -- For now, we'll skip resource validation and assume it's handled in frontend
    
    -- Check if player is already registered
    IF tournament_record."registeredPlayers" IS NOT NULL AND array_length(tournament_record."registeredPlayers", 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM unnest(tournament_record."registeredPlayers") AS elem
            WHERE (elem->>'playerId')::uuid = p_player_id
        ) THEN
            RAISE EXCEPTION 'Player already registered for this tournament';
        END IF;
    END IF;

    -- Add player to tournament registration (using timestamp instead of epoch milliseconds)
    UPDATE tournament_list 
    SET 
        "registeredPlayers" = COALESCE("registeredPlayers", ARRAY[]::json[]) || 
            ARRAY[json_build_object(
                'playerId', p_player_id,
                'playerName', player_record.name,
                'clubId', 'user-club-' || auth.uid()::text,
                'clubName', 'User Club',
                'registered', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )::json],
        "current_Participants" = COALESCE("current_Participants", 0) + 1
    WHERE id = p_tournament_id;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Registration failed: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION register_player_for_tournament TO authenticated;

-- Function to get user's tournament registrations
CREATE OR REPLACE FUNCTION get_user_tournament_registrations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_tournaments jsonb := '[]'::jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'tournamentId', t.id,
            'tournamentName', t.name,
            'playerId', (elem->>'playerId')::uuid,
            'playerName', elem->>'playerName',
            'registered', elem->>'registered'  -- Keep as string timestamp
        )
    ) INTO user_tournaments
    FROM tournament_list t,
         unnest(COALESCE(t."registeredPlayers", ARRAY[]::json[])) AS elem
    WHERE (elem->>'playerId')::uuid IN (
        SELECT id FROM players WHERE user_id = auth.uid()
    );

    RETURN COALESCE(user_tournaments, '[]'::jsonb);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_tournament_registrations TO authenticated; 









-- Migration: Tournament Execution System
-- Adds functions to automatically start tournaments, execute matches, and manage progression

-- Function to start a tournament (changes status from upcoming to ongoing)
CREATE OR REPLACE FUNCTION start_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    first_round_id uuid;
    result jsonb := '{"success": true, "message": "Tournament started successfully"}'::jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Check if tournament can be started
    -- IF tournament_record.status != 0 THEN -- 0 = upcoming
    --     RAISE EXCEPTION 'Tournament is not in upcoming status';
    -- END IF;

    -- Check if tournament start time has passed
    IF tournament_record.start_date > now() THEN
        RAISE EXCEPTION 'Tournament start time has not arrived yet';
    END IF;

    -- Update tournament status to ongoing
    UPDATE tournament_list 
    SET status = 1 -- 1 = ongoing
    WHERE id = p_tournament_id;

    -- Get first round and populate with registered players
    SELECT id INTO first_round_id 
    FROM round 
    WHERE tournament_id = p_tournament_id 
    ORDER BY level ASC 
    LIMIT 1;

    IF first_round_id IS NULL THEN
        RAISE EXCEPTION 'No rounds found for tournament. Please create tournament rounds first.';
    END IF;

    -- Populate first round matches with registered players
    PERFORM populate_first_round_matches(p_tournament_id, first_round_id);

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to start tournament: %', SQLERRM;
END;
$$;

-- Function to populate first round matches with registered players
CREATE OR REPLACE FUNCTION populate_first_round_matches(
    p_tournament_id uuid,
    p_round_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    registered_players json[];
    player_ids uuid[];
    match_record record;
    player_index integer := 1;
    player_count integer;
BEGIN
    -- Get registered players
    SELECT "registeredPlayers" INTO registered_players 
    FROM tournament_list 
    WHERE id = p_tournament_id;

    -- Extract player IDs
    SELECT array_agg((elem->>'playerId')::uuid) INTO player_ids
    FROM unnest(COALESCE(registered_players, ARRAY[]::json[])) AS elem;

    -- Check if we have any players
    player_count := COALESCE(array_length(player_ids, 1), 0);
    
    IF player_count = 0 THEN
        RAISE NOTICE 'No registered players found for tournament %', p_tournament_id;
        RETURN;
    END IF;

    -- Shuffle players randomly (only if we have players)
    player_ids := array_shuffle(player_ids);

    -- Populate matches with players
    FOR match_record IN 
        SELECT match_id FROM match WHERE round_id = p_round_id ORDER BY match_id
    LOOP
        -- Assign two players to each match
        IF player_index <= player_count - 1 THEN
            UPDATE match 
            SET players = ARRAY[player_ids[player_index], player_ids[player_index + 1]]
            WHERE match_id = match_record.match_id;
            
            player_index := player_index + 2;
        ELSE
            -- Not enough players for this match, leave it empty
            RAISE NOTICE 'Not enough players for match %, skipping', match_record.match_id;
        END IF;
    END LOOP;
END;
$$;

-- Function to shuffle array (helper function)
CREATE OR REPLACE FUNCTION array_shuffle(arr uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
AS $$
DECLARE
    i integer;
    j integer;
    temp uuid;
    result uuid[];
    arr_length integer;
BEGIN
    result := arr;
    arr_length := COALESCE(array_length(result, 1), 0);
    
    -- Return empty array if input is null or empty
    IF arr_length = 0 THEN
        RETURN result;
    END IF;
    
    FOR i IN 1..arr_length LOOP
        j := floor(random() * arr_length + 1)::integer;
        temp := result[i];
        result[i] := result[j];
        result[j] := temp;
    END LOOP;
    
    RETURN result;
END;
$$;

-- Removed old execute_match function - using enhanced version below

-- Removed old check_and_advance_tournament function - using enhanced version below

-- Function to populate next round with winners
CREATE OR REPLACE FUNCTION populate_next_round(
    p_current_round_id uuid,
    p_next_round_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    winners uuid[];
    next_match_record record;
    winner_index integer := 1;
BEGIN
    -- Get winners from current round
    SELECT array_agg(m.winner ORDER BY m.match_id) INTO winners
    FROM match m 
    WHERE m.round_id = p_current_round_id AND m.completed = true;

    -- Populate next round matches
    FOR next_match_record IN 
        SELECT match_id FROM match WHERE round_id = p_next_round_id ORDER BY match_id
    LOOP
        -- Assign two winners to each match
        IF winner_index <= array_length(winners, 1) - 1 THEN
            UPDATE match 
            SET players = ARRAY[winners[winner_index], winners[winner_index + 1]]
            WHERE match_id = next_match_record.match_id;
            
            winner_index := winner_index + 2;
        END IF;
    END LOOP;
END;
$$;

-- Note: distribute_tournament_prizes function removed to avoid conflicts with distribute_tournament_rewards in 20250120000000_tournament_round_management.sql

-- Function to get tournament status and next actions
CREATE OR REPLACE FUNCTION get_tournament_status(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    current_round record;
    pending_matches integer;
    result jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "Tournament not found"}'::jsonb;
    END IF;

    -- Get current round (first uncompleted round)
    SELECT r.*, COUNT(m.match_id) as total_matches,
           COUNT(CASE WHEN m.completed THEN 1 END) as completed_matches
    INTO current_round
    FROM round r
    LEFT JOIN match m ON m.round_id = r.id
    WHERE r.tournament_id = p_tournament_id
    GROUP BY r.id, r.name, r.level
    HAVING COUNT(CASE WHEN NOT m.completed THEN 1 END) > 0
    ORDER BY r.level ASC
    LIMIT 1;

    result := jsonb_build_object(
        'tournament_id', tournament_record.id,
        'tournament_name', tournament_record.name,
        'status', tournament_record.status,
        'current_participants', tournament_record."current_Participants",
        'max_participants', tournament_record.max_participants
    );

    IF current_round.id IS NOT NULL THEN
        result := result || jsonb_build_object(
            'current_round', jsonb_build_object(
                'id', current_round.id,
                'name', current_round.name,
                'level', current_round.level,
                'total_matches', current_round.total_matches,
                'completed_matches', current_round.completed_matches
            )
        );
    END IF;

    RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION start_tournament TO authenticated;
GRANT EXECUTE ON FUNCTION execute_match TO authenticated;
GRANT EXECUTE ON FUNCTION get_tournament_status TO authenticated; 

















-- Tournament Round Management System
-- Adds proper round scheduling with configurable intervals

-- Add round interval configuration to tournaments
ALTER TABLE tournament_list ADD COLUMN IF NOT EXISTS round_interval_minutes INTEGER DEFAULT 10;
ALTER TABLE tournament_list ADD COLUMN IF NOT EXISTS next_round_start_time TIMESTAMPTZ;
ALTER TABLE tournament_list ADD COLUMN IF NOT EXISTS current_round_level INTEGER DEFAULT 0;

-- Add match scheduling fields
ALTER TABLE match ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMPTZ;
ALTER TABLE match ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMPTZ;
ALTER TABLE match ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

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

-- Function to get user's next match with countdown
CREATE OR REPLACE FUNCTION get_user_next_match(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb := '{"hasUpcomingMatch": false}'::jsonb;
    user_registration record;
    next_match record;
    tournament_info record;
BEGIN
    -- Find user's active tournament registrations
    FOR user_registration IN
        SELECT utr.*, tl.name as tournament_name, tl.round_interval_minutes, tl.next_round_start_time
        FROM user_tournament_registrations utr
        JOIN tournament_list tl ON utr.tournament_id = tl.id
        WHERE utr.user_id = p_user_id AND utr.status = 'active'
    LOOP
        -- Find next match for this player
        SELECT m.*, r.name as round_name, r.level as round_level INTO next_match
        FROM match m
        JOIN round r ON m.round_id = r.id
        WHERE r.tournament_id = user_registration.tournament_id
        AND m.players && ARRAY[user_registration.player_id]
        AND m.completed = false
        ORDER BY r.level, m.match_id
        LIMIT 1;

        IF FOUND THEN
            result := jsonb_build_object(
                'hasUpcomingMatch', true,
                'tournamentId', user_registration.tournament_id,
                'tournamentName', user_registration.tournament_name,
                'matchId', next_match.match_id,
                'roundName', next_match.round_name,
                'roundLevel', next_match.round_level,
                'scheduledStartTime', COALESCE(next_match.scheduled_start_time, user_registration.next_round_start_time),
                'opponentId', CASE 
                    WHEN next_match.players[1] = user_registration.player_id THEN next_match.players[2]
                    ELSE next_match.players[1]
                END,
                'roundIntervalMinutes', user_registration.round_interval_minutes
            );
            EXIT; -- Return first upcoming match found
        END IF;
    END LOOP;

    RETURN result;
END;
$$;

-- Function to advance tournament to next round
CREATE OR REPLACE FUNCTION advance_tournament_round(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    current_round_level integer;
    next_round_level integer;
    next_round_start_time timestamptz;
    result jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Get current round level
    SELECT MAX(r.level) INTO current_round_level
    FROM round r
    JOIN match m ON r.id = m.round_id
    WHERE r.tournament_id = p_tournament_id AND m.completed = true;

    next_round_level := current_round_level + 1;

    -- Check if there's a next round
    IF EXISTS (SELECT 1 FROM round WHERE tournament_id = p_tournament_id AND level = next_round_level) THEN
                  -- Calculate next round start time (with manual timezone offset correction)
          next_round_start_time := now() + (tournament_record.round_interval_minutes || ' minutes')::interval - INTERVAL '2 minutes 30 seconds';

        -- Update tournament
        UPDATE tournament_list 
        SET 
            current_round_level = next_round_level,
            next_round_start_time = next_round_start_time
        WHERE id = p_tournament_id;

        -- Schedule next round matches
        UPDATE match 
        SET scheduled_start_time = next_round_start_time
        WHERE round_id IN (
            SELECT id FROM round 
            WHERE tournament_id = p_tournament_id AND level = next_round_level
        );

        result := jsonb_build_object(
            'success', true,
            'message', 'Advanced to next round',
            'currentRound', next_round_level,
            'nextRoundStartTime', next_round_start_time
        );
    ELSE
        -- Tournament completed
        UPDATE tournament_list 
        SET 
            status = 2, -- completed
            current_round_level = current_round_level
        WHERE id = p_tournament_id;

        -- Distribute rewards
        PERFORM distribute_tournament_rewards(p_tournament_id);

        result := jsonb_build_object(
            'success', true,
            'message', 'Tournament completed',
            'completed', true
        );
    END IF;

    RETURN result;
END;
$$;

-- Enhanced function to distribute tournament rewards
CREATE OR REPLACE FUNCTION distribute_tournament_rewards(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    final_match record;
    winner_id uuid;
    second_place_id uuid;
    third_place_ids uuid[];
    registration_record record;
    result jsonb := '{"success": true, "distributed": []}'::jsonb;
    distributed_rewards jsonb := '[]'::jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Find final match (highest round level)
    SELECT m.*, r.level INTO final_match
    FROM match m
    JOIN round r ON m.round_id = r.id
    WHERE r.tournament_id = p_tournament_id
    ORDER BY r.level DESC, m.match_id
    LIMIT 1;

    IF final_match.completed AND final_match.winner IS NOT NULL THEN
        winner_id := final_match.winner;
        -- Second place is the loser of final match
        second_place_id := CASE 
            WHEN final_match.players[1] = winner_id THEN final_match.players[2]
            ELSE final_match.players[1]
        END;

        -- Update winner position
        UPDATE user_tournament_registrations 
        SET 
            status = 'winner',
            final_position = 1,
            rewards_distributed = true
        WHERE tournament_id = p_tournament_id AND player_id = winner_id;

        -- Update second place
        UPDATE user_tournament_registrations 
        SET 
            final_position = 2,
            rewards_distributed = true
        WHERE tournament_id = p_tournament_id AND player_id = second_place_id;

        -- Distribute rewards to user accounts (would need resource_transactions table)
        -- For now, just track in registration records

        distributed_rewards := distributed_rewards || jsonb_build_object(
            'playerId', winner_id,
            'position', 1,
            'rewards', tournament_record."prizePool" -> 'first'
        );

        distributed_rewards := distributed_rewards || jsonb_build_object(
            'playerId', second_place_id,
            'position', 2,
            'rewards', tournament_record."prizePool" -> 'second'
        );
    END IF;

    result := jsonb_set(result, '{distributed}', distributed_rewards);
    RETURN result;
END;
$$;

-- Function to get tournament results
CREATE OR REPLACE FUNCTION get_tournament_results(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    results jsonb := '{"tournament": {}, "rankings": [], "completed": false}'::jsonb;
    rankings jsonb := '[]'::jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Build tournament info
    results := jsonb_set(results, '{tournament}', to_jsonb(tournament_record));
    results := jsonb_set(results, '{completed}', to_jsonb(tournament_record.status = 2));

    -- Get rankings from registrations
    SELECT jsonb_agg(
        jsonb_build_object(
            'playerId', utr.player_id,
            'playerName', p.name,
            'finalPosition', COALESCE(utr.final_position, 999),
            'status', utr.status,
            'rewardsDistributed', utr.rewards_distributed
        ) ORDER BY COALESCE(utr.final_position, 999)
    ) INTO rankings
    FROM user_tournament_registrations utr
    JOIN players p ON utr.player_id = p.id
    WHERE utr.tournament_id = p_tournament_id;

    results := jsonb_set(results, '{rankings}', COALESCE(rankings, '[]'::jsonb));

    RETURN results;
END;
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tournament_registrations_user_id ON user_tournament_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_registrations_tournament_id ON user_tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_registrations_status ON user_tournament_registrations(status);
CREATE INDEX IF NOT EXISTS idx_match_scheduled_start_time ON match(scheduled_start_time) WHERE scheduled_start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournament_list_next_round_start_time ON tournament_list(next_round_start_time) WHERE next_round_start_time IS NOT NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_next_match TO authenticated;
GRANT EXECUTE ON FUNCTION advance_tournament_round TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_tournament_rewards TO authenticated;
GRANT EXECUTE ON FUNCTION get_tournament_results TO authenticated; 










-- Tournament Automation Functions
-- Adds functions for automatic tournament execution based on intervals

-- Function to get tournament automation status
CREATE OR REPLACE FUNCTION get_tournament_automation_status(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    current_round record;
    total_rounds integer;
    result jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "Tournament not found"}'::jsonb;
    END IF;

    -- Get total number of rounds
    SELECT COUNT(*) INTO total_rounds FROM round WHERE tournament_id = p_tournament_id;

    -- Get current round (first uncompleted round)
    SELECT r.*, COUNT(m.match_id) as total_matches,
           COUNT(CASE WHEN m.completed THEN 1 END) as completed_matches
    INTO current_round
    FROM round r
    LEFT JOIN match m ON m.round_id = r.id
    WHERE r.tournament_id = p_tournament_id
    GROUP BY r.id, r.name, r.level
    HAVING COUNT(CASE WHEN NOT m.completed THEN 1 END) > 0
    ORDER BY r.level ASC
    LIMIT 1;

    result := jsonb_build_object(
        'tournamentId', tournament_record.id,
        'currentRoundLevel', COALESCE(tournament_record.current_round_level, 0),
        'totalRounds', total_rounds,
        'nextExecutionTime', tournament_record.next_round_start_time,
        'roundIntervalMinutes', tournament_record.round_interval_minutes
    );

    IF current_round.id IS NOT NULL THEN
        result := result || jsonb_build_object(
            'currentRound', jsonb_build_object(
                'id', current_round.id,
                'name', current_round.name,
                'level', current_round.level,
                'totalMatches', current_round.total_matches,
                'completedMatches', current_round.completed_matches
            )
        );
    END IF;

    RETURN result;
END;
$$;

-- Function to schedule next tournament round
CREATE OR REPLACE FUNCTION schedule_next_tournament_round(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    v_current_round_level integer;
    next_round_level integer;
    next_execution_time timestamptz;
    result jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Get current incomplete round level
    SELECT MIN(r.level) INTO v_current_round_level
    FROM round r
    JOIN match m ON r.id = m.round_id
    WHERE r.tournament_id = p_tournament_id 
    AND m.completed = false;

    IF v_current_round_level IS NULL THEN
        -- All rounds completed
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Tournament already completed'
        );
    END IF;

    -- Calculate next execution time (with manual timezone offset correction)
    next_execution_time := now() + (tournament_record.round_interval_minutes || ' minutes')::interval - INTERVAL '2 minutes 30 seconds';

    -- Update tournament
    UPDATE tournament_list 
    SET 
        current_round_level = v_current_round_level,
        next_round_start_time = next_execution_time
    WHERE id = p_tournament_id;

    -- Schedule matches in current round
    UPDATE match 
    SET scheduled_start_time = next_execution_time
    WHERE round_id IN (
        SELECT id FROM round 
        WHERE tournament_id = p_tournament_id AND level = v_current_round_level
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Next round scheduled',
        'currentRoundLevel', v_current_round_level,
        'nextExecutionTime', next_execution_time
    );
END;
$$;

-- Function to cancel tournament automation
CREATE OR REPLACE FUNCTION cancel_tournament_automation(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE tournament_list 
    SET next_round_start_time = NULL
    WHERE id = p_tournament_id;

    -- Clear scheduled start times for pending matches
    UPDATE match 
    SET scheduled_start_time = NULL
    WHERE round_id IN (
        SELECT id FROM round WHERE tournament_id = p_tournament_id
    ) AND completed = false;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Tournament automation cancelled'
    );
END;
$$;

-- Function to execute an entire tournament round
CREATE OR REPLACE FUNCTION execute_tournament_round(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    current_round_id uuid;
    v_current_round_level integer;
    match_record record;
    executed_count integer := 0;
    failed_count integer := 0;
    next_round_exists boolean := false;
    next_round_level integer;
    result jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Get current round (first round with incomplete matches)
    SELECT r.id, r.level INTO current_round_id, v_current_round_level
    FROM round r
    WHERE r.tournament_id = p_tournament_id
    AND EXISTS (
        SELECT 1 FROM match m 
        WHERE m.round_id = r.id AND m.completed = false
    )
    ORDER BY r.level ASC
    LIMIT 1;

    IF current_round_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No incomplete rounds found'
        );
    END IF;

    -- Execute all matches in current round
    FOR match_record IN
        SELECT m.match_id, m.id, m.players, m.completed
        FROM match m
        WHERE m.round_id = current_round_id
        AND m.completed = false
        AND m.players[1] IS NOT NULL 
        AND m.players[2] IS NOT NULL
    LOOP
        BEGIN
            -- Execute individual match
            PERFORM execute_match(match_record.match_id);
            executed_count := executed_count + 1;
            
            -- Log successful execution
            RAISE NOTICE 'Successfully executed match % in round %', match_record.id, v_current_round_level;
            
        EXCEPTION
            WHEN OTHERS THEN
                failed_count := failed_count + 1;
                RAISE WARNING 'Failed to execute match %: %', match_record.id, SQLERRM;
        END;
    END LOOP;

    -- Check if there's a next round
    next_round_level := v_current_round_level + 1;
    SELECT EXISTS(
        SELECT 1 FROM round 
        WHERE tournament_id = p_tournament_id AND level = next_round_level
    ) INTO next_round_exists;

    -- Update tournament current round level
    UPDATE tournament_list 
    SET 
        current_round_level = v_current_round_level,
        next_round_start_time = CASE 
            WHEN next_round_exists THEN now() + (round_interval_minutes || ' minutes')::interval - INTERVAL '2 minutes 30 seconds'
            ELSE NULL
        END
    WHERE id = p_tournament_id;

    -- If tournament is completed, update status
    IF NOT next_round_exists THEN
        UPDATE tournament_list 
        SET status = 2 -- completed
        WHERE id = p_tournament_id;
        
        -- Distribute rewards
        PERFORM distribute_tournament_rewards(p_tournament_id);
    END IF;

    result := jsonb_build_object(
        'success', true,
        'message', 'Round execution completed',
        'roundLevel', v_current_round_level,
        'executedMatches', executed_count,
        'failedMatches', failed_count,
        'hasNextRound', next_round_exists,
        'nextRoundLevel', CASE WHEN next_round_exists THEN next_round_level ELSE NULL END
    );

    RETURN result;
END;
$$;

-- Function to automatically advance tournament when round is completed
CREATE OR REPLACE FUNCTION auto_advance_tournament_round(p_tournament_id uuid, p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    current_round_level integer;
    next_round_level integer;
    round_completed boolean;
    next_round_id uuid;
    next_execution_time timestamptz;
    result jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Get round level
    SELECT level INTO current_round_level FROM round WHERE id = p_round_id;

    -- Check if all matches in current round are completed
    SELECT NOT EXISTS(
        SELECT 1 FROM match 
        WHERE round_id = p_round_id AND completed = false
    ) INTO round_completed;

    IF NOT round_completed THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Round not yet completed'
        );
    END IF;

    next_round_level := current_round_level + 1;

    -- Check if there's a next round
    SELECT id INTO next_round_id
    FROM round 
    WHERE tournament_id = p_tournament_id AND level = next_round_level;

    IF next_round_id IS NOT NULL THEN
        -- Advance to next round
        PERFORM populate_next_round(p_round_id, next_round_id);
        
                  -- Schedule next round execution (with manual timezone offset correction)
          next_execution_time := now() + (tournament_record.round_interval_minutes || ' minutes')::interval - INTERVAL '2 minutes 30 seconds';
        
        UPDATE tournament_list 
        SET 
            current_round_level = next_round_level,
            next_round_start_time = next_execution_time
        WHERE id = p_tournament_id;

        -- Schedule next round matches
        UPDATE match 
        SET scheduled_start_time = next_execution_time
        WHERE round_id = next_round_id;

        result := jsonb_build_object(
            'success', true,
            'message', 'Advanced to next round',
            'currentRoundLevel', next_round_level,
            'nextExecutionTime', next_execution_time,
            'hasNextRound', true
        );
    ELSE
        -- Tournament completed
        UPDATE tournament_list 
        SET 
            status = 2, -- completed
            current_round_level = current_round_level,
            next_round_start_time = NULL
        WHERE id = p_tournament_id;

        -- Distribute rewards
        PERFORM distribute_tournament_rewards(p_tournament_id);

        result := jsonb_build_object(
            'success', true,
            'message', 'Tournament completed',
            'currentRoundLevel', current_round_level,
            'hasNextRound', false
        );
    END IF;

    RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_tournament_automation_status TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_next_tournament_round TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_tournament_automation TO authenticated;
GRANT EXECUTE ON FUNCTION execute_tournament_round TO authenticated;
GRANT EXECUTE ON FUNCTION auto_advance_tournament_round TO authenticated; 











-- Enhancement to match execution system for better frontend integration

-- Enhanced function to check and advance tournament with better result tracking
DROP FUNCTION IF EXISTS check_and_advance_tournament(uuid);
CREATE OR REPLACE FUNCTION check_and_advance_tournament(p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tournament_id uuid;
    v_current_round_level integer;
    next_round_id uuid;
    round_completed boolean;
    is_final_round boolean;
    tournament_record tournament_list%ROWTYPE;
    next_execution_time timestamptz;
    result jsonb;
BEGIN
    -- Get tournament ID and round level
    SELECT r.tournament_id, r.level INTO v_tournament_id, v_current_round_level
    FROM round r WHERE r.id = p_round_id;

    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = v_tournament_id;

    -- Check if all matches in current round are completed
    SELECT NOT EXISTS(
        SELECT 1 FROM match m 
        WHERE m.round_id = p_round_id AND m.completed = false
    ) INTO round_completed;

    IF NOT round_completed THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Round not yet completed',
            'roundCompleted', false
        );
    END IF;

    -- Check if this is the final round
    SELECT NOT EXISTS(
        SELECT 1 FROM round r 
        WHERE r.tournament_id = v_tournament_id AND r.level > v_current_round_level
    ) INTO is_final_round;

    IF is_final_round THEN
        -- Tournament completed, update status
        UPDATE tournament_list 
        SET 
            status = 2, -- completed
            next_round_start_time = NULL
        WHERE id = v_tournament_id;
        
        -- Distribute prizes
        PERFORM distribute_tournament_rewards(v_tournament_id);

        result := jsonb_build_object(
            'success', true,
            'message', 'Tournament completed',
            'tournamentCompleted', true,
            'roundCompleted', true,
            'currentRound', v_current_round_level
        );
    ELSE
        -- Advance to next round
        SELECT r.id INTO next_round_id 
        FROM round r 
        WHERE r.tournament_id = v_tournament_id AND r.level = v_current_round_level + 1;
        
        IF next_round_id IS NOT NULL THEN
            -- Populate next round with winners
            PERFORM populate_next_round(p_round_id, next_round_id);
            
            -- Calculate next execution time if automation is enabled
            IF tournament_record.next_round_start_time IS NOT NULL THEN
                next_execution_time := now() + (tournament_record.round_interval_minutes || ' minutes')::interval - INTERVAL '2 minutes 30 seconds';
                
                UPDATE tournament_list 
                SET 
                    current_round_level = v_current_round_level + 1,
                    next_round_start_time = next_execution_time
                WHERE id = v_tournament_id;

                -- Schedule next round matches
                UPDATE match 
                SET scheduled_start_time = next_execution_time
                WHERE round_id = next_round_id;
            ELSE
                -- Manual mode - just update round level
                UPDATE tournament_list 
                SET current_round_level = v_current_round_level + 1
                WHERE id = v_tournament_id;
            END IF;

            result := jsonb_build_object(
                'success', true,
                'message', 'Advanced to next round',
                'tournamentCompleted', false,
                'roundCompleted', true,
                'currentRound', v_current_round_level + 1,
                'nextRoundId', next_round_id,
                'nextExecutionTime', next_execution_time
            );
        END IF;
    END IF;

    RETURN result;
END;
$$;

-- Function to get detailed tournament progress for frontend
CREATE OR REPLACE FUNCTION get_tournament_progress(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    rounds_data jsonb;
    current_round record;
    result jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "Tournament not found"}'::jsonb;
    END IF;

    -- Get detailed rounds data
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'level', r.level,
            'totalMatches', match_stats.total_matches,
            'completedMatches', match_stats.completed_matches,
            'matches', match_stats.matches_data
        ) ORDER BY r.level
    ) INTO rounds_data
    FROM round r
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) as total_matches,
            COUNT(CASE WHEN m.completed THEN 1 END) as completed_matches,
            jsonb_agg(
                jsonb_build_object(
                    'id', m.id,
                    'match_id', m.match_id,
                    'players', m.players,
                    'winner', m.winner,
                    'score', m.score,
                    'completed', m.completed,
                    'scheduledStartTime', m.scheduled_start_time,
                    'completedAt', m.completed_at
                ) ORDER BY m.match_id
            ) as matches_data
        FROM match m WHERE m.round_id = r.id
    ) match_stats ON true
    WHERE r.tournament_id = p_tournament_id;

    -- Get current round info
    SELECT r.*, COUNT(m.match_id) as total_matches,
           COUNT(CASE WHEN m.completed THEN 1 END) as completed_matches
    INTO current_round
    FROM round r
    LEFT JOIN match m ON m.round_id = r.id
    WHERE r.tournament_id = p_tournament_id
    GROUP BY r.id, r.name, r.level
    HAVING COUNT(CASE WHEN NOT m.completed THEN 1 END) > 0
    ORDER BY r.level ASC
    LIMIT 1;

    result := jsonb_build_object(
        'tournamentId', tournament_record.id,
        'status', tournament_record.status,
        'currentRoundLevel', COALESCE(tournament_record.current_round_level, 0),
        'nextExecutionTime', tournament_record.next_round_start_time,
        'roundIntervalMinutes', tournament_record.round_interval_minutes,
        'rounds', COALESCE(rounds_data, '[]'::jsonb)
    );

    IF current_round.id IS NOT NULL THEN
        result := result || jsonb_build_object(
            'currentRound', jsonb_build_object(
                'id', current_round.id,
                'name', current_round.name,
                'level', current_round.level,
                'totalMatches', current_round.total_matches,
                'completedMatches', current_round.completed_matches
            )
        );
    END IF;

    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_tournament_progress TO authenticated; 



-- Enhanced function to register a player for a tournament with resource management
CREATE OR REPLACE FUNCTION register_player_for_tournament(
    p_tournament_id uuid,
    p_player_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    player_record players%ROWTYPE;
    entry_fee jsonb;
    resource_type text;
    resource_amount integer;
    result jsonb := '{"success": true, "message": "Registration successful"}'::jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Check tournament status
    IF tournament_record.status != 0 THEN -- 0 = upcoming
        RAISE EXCEPTION 'Tournament registration is closed';
    END IF;

    -- Check if tournament is full
    IF tournament_record."current_Participants" >= tournament_record.max_participants THEN
        RAISE EXCEPTION 'Tournament is full';
    END IF;

    -- Get player details
    SELECT * INTO player_record FROM players WHERE id = p_player_id AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found or not owned by user';
    END IF;

    -- Check player level requirement
    IF player_record.level < tournament_record."min_PlayerLevel" THEN
        RAISE EXCEPTION 'Player level too low for this tournament';
    END IF;

    -- Check if player is already registered
    IF tournament_record."registeredPlayers" IS NOT NULL AND array_length(tournament_record."registeredPlayers", 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM unnest(tournament_record."registeredPlayers") AS elem
            WHERE (elem->>'playerId')::uuid = p_player_id
        ) THEN
            RAISE EXCEPTION 'Player already registered for this tournament';
        END IF;
    END IF;

    -- Process entry fee (deduct resources from user)
    entry_fee := tournament_record."entryFee";
    IF entry_fee IS NOT NULL THEN
        FOR resource_type, resource_amount IN SELECT * FROM jsonb_each_text(entry_fee)
        LOOP
            IF resource_amount::integer > 0 THEN
                -- Insert negative resource transaction (deduction)
                INSERT INTO resource_transactions (
                    user_id, 
                    resource_type, 
                    amount, 
                    source, 
                    source_id
                ) VALUES (
                    auth.uid(),
                    resource_type,
                    -resource_amount::integer,
                    'tournament_registration',
                    p_tournament_id
                );
            END IF;
        END LOOP;
    END IF;

    -- Add player to tournament registration
    UPDATE tournament_list 
    SET 
        "registeredPlayers" = COALESCE("registeredPlayers", ARRAY[]::json[]) || 
            ARRAY[json_build_object(
                'playerId', p_player_id,
                'playerName', player_record.name,
                'clubId', 'user-club-' || auth.uid()::text,
                'clubName', 'User Club',
                'registered', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'registeredBy', 'user'
            )::json],
        "current_Participants" = COALESCE("current_Participants", 0) + 1
    WHERE id = p_tournament_id;

    -- Create user tournament registration record
    INSERT INTO user_tournament_registrations (
        tournament_id,
        user_id,
        player_id,
        status
    ) VALUES (
        p_tournament_id,
        auth.uid(),
        p_player_id,
        'active'
    ) ON CONFLICT (tournament_id, player_id) DO NOTHING;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Registration failed: %', SQLERRM;
END;
$$;

-- Function for admin to register any player (including real players) without resource deduction
CREATE OR REPLACE FUNCTION admin_register_player_for_tournament(
    p_tournament_id uuid,
    p_player_id uuid,
    p_force_registration boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    player_record players%ROWTYPE;
    player_owner_id uuid;
    result jsonb := '{"success": true, "message": "Player registered by admin"}'::jsonb;
BEGIN
    -- Only allow admins to call this function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Check if tournament is full (can be overridden by admin)
    IF NOT p_force_registration AND tournament_record."current_Participants" >= tournament_record.max_participants THEN
        RAISE EXCEPTION 'Tournament is full - use force_registration to override';
    END IF;

    -- Get player details (can be any player, not just owned by current user)
    SELECT * INTO player_record FROM players WHERE id = p_player_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found';
    END IF;

    -- Get player owner for real players (not CPU)
    IF player_record.is_cpu IS NOT TRUE THEN
        player_owner_id := player_record.user_id;
    ELSE
        player_owner_id := NULL;
    END IF;

    -- Check if player is already registered
    IF tournament_record."registeredPlayers" IS NOT NULL AND array_length(tournament_record."registeredPlayers", 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM unnest(tournament_record."registeredPlayers") AS elem
            WHERE (elem->>'playerId')::uuid = p_player_id
        ) THEN
            RAISE EXCEPTION 'Player is already registered for this tournament';
        END IF;
    END IF;

    -- Add player to tournament registration (NO RESOURCE DEDUCTION for admin registrations)
    UPDATE tournament_list 
    SET 
        "registeredPlayers" = COALESCE("registeredPlayers", ARRAY[]::json[]) || 
            ARRAY[json_build_object(
                'playerId', p_player_id,
                'playerName', player_record.name,
                'clubId', CASE WHEN player_record.is_cpu THEN 'cpu-club' ELSE 'user-club-' || player_owner_id::text END,
                'clubName', CASE WHEN player_record.is_cpu THEN 'CPU Club' ELSE 'User Club' END,
                'registered', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'registeredBy', 'admin'
            )::json],
        "current_Participants" = COALESCE("current_Participants", 0) + 1
    WHERE id = p_tournament_id;

    -- Create user tournament registration record if it's a real player
    IF player_owner_id IS NOT NULL THEN
        INSERT INTO user_tournament_registrations (
            tournament_id,
            user_id,
            player_id,
            status
        ) VALUES (
            p_tournament_id,
            player_owner_id,
            p_player_id,
            'active'
        ) ON CONFLICT (tournament_id, player_id) DO NOTHING;
    END IF;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Admin registration failed: %', SQLERRM;
END;
$$;

-- Enhanced function to distribute tournament rewards with actual resource credits
CREATE OR REPLACE FUNCTION distribute_tournament_rewards(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_record tournament_list%ROWTYPE;
    final_match record;
    winner_id uuid;
    second_place_id uuid;
    third_place_ids uuid[];
    player_owner_id uuid;
    prize_pool jsonb;
    resource_type text;
    resource_amount integer;
    result jsonb := '{"success": true, "distributed": []}'::jsonb;
    distributed_rewards jsonb := '[]'::jsonb;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record FROM tournament_list WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    prize_pool := tournament_record."prizePool";

    -- Find final match (highest round level)
    SELECT m.*, r.level INTO final_match
    FROM match m
    JOIN round r ON m.round_id = r.id
    WHERE r.tournament_id = p_tournament_id
    ORDER BY r.level DESC, m.match_id
    LIMIT 1;

    IF final_match.completed AND final_match.winner IS NOT NULL THEN
        winner_id := final_match.winner;
        -- Second place is the loser of final match
        second_place_id := CASE 
            WHEN final_match.players[1] = winner_id THEN final_match.players[2]
            ELSE final_match.players[1]
        END;

        -- Distribute first place rewards
        IF prize_pool ? 'first' THEN
            -- Get winner's owner (skip if CPU player)
            SELECT user_id INTO player_owner_id FROM players WHERE id = winner_id AND is_cpu IS NOT TRUE;
            
            IF player_owner_id IS NOT NULL THEN
                FOR resource_type, resource_amount IN SELECT * FROM jsonb_each_text(prize_pool->'first')
                LOOP
                    IF resource_amount::integer > 0 THEN
                        INSERT INTO resource_transactions (
                            user_id, 
                            resource_type, 
                            amount, 
                            source, 
                            source_id
                        ) VALUES (
                            player_owner_id,
                            resource_type,
                            resource_amount::integer,
                            'tournament_reward',
                            p_tournament_id
                        );
                    END IF;
                END LOOP;
                
                distributed_rewards := distributed_rewards || jsonb_build_object(
                    'playerId', winner_id,
                    'userId', player_owner_id,
                    'position', 1,
                    'rewards', prize_pool->'first'
                );
            END IF;
        END IF;

        -- Distribute second place rewards
        IF prize_pool ? 'second' THEN
            SELECT user_id INTO player_owner_id FROM players WHERE id = second_place_id AND is_cpu IS NOT TRUE;
            
            IF player_owner_id IS NOT NULL THEN
                FOR resource_type, resource_amount IN SELECT * FROM jsonb_each_text(prize_pool->'second')
                LOOP
                    IF resource_amount::integer > 0 THEN
                        INSERT INTO resource_transactions (
                            user_id, 
                            resource_type, 
                            amount, 
                            source, 
                            source_id
                        ) VALUES (
                            player_owner_id,
                            resource_type,
                            resource_amount::integer,
                            'tournament_reward',
                            p_tournament_id
                        );
                    END IF;
                END LOOP;
                
                distributed_rewards := distributed_rewards || jsonb_build_object(
                    'playerId', second_place_id,
                    'userId', player_owner_id,
                    'position', 2,
                    'rewards', prize_pool->'second'
                );
            END IF;
        END IF;

        -- Update registration records
        UPDATE user_tournament_registrations 
        SET 
            status = 'winner',
            final_position = 1,
            rewards_distributed = true
        WHERE tournament_id = p_tournament_id AND player_id = winner_id;

        UPDATE user_tournament_registrations 
        SET 
            final_position = 2,
            rewards_distributed = true
        WHERE tournament_id = p_tournament_id AND player_id = second_place_id;
    END IF;

    -- Refresh materialized view to update user balances
    REFRESH MATERIALIZED VIEW user_resource_balances;

    result := jsonb_set(result, '{distributed}', distributed_rewards);
    RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_register_player_for_tournament TO authenticated;


