-- Create missing tables for admin functionality

-- CPU teams table with updated structure
DROP TABLE IF EXISTS cpu_teams CASCADE;
CREATE TABLE cpu_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES interclub_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    skill_level text DEFAULT 'intermediate' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert', 'master')),
    player_count integer DEFAULT 6,
    gender_balance text DEFAULT 'mixed' CHECK (gender_balance IN ('mixed', 'male', 'female')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Player team assignments table (for linking players to CPU teams)
CREATE TABLE IF NOT EXISTS player_team_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid REFERENCES players(id) ON DELETE CASCADE,
    team_id uuid REFERENCES cpu_teams(id) ON DELETE CASCADE,
    assigned_at timestamptz DEFAULT now(),
    UNIQUE(player_id, team_id)
);

-- Update players table to add is_cpu flag if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'is_cpu') THEN
        ALTER TABLE players ADD COLUMN is_cpu boolean DEFAULT false;
    END IF;
END $$;

-- Interclub seasons table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS interclub_seasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    registration_deadline date NOT NULL,
    max_teams integer DEFAULT 16,
    entry_fee numeric DEFAULT 0,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'registration_open', 'registration_closed', 'active', 'completed')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Interclub groups table
CREATE TABLE IF NOT EXISTS interclub_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id uuid REFERENCES interclub_seasons(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Interclub teams table
CREATE TABLE IF NOT EXISTS interclub_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES interclub_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    club_name text,
    captain_name text,
    players_count integer DEFAULT 0,
    is_cpu boolean DEFAULT false,
    registration_status text DEFAULT 'pending' CHECK (registration_status IN ('pending', 'approved', 'rejected')),
    registration_date timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Interclub registrations table (updated structure)
DROP TABLE IF EXISTS interclub_registrations CASCADE;
CREATE TABLE interclub_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id uuid REFERENCES interclub_seasons(id) ON DELETE CASCADE,
    team_name text NOT NULL,
    club_name text NOT NULL,
    captain_name text NOT NULL,
    captain_email text NOT NULL,
    players jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    registration_date timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create admin_users view for easier querying (since we need user info)
CREATE OR REPLACE VIEW admin_users_view AS
SELECT 
    au.*,
    u.email,
    u.email_confirmed_at IS NOT NULL as email_verified,
    u.last_sign_in_at as last_login,
    u.created_at as user_created_at,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as full_name,
    u.raw_user_meta_data->>'username' as username,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    false as is_banned, -- Default to false, can be added later
    0 as login_count -- Default to 0, can be tracked later
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cpu_teams_skill_level ON cpu_teams(skill_level);
CREATE INDEX IF NOT EXISTS idx_cpu_teams_active ON cpu_teams(is_active);
CREATE INDEX IF NOT EXISTS idx_player_team_assignments_player_id ON player_team_assignments(player_id);
CREATE INDEX IF NOT EXISTS idx_player_team_assignments_team_id ON player_team_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_players_is_cpu ON players(is_cpu);
CREATE INDEX IF NOT EXISTS idx_interclub_seasons_status ON interclub_seasons(status);
CREATE INDEX IF NOT EXISTS idx_interclub_registrations_season_id ON interclub_registrations(season_id);
CREATE INDEX IF NOT EXISTS idx_interclub_registrations_status ON interclub_registrations(status);

-- Enable RLS on new tables
ALTER TABLE cpu_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_registrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for CPU teams
CREATE POLICY "Admin users can manage cpu_teams" ON cpu_teams FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can view active cpu_teams" ON cpu_teams FOR SELECT TO authenticated USING (is_active = true);

-- Create RLS policies for player team assignments
CREATE POLICY "Admin users can manage player_team_assignments" ON player_team_assignments FOR ALL TO authenticated USING (is_admin());

-- Create RLS policies for interclub seasons
CREATE POLICY "Admin users can manage interclub_seasons" ON interclub_seasons FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can view interclub_seasons" ON interclub_seasons FOR SELECT TO authenticated USING (true);

-- Create RLS policies for interclub groups
CREATE POLICY "Admin users can manage interclub_groups" ON interclub_groups FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can view interclub_groups" ON interclub_groups FOR SELECT TO authenticated USING (true);

-- Create RLS policies for interclub teams
CREATE POLICY "Admin users can manage interclub_teams" ON interclub_teams FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can view interclub_teams" ON interclub_teams FOR SELECT TO authenticated USING (true);

-- Create RLS policies for interclub registrations
CREATE POLICY "Admin users can manage interclub_registrations" ON interclub_registrations FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can view their own registrations" ON interclub_registrations FOR SELECT TO authenticated USING (true);

-- Update triggers for updated_at columns
CREATE TRIGGER update_cpu_teams_updated_at BEFORE UPDATE ON cpu_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interclub_seasons_updated_at BEFORE UPDATE ON interclub_seasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interclub_registrations_updated_at BEFORE UPDATE ON interclub_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate CPU players for a team
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
BEGIN
    -- Only allow admins to call this function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

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
            '00000000-0000-0000-0000-000000000000', -- Dummy user_id for CPU players
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

        -- Assign player to team
        INSERT INTO player_team_assignments (player_id, team_id)
        VALUES (new_player_id, team_id);
    END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_cpu_players_for_team TO authenticated; 