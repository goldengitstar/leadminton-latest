import { Player, Resources } from './game';

export type TournamentTier = 'local' | 'regional' | 'national' | 'international' | 'premier';
export type TournamentStatus = 'upcoming' | 'ongoing' | 'completed';

export interface Match {
  id: string;
  players: (Player | null)[];
  winner?: Player;
  score?: string;
  startTime?: number;
  completed: boolean;
}

export interface TournamentRound {
  name: string;
  level: number;
  matches: Match[];
}

export interface Tournament {
  id: string;
  name: string;
  tier: TournamentTier;
  status: TournamentStatus;
  start_date: number;
  end_date: number;
  entry_fee: Partial<Resources>;
  prize_pool: {
    first: Partial<Resources>;
    second: Partial<Resources>;
    third: Partial<Resources>;
  };
  min_player_level: number;
  max_participants: number;
  current_participants: number;
  round_interval_minutes?: number;
  next_round_start_time?: number | null;
  registered_players?: any[];
  current_round_level?: number;
  automation_enabled?: boolean;
  rounds?: TournamentRound[];
}


export interface TournamentResult {
  tournamentId: string;
  playerId: string;
  position: number;
  reward: Partial<Resources>;
  date: number;
}