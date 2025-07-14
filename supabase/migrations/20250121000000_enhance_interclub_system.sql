-- Migration to enhance interclub system
-- Add tier support and other missing features

-- Add tier column to interclub_seasons if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'interclub_seasons' AND column_name = 'tier') THEN
        ALTER TABLE interclub_seasons ADD COLUMN tier text DEFAULT 'departmental' 
        CHECK (tier IN ('departmental', 'regional', 'national', 'top12'));
    END IF;
END $$;

-- Add week_schedule column to interclub_seasons if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'interclub_seasons' AND column_name = 'week_schedule') THEN
        ALTER TABLE interclub_seasons ADD COLUMN week_schedule jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Add matchday_number column to interclub_matches if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'interclub_matches' AND column_name = 'matchday_number') THEN
        ALTER TABLE interclub_matches ADD COLUMN matchday_number integer;
    END IF;
END $$;

-- Create individual_interclub_matches table for detailed match tracking
CREATE TABLE IF NOT EXISTS individual_interclub_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id uuid REFERENCES interclub_matches(id) ON DELETE CASCADE NOT NULL,
    match_type text NOT NULL CHECK (match_type IN ('mens_singles', 'womens_singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles')),
    match_number integer NOT NULL CHECK (match_number >= 1 AND match_number <= 5),
    home_players jsonb NOT NULL,
    away_players jsonb NOT NULL,
    status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
    result jsonb,
    score text,
    winner_side text CHECK (winner_side IN ('home', 'away')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(encounter_id, match_number)
);

-- Create interclub_lineups table for structured lineup management
CREATE TABLE IF NOT EXISTS interclub_lineups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id uuid REFERENCES interclub_matches(id) ON DELETE CASCADE NOT NULL,
    team_id uuid NOT NULL,
    team_type text DEFAULT 'user' CHECK (team_type IN ('user', 'cpu')),
    side text NOT NULL CHECK (side IN ('home', 'away')),
    lineup jsonb NOT NULL,
    submitted_by uuid REFERENCES auth.users(id),
    submitted_at timestamptz DEFAULT now(),
    is_auto_generated boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(encounter_id, side)
);

-- Create interclub_season_history for tracking user progression
CREATE TABLE IF NOT EXISTS interclub_season_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    season_id uuid REFERENCES interclub_seasons(id) ON DELETE CASCADE NOT NULL,
    tier text NOT NULL,
    final_position integer,
    qualified_for_next_tier boolean DEFAULT false,
    total_encounters integer DEFAULT 0,
    encounters_won integer DEFAULT 0,
    encounters_lost integer DEFAULT 0,
    individual_matches_won integer DEFAULT 0,
    individual_matches_lost integer DEFAULT 0,
    points integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, season_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_individual_interclub_matches_encounter_id ON individual_interclub_matches(encounter_id);
CREATE INDEX IF NOT EXISTS idx_individual_interclub_matches_match_type ON individual_interclub_matches(match_type);
CREATE INDEX IF NOT EXISTS idx_individual_interclub_matches_status ON individual_interclub_matches(status);

CREATE INDEX IF NOT EXISTS idx_interclub_lineups_encounter_id ON interclub_lineups(encounter_id);
CREATE INDEX IF NOT EXISTS idx_interclub_lineups_team_id ON interclub_lineups(team_id);
CREATE INDEX IF NOT EXISTS idx_interclub_lineups_side ON interclub_lineups(side);

CREATE INDEX IF NOT EXISTS idx_interclub_season_history_user_id ON interclub_season_history(user_id);
CREATE INDEX IF NOT EXISTS idx_interclub_season_history_season_id ON interclub_season_history(season_id);
CREATE INDEX IF NOT EXISTS idx_interclub_season_history_tier ON interclub_season_history(tier);

CREATE INDEX IF NOT EXISTS idx_interclub_seasons_tier ON interclub_seasons(tier);
CREATE INDEX IF NOT EXISTS idx_interclub_matches_matchday_number ON interclub_matches(matchday_number);

-- Disable RLS for new tables (consistent with existing setup)
ALTER TABLE individual_interclub_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_lineups DISABLE ROW LEVEL SECURITY;
ALTER TABLE interclub_season_history DISABLE ROW LEVEL SECURITY;

-- Add comment for documentation
COMMENT ON TABLE individual_interclub_matches IS 'Detailed tracking of individual matches within interclub encounters (5 matches per encounter)';
COMMENT ON TABLE interclub_lineups IS 'Structured lineup management for interclub encounters';
COMMENT ON TABLE interclub_season_history IS 'Historical data for user progression through interclub tiers';

-- Update existing data (if any) with default tier
UPDATE interclub_seasons SET tier = 'departmental' WHERE tier IS NULL; 