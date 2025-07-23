// Interclub system types

export type InterclubTier = 'departmental' | 'regional' | 'national' | 'top12';

export type InterclubSeasonStatus = 'draft' | 'registration_open' | 'registration_closed' | 'active' | 'completed';

export type InterclubRegistrationStatus = 'pending' | 'approved' | 'rejected';

export type InterclubMatchStatus = 'scheduled' | 'lineup_pending' | 'ready' | 'in_progress' | 'completed';

export type InterclubMatchType = 'mens_singles' | 'womens_singles' | 'mens_doubles' | 'womens_doubles' | 'mixed_doubles';

export interface InterclubSeason {
  id: string;
  name: string;
  tier: InterclubTier;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  status: InterclubSeasonStatus;
  groups: Group[];
  max_teams_per_group: number;
  week_schedule: WeekSchedule[];
  entry_fee: {
    coins: number;
    shuttlecocks: number;
    meals: number;
    diamonds:number;
  };
  prize_pool: {
    first: any;
    second: any;
    third: any;
  };
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  season_id: string;
  created_at: string;
  teams: Team[];
}

export interface Team {
  id: string;
  type: string;
  team_name: string;
}

export interface InterclubTeam {
  id: string;
  user_id?: string; // null for CPU teams
  team_name: string;
  players: InterclubPlayer[];
  is_cpu: boolean;
  skill_level?: number; // for CPU teams
}

export interface InterclubPlayer {
  id: string;
  name: string;
  gender: 'male' | 'female';
  level: number;
  rank: number;
  stats: any;
  available: boolean;
}

export interface InterclubRegistration {
  id: string;
  season_id: string;
  user_id: string;
  team_name: string;
  players: InterclubPlayer[];
  status: InterclubRegistrationStatus;
  group_assignment?: number;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WeekSchedule {
  week_number: number;
  matchdays: MatchdaySchedule[];
}

export interface MatchdaySchedule {
  matchday_number: number;
  date: string;
  matches: InterclubEncounter[];
}

export interface InterclubEncounter {
  id: string;
  season_id: string;
  week_number: number;
  matchday_number: number;
  home_team_id:any;
  away_team_id:any;
  group_number: number;
  home_team: InterclubTeam;
  away_team: InterclubTeam;
  match_date: string;
  status: InterclubMatchStatus;
  home_lineup?: InterclubLineup;
  away_lineup?: InterclubLineup;
  matches: IndividualMatch[];
  final_score?: string; // e.g., "3-2"
  winner_team_id?: string;
  created_at: string;
  updated_at: string;
}

export interface InterclubLineup {
  encounter_id: string;
  team_id: string;
  submitted_by: string;
  submitted_at: string;
  lineup: {
    mens_singles: InterclubPlayer;
    womens_singles: InterclubPlayer;
    mens_doubles: [InterclubPlayer, InterclubPlayer];
    womens_doubles: [InterclubPlayer, InterclubPlayer];
    mixed_doubles: [InterclubPlayer, InterclubPlayer]; // [male, female]
  };
  is_auto_generated: boolean;
}

export interface IndividualMatch {
  id: string;
  encounter_id: string;
  match_type: InterclubMatchType;
  match_number: number; // 1-5
  home_players: InterclubPlayer[];
  away_players: InterclubPlayer[];
  status: 'scheduled' | 'in_progress' | 'completed';
  result?: MatchResult;
  score?: string;
  winner_side?: 'home' | 'away';
}

export interface MatchResult {
  sets: SetResult[];
  final_score: string;
  winner: 'home' | 'away';
  match_duration: number;
  match_data: any;
}

export interface SetResult {
  home_score: number;
  away_score: number;
  winner: 'home' | 'away';
}

export interface GroupStanding {
  team_id: string;
  team_name: string;
  club_name: string;
  is_cpu: boolean;
  position: number;
  matches_played: number;
  encounters_won: number;
  encounters_lost: number;
  individual_matches_won: number;
  individual_matches_lost: number;
  points: number;
  form: ('W' | 'L')[];
}

export interface InterclubRegistrationRequest {
  season_id: string;
  team_name: string;
  team_id: any;
  selected_players: string[]; // player IDs
}

export interface LineupSubmission {
  encounter_id: string;
  lineup: {
    mens_singles: string; // player ID
    womens_singles: string;
    mens_doubles: [string, string];
    womens_doubles: [string, string];
    mixed_doubles: [string, string]; // [male_id, female_id]
  };
}

export interface InterclubResourceRequirements {
  coins: number;
  shuttlecocks: number;
  meals: number;
}

// Constants
export const INTERCLUB_TIERS: InterclubTier[] = ['departmental', 'regional', 'national', 'top12'];

export const MATCHDAYS_BY_TEAMS = {
  5: 8,
  6: 10,
  7: 12,
  8: 14
};

export const MATCH_TYPES: InterclubMatchType[] = [
  'mens_singles',
  'womens_singles', 
  'mens_doubles',
  'womens_doubles',
  'mixed_doubles'
];

export const TIER_REQUIREMENTS: Record<InterclubTier, InterclubResourceRequirements> = {
  departmental: { coins: 1000, shuttlecocks: 100, meals: 50 },
  regional: { coins: 2000, shuttlecocks: 200, meals: 100 },
  national: { coins: 5000, shuttlecocks: 500, meals: 250 },
  top12: { coins: 10000, shuttlecocks: 1000, meals: 500 }
}; 