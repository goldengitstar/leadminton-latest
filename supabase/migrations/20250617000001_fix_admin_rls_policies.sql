-- Fix Admin RLS Policies - Resolve Infinite Recursion
-- This migration fixes the circular dependency in admin_users RLS policies

-- Drop the problematic policies first
DROP POLICY IF EXISTS "Admin users can manage admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can manage cpu_teams" ON cpu_teams;
DROP POLICY IF EXISTS "Admin users can manage interclub_seasons" ON interclub_seasons;
DROP POLICY IF EXISTS "Users can manage their own registrations" ON interclub_registrations;
DROP POLICY IF EXISTS "Users can view their group matches" ON interclub_matches;
DROP POLICY IF EXISTS "Admin users can manage matches" ON interclub_matches;
DROP POLICY IF EXISTS "Admin users can manage tournament settings" ON tournament_admin_settings;
DROP POLICY IF EXISTS "Admin users can view activity logs" ON admin_activity_logs;

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;

-- Recreate policies using the secure function
-- Admin users table - allow admins to manage themselves and other admins
CREATE POLICY "Admins can read admin_users" ON admin_users FOR SELECT TO authenticated USING (
    is_admin()
);

CREATE POLICY "Admins can insert admin_users" ON admin_users FOR INSERT TO authenticated WITH CHECK (
    is_admin()
);

CREATE POLICY "Admins can update admin_users" ON admin_users FOR UPDATE TO authenticated USING (
    is_admin()
) WITH CHECK (
    is_admin()
);

CREATE POLICY "Admins can delete admin_users" ON admin_users FOR DELETE TO authenticated USING (
    is_admin()
);

-- CPU teams - admin only
CREATE POLICY "Admin users can manage cpu_teams" ON cpu_teams FOR ALL TO authenticated USING (
    is_admin()
);

-- Interclub seasons - admin only  
CREATE POLICY "Admin users can manage interclub_seasons" ON interclub_seasons FOR ALL TO authenticated USING (
    is_admin()
);

-- Interclub registrations - users can manage their own, admins can manage all
CREATE POLICY "Users can manage their own registrations" ON interclub_registrations FOR ALL TO authenticated USING (
    user_id = auth.uid() OR is_admin()
);

-- Interclub matches - users can view their matches, admins can manage all
CREATE POLICY "Users can view their group matches" ON interclub_matches FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM interclub_registrations ir 
        WHERE ir.user_id = auth.uid() 
        AND (ir.id::text = home_team_id::text OR ir.id::text = away_team_id::text)
    ) OR is_admin()
);

CREATE POLICY "Admin users can manage matches" ON interclub_matches FOR INSERT TO authenticated WITH CHECK (
    is_admin()
);

CREATE POLICY "Admin users can update matches" ON interclub_matches FOR UPDATE TO authenticated USING (
    is_admin()
) WITH CHECK (
    is_admin()
);

CREATE POLICY "Admin users can delete matches" ON interclub_matches FOR DELETE TO authenticated USING (
    is_admin()
);

-- Tournament admin settings - admin only
CREATE POLICY "Admin users can manage tournament settings" ON tournament_admin_settings FOR ALL TO authenticated USING (
    is_admin()
);

-- Activity logs - admin only
CREATE POLICY "Admin users can view activity logs" ON admin_activity_logs FOR SELECT TO authenticated USING (
    is_admin()
);

-- Comment: The key fix here is using a SECURITY DEFINER function that bypasses RLS
-- to check admin status, preventing the circular dependency that caused infinite recursion.

-- Add policy for CPU players creation
-- Allow admins to create CPU players with dummy user_id
CREATE POLICY "Admin users can create cpu players" ON players FOR INSERT TO authenticated WITH CHECK (
    (is_cpu = true AND is_admin()) OR 
    (is_cpu = false AND user_id = auth.uid()) OR
    (is_cpu IS NULL AND user_id = auth.uid())
);

-- Allow admins to manage CPU players
CREATE POLICY "Admin users can manage cpu players" ON players FOR UPDATE TO authenticated USING (
    (is_cpu = true AND is_admin()) OR 
    (is_cpu = false AND user_id = auth.uid()) OR
    (is_cpu IS NULL AND user_id = auth.uid())
) WITH CHECK (
    (is_cpu = true AND is_admin()) OR 
    (is_cpu = false AND user_id = auth.uid()) OR
    (is_cpu IS NULL AND user_id = auth.uid())
);

-- Allow admins to delete CPU players
CREATE POLICY "Admin users can delete cpu players" ON players FOR DELETE TO authenticated USING (
    (is_cpu = true AND is_admin()) OR 
    (is_cpu = false AND user_id = auth.uid()) OR
    (is_cpu IS NULL AND user_id = auth.uid())
);

-- Allow viewing CPU players for all authenticated users (for tournaments, etc.)
CREATE POLICY "Users can view cpu players" ON players FOR SELECT TO authenticated USING (
          is_cpu = true OR user_id = auth.uid() OR is_admin()
  );

-- Add RLS policies for tournament_list table
CREATE POLICY "Admin users can manage tournaments" ON tournament_list FOR ALL TO authenticated USING (
    is_admin()
) WITH CHECK (
    is_admin()
);

CREATE POLICY "Users can view tournaments" ON tournament_list FOR SELECT TO authenticated USING (true);

-- Add RLS policies for round table
CREATE POLICY "Admin users can manage rounds" ON round FOR ALL TO authenticated USING (
    is_admin()
) WITH CHECK (
    is_admin()
);

CREATE POLICY "Users can view rounds" ON round FOR SELECT TO authenticated USING (true);

-- Add RLS policies for match table
CREATE POLICY "Admin users can manage matches" ON match FOR ALL TO authenticated USING (
    is_admin()
) WITH CHECK (
    is_admin()
);

CREATE POLICY "Users can view matches" ON match FOR SELECT TO authenticated USING (true); 




-- Migration: Tournament CPU Player Assignment Function
-- Adds function to assign CPU players to tournaments

-- Function to assign CPU players to a tournament
CREATE OR REPLACE FUNCTION assign_cpu_players_to_tournament(
    tournament_id uuid,
    cpu_player_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    player_id uuid;
    result jsonb := '{"success": true, "assigned_count": 0}'::jsonb;
    assigned_count integer := 0;
BEGIN
    -- Only allow admins to call this function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Check if tournament exists
    IF NOT EXISTS (SELECT 1 FROM tournament_list WHERE id = tournament_id) THEN
        RAISE EXCEPTION 'Tournament not found.';
    END IF;

    -- Assign each CPU player to the tournament
    FOREACH player_id IN ARRAY cpu_player_ids
    LOOP
        -- Verify the player is a CPU player
        IF EXISTS (SELECT 1 FROM players WHERE id = player_id AND is_cpu = true) THEN
            -- Add to tournament registrations (you might need to adjust this based on your registration system)
            -- For now, we'll update the tournament's registeredPlayers field
            UPDATE tournament_list 
            SET "registeredPlayers" = COALESCE("registeredPlayers", ARRAY[]::json[]) || 
                ARRAY[json_build_object(
                    'playerId', player_id,
                    'playerName', (SELECT name FROM players WHERE id = player_id),
                    'clubId', 'cpu-club',
                    'clubName', 'CPU Club',
                    'registered', extract(epoch from now()) * 1000
                )::json]
            WHERE id = tournament_id;
            
            assigned_count := assigned_count + 1;
        END IF;
    END LOOP;

    -- Update participant count once at the end for efficiency
    IF assigned_count > 0 THEN
        UPDATE tournament_list 
        SET "current_Participants" = COALESCE("current_Participants", 0) + assigned_count
        WHERE id = tournament_id;
    END IF;

    -- Update result
    result := jsonb_set(result, '{assigned_count}', to_jsonb(assigned_count));
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to assign CPU players: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_cpu_players_to_tournament TO authenticated; 