-- ==================================================
-- LEADMINTON GAME - ORDERED TABLE CREATION
-- ==================================================
-- Drop tables in reverse dependency order, then create in correct order

-- ==================================================
-- DROP TABLES (in reverse dependency order)
-- ==================================================

-- Drop tables that depend on other tables first
DROP TABLE IF EXISTS public.match CASCADE;
DROP TABLE IF EXISTS public.round CASCADE;
DROP TABLE IF EXISTS public.player_training_history CASCADE;
DROP TABLE IF EXISTS public.player_equipment_history CASCADE;
DROP TABLE IF EXISTS public.player_equipment CASCADE;
DROP TABLE IF EXISTS public.player_strategy CASCADE;
DROP TABLE IF EXISTS public.player_levels CASCADE;
DROP TABLE IF EXISTS public.player_stats CASCADE;
DROP TABLE IF EXISTS public.player_play_history CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.managers CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;
DROP TABLE IF EXISTS public.resource_transactions CASCADE;
DROP TABLE IF EXISTS public.tournament_list CASCADE;
DROP TABLE IF EXISTS public.season_list CASCADE;

-- ==================================================
-- CREATE ENUM TYPES
-- ==================================================

-- Create gender enum type (with error handling)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
        CREATE TYPE gender_enum AS ENUM ('male', 'female', 'non_binary', 'other');
    END IF;
END
$$;

-- ==================================================
-- CREATE TABLES (in correct dependency order)
-- ==================================================

-- 1. Independent tables (no foreign key dependencies)
create table public.tournament_list (
  id uuid not null default gen_random_uuid (),
  start_date timestamp with time zone not null,
  end_date timestamp without time zone null,
  tier integer not null,
  status integer null,
  "entryFee" json null,
  "prizePool" json null,
  "min_PlayerLevel" bigint null,
  max_participants bigint null,
  "current_Participants" bigint null,
  name character varying null,
  "registeredPlayers" json[] null,
  constraint tournament_list_pkey primary key (id)
) TABLESPACE pg_default;


create table public.season_list (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  "entryFee" json null,
  "prizePool" json null,
  "groupList" uuid[] null,
  start_date timestamp without time zone null,
  match_days timestamp without time zone [] null,
  type integer null default 0,
  constraint season_list_pkey primary key (id)
) TABLESPACE pg_default;

create table public.player_play_history (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  player1_id uuid null,
  player2_id uuid null,
  result boolean null,
  player1_rank double precision null,
  player2_rank double precision null,
  constraint player_play_history_pkey primary key (id)
) TABLESPACE pg_default;

-- 2. Tables that depend on auth.users
create table public.players (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  name character varying not null,
  level integer null default 1,
  max_level integer not null,
  created_at timestamp with time zone null default now(),
  rank double precision null,
  gender gender_enum not null,
  rarity text null,
  training json null,
  equipment json null,
  injuries json null,
  constraint players_pkey primary key (id),
  constraint players_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint valid_level check (
    (
      (level >= 1)
      and (level <= max_level)
    )
  )
) TABLESPACE pg_default;

create index IF not exists players_user_id_idx on public.players using btree (user_id) TABLESPACE pg_default;

create index IF not exists active_players_idx on public.players using btree (user_id) TABLESPACE pg_default
where
  (level < max_level);


create table public.facilities (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  name character varying not null,
  type character varying not null,
  level integer null default 1,
  production_rate integer null default 0,
  created_at timestamp with time zone null default now(),
  max_players integer null default 0,
  upgrade_cost json null,
  upgrading json null,
  resource_type character varying null,
  constraint facilities_pkey primary key (id),
  constraint facilities_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint valid_facility_type check (
    (
      (type)::text = any (
        array[
          'shuttlecock-machine'::text,
          'canteen'::text,
          'sponsors'::text,
          'training-center'::text
        ]
      )
    )
  ),
  constraint valid_level check ((level >= 1)),
  constraint valid_production_rate check ((production_rate >= 0))
) TABLESPACE pg_default;

create index IF not exists facilities_user_id_idx on public.facilities using btree (user_id) TABLESPACE pg_default;

create index IF not exists active_facilities_idx on public.facilities using btree (user_id, type) TABLESPACE pg_default
where
  (level < 10);



create table public.managers (
  id uuid not null default gen_random_uuid (),
  user_id uuid null default auth.uid (),
  name character varying null,
  facility_type character varying null,
  production_bonus real null default '0'::real,
  active boolean null default false,
  image_url character varying null,
  cost integer null default 0,
  created_at timestamp with time zone not null default now(),
  purchasing json null,
  constraint managers_pkey primary key (id),
  constraint managers_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;



------------- check this tables creation order --------------
create table public.resource_transactions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null default auth.uid (),
  resource_type text not null,
  amount integer not null,
  source text not null,
  source_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint resource_transactions_pkey primary key (id),
  constraint resource_transactions_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint valid_resource_type check (
    (
      resource_type = any (
        array[
          'shuttlecocks'::text,
          'meals'::text,
          'coins'::text,
          'diamonds'::text
        ]
      )
    )
  ),
  constraint valid_source check (
    (
      source = any (
        array[
          'facility_production'::text,
          'training_cost'::text,
          'upgrade_cost'::text,
          'equipment_purchase'::text,
          'tournament_reward'::text,
          'shop_purchase'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

-- 3. Tables that depend on players
create table public.player_stats (
  id uuid not null default gen_random_uuid (),
  player_id uuid not null,
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
  created_at timestamp with time zone null default now(),
  constraint player_stats_pkey primary key (id),
  constraint player_stats_player_id_key unique (player_id),
  constraint player_stats_player_id_fkey foreign KEY (player_id) references players (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists player_stats_player_id_idx on public.player_stats using btree (player_id) TABLESPACE pg_default;


create table public.player_levels (
  id uuid not null default gen_random_uuid (),
  player_id uuid not null,
  endurance integer null default 0,
  strength integer null default 0,
  agility integer null default 0,
  speed integer null default 0,
  explosiveness integer null default 0,
  injury_prevention integer null default 0,
  smash integer null default 0,
  defense integer null default 0,
  serve integer null default 0,
  stick integer null default 0,
  slice integer null default 0,
  drop integer null default 0,
  created_at timestamp with time zone null default now(),
  constraint player_levels_pkey primary key (id),
  constraint player_levels_player_id_key unique (player_id),
  constraint player_levels_player_id_fkey foreign KEY (player_id) references players (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists player_levels_player_id_idx on public.player_levels using btree (player_id) TABLESPACE pg_default;



create table public.player_strategy (
  id uuid not null default gen_random_uuid (),
  player_id uuid not null,
  physical_commitment integer null default 5,
  play_style integer null default 5,
  movement_speed integer null default 5,
  fatigue_management integer null default 5,
  rally_consistency integer null default 5,
  risk_taking integer null default 5,
  attack integer null default 5,
  soft_attack integer null default 5,
  serving integer null default 5,
  court_defense integer null default 5,
  mental_toughness integer null default 5,
  self_confidence integer null default 5,
  created_at timestamp with time zone not null default now(),
  constraint player_strategy_pkey primary key (id),
  constraint player_strategy_player_id_key unique (player_id),
  constraint player_strategy_player_id_fkey foreign KEY (player_id) references players (id) on delete CASCADE
) TABLESPACE pg_default;




create table public.player_equipment (
  id uuid not null default gen_random_uuid (),
  player_id uuid not null,
  equipment_type text not null,
  equipment_id text not null,
  created_at timestamp with time zone null default now(),
  constraint player_equipment_pkey primary key (id),
  constraint player_equipment_player_id_fkey foreign KEY (player_id) references players (id) on delete CASCADE,
  constraint valid_equipment_type check (
    (
      equipment_type = any (
        array[
          'shoes'::text,
          'racket'::text,
          'strings'::text,
          'shirt'::text,
          'shorts'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists player_equipment_player_type_idx on public.player_equipment using btree (player_id, equipment_type) TABLESPACE pg_default;


create table public.player_equipment_history (
  id uuid not null default gen_random_uuid (),
  player_id uuid not null,
  equipment_type text not null,
  equipment_id text not null,
  action text not null,
  cost_coins integer null,
  cost_diamonds integer null,
  created_at timestamp with time zone null default now(),
  constraint player_equipment_history_pkey primary key (id),
  constraint player_equipment_history_player_id_fkey foreign KEY (player_id) references players (id) on delete CASCADE,
  constraint valid_action check (
    (
      action = any (
        array['purchase'::text, 'equip'::text, 'unequip'::text]
      )
    )
  ),
  constraint valid_equipment_type check (
    (
      equipment_type = any (
        array[
          'shoes'::text,
          'racket'::text,
          'strings'::text,
          'shirt'::text,
          'shorts'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;


create table public.player_training_history (
  id uuid not null default gen_random_uuid (),
  player_id uuid not null,
  stat text not null,
  old_value integer not null,
  new_value integer not null,
  cost_shuttlecocks integer not null,
  cost_meals integer not null,
  cost_coins integer not null,
  started_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  constraint player_training_history_pkey primary key (id),
  constraint player_training_history_player_id_fkey foreign KEY (player_id) references players (id) on delete CASCADE,
  constraint valid_stat check (
    (
      stat = any (
        array[
          'endurance'::text,
          'strength'::text,
          'agility'::text,
          'speed'::text,
          'explosiveness'::text,
          'injuryPrevention'::text,
          'smash'::text,
          'backhand'::text,
          'serve'::text,
          'stick'::text,
          'slice'::text,
          'drop'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists player_training_history_player_completed_idx on public.player_training_history using btree (player_id, completed_at) TABLESPACE pg_default
where
  (completed_at is null);



-- 4. Tables that depend on tournament_list
create table public.round (
  id uuid not null default gen_random_uuid (),
  tournament_id uuid not null,
  name character varying null,
  level integer not null,
  constraint round_pkey primary key (id),
  constraint round_tournament_id_fkey foreign KEY (tournament_id) references tournament_list (id) on delete CASCADE
) TABLESPACE pg_default;


-- 5. Tables that depend on round
create table public.match (
  round_id uuid not null,
  created_at timestamp with time zone null default now(),
  winner uuid null,
  score character varying null,
  completed boolean null default false,
  "startTime" timestamp with time zone null,
  id character varying null,
  match_id uuid not null default gen_random_uuid (),
  players uuid[] null,
  constraint match_pkey primary key (match_id),
  constraint match_round_id_fkey foreign KEY (round_id) references round(id) on delete CASCADE
) TABLESPACE pg_default;


-- Add materialized view for resource balances
CREATE MATERIALIZED VIEW user_resource_balances AS
SELECT 
  user_id,
  resource_type,
  SUM(amount) as balance
FROM resource_transactions
GROUP BY user_id, resource_type;

CREATE UNIQUE INDEX IF NOT EXISTS user_resource_balances_idx 
  ON user_resource_balances(user_id, resource_type);


-- ==================================================
-- CREATE FUNCTIONS
-- ==================================================

-- Ensure the trigger function exists and has proper permissions
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create initial facilities (4 records)
  INSERT INTO facilities (user_id, name, type, level, production_rate, resource_type, max_players, upgrade_cost)
  VALUES
    (NEW.id, 'Shuttlecock Machine', 'shuttlecock-machine', 1, 1, 'shuttlecocks', 0, '{"coins": 100}'),
    (NEW.id, 'Canteen', 'canteen', 1, 1, 'meals', 0, '{"coins": 150}'),
    (NEW.id, 'Sponsors', 'sponsors', 1, 2, 'coins', 0, '{"coins": 200}'),
    (NEW.id, 'Training Center', 'training-center', 1, 0, null, 2, '{"coins": 300, "shuttlecocks": 50, "meals": 50}');

  -- Create initial managers (3 records)
  INSERT INTO managers (user_id, name, facility_type, production_bonus, active, image_url, cost)
  VALUES
    (NEW.id, 'José', 'shuttlecock-machine', 0.5, false, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', 50),
    (NEW.id, 'Gordon Ramsay', 'canteen', 0.5, false, 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c', 50),
    (NEW.id, 'Ronald Dump', 'sponsors', 0.5, false, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', 50);

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();



-- Create function to refresh resource balances
CREATE OR REPLACE FUNCTION refresh_resource_balances()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_resource_balances;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh balances
CREATE TRIGGER refresh_resource_balances_trigger
  AFTER INSERT ON resource_transactions
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_resource_balances();

  

-- Add function for batch resource updates
CREATE OR REPLACE FUNCTION batch_resource_transactions(
  p_user_id uuid,
  p_transactions jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO resource_transactions (
    user_id,
    resource_type,
    amount,
    source,
    source_id
  )
  SELECT
    p_user_id,
    (tx->>'resource_type')::text,
    (tx->>'amount')::integer,
    (tx->>'source')::text,
    (tx->>'source_id')::uuid
  FROM jsonb_array_elements(p_transactions) AS tx;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Add function for atomic facility updates
CREATE OR REPLACE FUNCTION update_facility(
  p_facility_id uuid,
  p_level integer,
  p_production_rate integer
)
RETURNS void AS $$
BEGIN
  UPDATE facilities 
  SET 
    level = p_level,
    production_rate = p_production_rate
  WHERE id = p_facility_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




-- Add function for updating player rank
CREATE OR REPLACE FUNCTION update_player_rank(player_id uuid)
RETURNS REAL AS $$
DECLARE 
  total_rank REAL;  -- Floating point type
BEGIN
  -- Calculate total rank based on the top 6 highest ranks from the past 90 days
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN rank_value BETWEEN -1 AND 20 THEN 5.0
        WHEN rank_value BETWEEN 20 AND 40 THEN 7.67
        WHEN rank_value BETWEEN 40 AND 70 THEN 12.67
        WHEN rank_value BETWEEN 70 AND 100 THEN 17.67
        WHEN rank_value BETWEEN 100 AND 130 THEN 22.67
        WHEN rank_value BETWEEN 131 AND 160 THEN 27.67
        WHEN rank_value BETWEEN 160 AND 200 THEN 34.33
        WHEN rank_value BETWEEN 200 AND 250 THEN 42.67
        WHEN rank_value BETWEEN 250 AND 300 THEN 51.0
        WHEN rank_value BETWEEN 300 AND 370 THEN 62.67
        WHEN rank_value BETWEEN 370 AND 450 THEN 77.0
        ELSE 93.0  -- Default case for ranks above 450
      END
    ), 0.0) 
  INTO total_rank
  FROM (
    -- Select the top 6 highest rank values of defeated players in the past 90 days
    SELECT 
      CASE 
        WHEN result = TRUE AND player1_id = player_id THEN player2_rank
        WHEN result = FALSE AND player2_id = player_id THEN player1_rank
      END AS rank_value
    FROM player_play_history
    WHERE 
      ((player1_id = player_id AND result = TRUE) 
       OR (player2_id = player_id AND result = FALSE))
      AND created_at >= NOW() - INTERVAL '90 days'  -- Filter past 90 days
    ORDER BY rank_value DESC  -- Get highest 6 ranks
    LIMIT 6
  ) AS top_ranks;

  -- Update the player's rank in the players table
  UPDATE players
  SET rank = total_rank
  WHERE id = player_id;

  -- Return the calculated rank
  RETURN total_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Add function for getting tournaments with rounds and matches
CREATE OR REPLACE FUNCTION get_tournaments_with_rounds_matches()
RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'start_date', t.start_date,
        'end_date', t.end_date,
        'tier', t.tier,
        'status', t.status,
        'entryFee', t."entryFee",
        'prizePool', t."prizePool",
        'min_PlayerLevel', t."min_PlayerLevel",
        'max_participants', t.max_participants,
        'current_Participants', t."current_Participants",
        'name', t.name,
        'registeredPlayers', t."registeredPlayers",
        'round_interval_minutes', t.round_interval_minutes,
        'current_round_level', t.current_round_level,
        'next_round_start_time', t.next_round_start_time,
        'next_round_start_time_ms', EXTRACT(EPOCH FROM t.next_round_start_time) * 1000,
        'rounds', COALESCE(rounds_data.rounds, '[]'::jsonb)
      )
      ORDER BY t.id
    )
    FROM tournament_list t
    LEFT JOIN (
      SELECT 
        r.tournament_id,
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'level', r.level,
            'matches', COALESCE(matches_data.matches, '[]'::jsonb)
          )
          ORDER BY r.level
        ) AS rounds
      FROM round r
      LEFT JOIN (
        SELECT 
          m.round_id,
          jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'round_id', m.round_id,
              'players', 
                CASE 
                  WHEN m.players IS NULL THEN '[null, null]'::jsonb 
                  ELSE to_jsonb(m.players)
                END,
              'winner', m.winner,
              'score', m.score,
              'startTime', m."startTime",
              'completed', m.completed,
              'created_at', m.created_at
            )
            ORDER BY m.id
          ) AS matches
        FROM match m
        GROUP BY m.round_id
      ) matches_data ON matches_data.round_id = r.id
      GROUP BY r.tournament_id
    ) rounds_data ON rounds_data.tournament_id = t.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;





-- ==================================================
-- CREATE INDEXES
-- ==================================================

-- Players indexes
CREATE INDEX IF NOT EXISTS players_user_id_idx ON public.players(user_id);
CREATE INDEX IF NOT EXISTS players_level_idx ON public.players(level);

-- Facilities indexes
CREATE INDEX IF NOT EXISTS facilities_user_id_idx ON public.facilities(user_id);
CREATE INDEX IF NOT EXISTS facilities_type_idx ON public.facilities(type);

-- Resource transactions indexes
CREATE INDEX IF NOT EXISTS resource_transactions_user_id_idx ON public.resource_transactions(user_id);
CREATE INDEX IF NOT EXISTS resource_transactions_type_idx ON public.resource_transactions(resource_type);

-- Player stats indexes
CREATE INDEX IF NOT EXISTS player_stats_player_id_idx ON public.player_stats(player_id);

-- Player levels indexes
CREATE INDEX IF NOT EXISTS player_levels_player_id_idx ON public.player_levels(player_id);

-- Player equipment indexes
CREATE INDEX IF NOT EXISTS player_equipment_player_id_idx ON public.player_equipment(player_id);
CREATE UNIQUE INDEX IF NOT EXISTS player_equipment_player_type_idx ON public.player_equipment(player_id, equipment_type);

-- Tournament and match indexes
CREATE INDEX IF NOT EXISTS tournament_list_start_date_idx ON public.tournament_list(start_date);
CREATE INDEX IF NOT EXISTS round_tournament_id_idx ON public.round(tournament_id);
CREATE INDEX IF NOT EXISTS match_round_id_idx ON public.match(round_id);

-- ==================================================
-- ENABLE ROW LEVEL SECURITY
-- ==================================================

-- Enable RLS on all tables
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_equipment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_training_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_list ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- CREATE RLS POLICIES
-- ==================================================

-- FACILITIES POLICIES
CREATE POLICY "Users can insert their own facilities" ON public.facilities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own facilities" ON public.facilities
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own facilities" ON public.facilities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- MANAGERS POLICIES
CREATE POLICY "Users can insert their own managers" ON public.managers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own managers" ON public.managers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own managers" ON public.managers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- MATCH POLICIES
CREATE POLICY "Enable read access for all users" ON public.match
  FOR SELECT TO authenticated USING (true);

-- PLAYER_EQUIPMENT POLICIES
CREATE POLICY "Users can insert their players' equipment" ON public.player_equipment
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update their players' equipment" ON public.player_equipment
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their players' equipment" ON public.player_equipment
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

-- PLAYER_EQUIPMENT_HISTORY POLICIES
CREATE POLICY "Users can insert their players' equipment history" ON public.player_equipment_history
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their players' equipment history" ON public.player_equipment_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

-- PLAYER_LEVELS POLICIES
CREATE POLICY "Users can insert their players' levels" ON public.player_levels
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update their players' levels" ON public.player_levels
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their players' levels" ON public.player_levels
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

-- PLAYER_PLAY_HISTORY POLICIES
CREATE POLICY "Enable insert for authenticated users only" ON public.player_play_history
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.player_play_history
  FOR SELECT TO authenticated USING (true);

-- PLAYER_STATS POLICIES
CREATE POLICY "Users can insert their players' stats" ON public.player_stats
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update their players' stats" ON public.player_stats
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their players' stats" ON public.player_stats
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

-- PLAYER_STRATEGY POLICIES
CREATE POLICY "Users can insert their players' strategy" ON public.player_strategy
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update their players' strategy" ON public.player_strategy
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their players' strategy" ON public.player_strategy
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

-- PLAYER_TRAINING_HISTORY POLICIES
CREATE POLICY "Users can insert their players' training history" ON public.player_training_history
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their players' training history" ON public.player_training_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND user_id = auth.uid())
  );

-- PLAYERS POLICIES
CREATE POLICY "Users can insert their own players" ON public.players
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own players" ON public.players
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own players" ON public.players
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- RESOURCE_TRANSACTIONS POLICIES
CREATE POLICY "Users can insert their resource transactions" ON public.resource_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their resource transactions" ON public.resource_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ROUND POLICIES
CREATE POLICY "Enable read access for all users" ON public.round
  FOR SELECT TO authenticated USING (true);

-- SEASON_LIST POLICIES
CREATE POLICY "Enable read access for all users" ON public.season_list
  FOR SELECT TO authenticated USING (true);

-- TOURNAMENT_LIST POLICIES
CREATE POLICY "Enable read access for all users" ON public.tournament_list
  FOR SELECT TO authenticated USING (true);


-- Migration: Fix Resource Transaction Constraint
-- Adds tournament_registration to valid_source constraint

-- Drop the existing constraint
ALTER TABLE resource_transactions DROP CONSTRAINT valid_source;

-- Add the updated constraint with tournament_registration
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