import { ResourceService } from './resourceService';
import { SupabaseClient } from '@supabase/supabase-js';

export class TournamentService {
  private supabase: SupabaseClient;
  private resourceService: ResourceService;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.resourceService = new ResourceService(supabaseClient);
  }

  /**
   * Calculate total match counts from player count
   */
  calcTotalTournamentMatchCount(playerCount: number) {
    return playerCount - 1;
  }

  /**
   * Get tournaments with rounds and matches - JavaScript replacement for get_tournaments_with_rounds_matches() function
   */
  async getTournaments(): Promise<any[]> {
      try {
        // Fetch tournaments plus their rounds and matches in one query
        const { data: tournaments, error } = await this.supabase
          .from('tournament_list')
          .select(`
            *,
            rounds:round (
              id,
              name,
              level,
              matches:match (
                match_id,
                winner,
                score,
                completed,
                "startTime",
                players
              )
            )
          `)
          .order('start_date', { ascending: false });

        if (error) {
          console.error('Error fetching tournaments:', error);
          throw error;
        }

        // Convert numeric tier and status to string equivalents
        const tiers    = ['local', 'regional', 'national', 'international', 'premier'];
        const statuses = ['upcoming', 'ongoing', 'completed'];

        return (tournaments || []).map(t => ({
          ...t,
          tier:   tiers[t.tier]      ?? 'local',
          status: statuses[t.status] ?? 'upcoming',
          rounds: (t.rounds || [])
            .map(r => ({
              id:     r.id,
              name:   r.name,
              level:  r.level,
              matches: (r.matches || [])
                .map(m => ({
                  matchId:   m.match_id,
                  winner:    m.winner,
                  score:     m.score,
                  completed: m.completed,
                  startTime: m.startTime,
                  players:   m.players,
                }))
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
            }))
            .sort((a, b) => a.level - b.level),
        }));
      } catch (err) {
        console.error('Error in fetching tournaments:', err);
        throw err;
      }
    }

  /**
   * Get tournaments with rounds and matches - JavaScript replacement for get_tournaments_with_rounds_matches() function
   */
  async getTournamentById(tournamentId: string): Promise<any> {
    try {
      const { data: tournament, error: tournamentsError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentsError) {
        console.error('Error fetching tournaments:', tournamentsError);
        throw tournamentsError;
      }

      // Convert numeric tier and status to string equivalents for frontend compatibility
      const tiers = ['local', 'regional', 'national', 'international', 'premier'];
      const statuses = ['upcoming', 'ongoing', 'completed'];

      return {
        ...tournament,
        tier: tiers[tournament.tier] || 'local',
        status: statuses[tournament.status] || 'upcoming'
      } as any;
    } catch (error) {
      console.error('[getTournamentById] Error in fetching tournaments:', error);
      throw error;
    }
  }

  /**
   * Get tournaments with rounds and matches - JavaScript replacement for get_tournaments_with_rounds_matches() function
   */
  async getTournamentWithMatches(tournamentId: string): Promise<any> {
    try {
      console.log('[getTournamentWithMatches] tournamentId', tournamentId);
      const { data: tournament, error: tournamentError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) {
        console.error('[getTournamentWithMatches] Error fetching tournaments:', tournamentError);
        throw tournamentError;
      }

      console.log('[getTournamentWithMatches]', tournament);

      // Get matches for this round
      const { data: matches, error: matchesError } = await this.supabase
        .from('match')
        .select('*')
        .eq('tournament_id', tournament.id);

      if (matchesError) {
        console.error('[getTournamentWithMatches] Error fetching matches:', matchesError);
        throw matchesError;
      }

      const playerIds = tournament.registered_players.map((player: any) => player.player_id);

      const { data: players, error: playersError } = await this.supabase
        .from('players')
        .select('id, name, level, is_cpu')
        .in('id', playerIds);

      if (playersError) {
        console.error('[getTournamentWithMatches] Error fetching players:', playersError);
        throw playersError;
      }

      const maxRoundLevel = Math.max(...matches.map((match: any) => match.round_level));

      console.log('tournament.registered_players', tournament.registered_players);
      const roundsWithMatches = [];
      for (let i = 1; i <= maxRoundLevel; i++) {
        const matchesForRound = matches.filter((match: any) => match.round_level === i).map((match: any) =>{
          return {
            ...match,
            player1_name: players.find((player: any) => player.id === match.player1_id)?.name,
            player1_level: players.find((player: any) => player.id === match.player1_id)?.level,
            player1_is_cpu: players.find((player: any) => player.id === match.player1_id)?.is_cpu,
            player2_name: players.find((player: any) => player.id === match.player2_id)?.name,
            player2_level: players.find((player: any) => player.id === match.player2_id)?.level,
            player2_is_cpu: players.find((player: any) => player.id === match.player2_id)?.is_cpu,
          }
        });
        roundsWithMatches.push({
          round_level: i,
          round_name: `Round ${i}`,
          matches: matchesForRound
        });
      }

      // Convert numeric tier and status to string equivalents for frontend compatibility
      const tiers = ['local', 'regional', 'national', 'international', 'premier'];
      const statuses = ['upcoming', 'ongoing', 'completed'];

      return {
        ...tournament,
        tier: tiers[tournament.tier] || 'local',
        status: statuses[tournament.status] || 'upcoming',
        rounds: roundsWithMatches
      };
    } catch (error) {
      throw error;
    }
  }


  /**
   * Get tournaments with rounds and matches - JavaScript replacement for get_tournaments_with_rounds_matches() function
   */
  async getTournamentsWithMatches(): Promise<any[]> {
    try {
      const { data: tournaments, error: tournamentsError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .order('start_date', { ascending: false });

      if (tournamentsError) {
        console.error('Error fetching tournaments:', tournamentsError);
        return [];
      }

      const tournamentsWithRounds: any[] = [];
      
      // Convert numeric tier and status to string equivalents for frontend compatibility
      const tiers = ['local', 'regional', 'national', 'international', 'premier'];
      const statuses = ['upcoming', 'ongoing', 'completed'];

      for (const tournament of tournaments || []) {
        // Get rounds for this tournament
         // Get matches for this round
        const { data: matches, error: matchesError } = await this.supabase
          .from('match')
          .select('*')
          .eq('tournament_id', tournament.id);

        if (matchesError) {
          console.error('Error fetching matches:', matchesError);
          throw matchesError;
        }

        const maxRoundLevel = Math.max(...matches.map((match: any) => match.round_level));

        const roundsWithMatches = [];
        for (let i = 1; i <= maxRoundLevel; i++) {
          const matchesForRound = matches.filter((match: any) => match.round_level === i);
          roundsWithMatches.push({
            round_level: i,
            round_name: `Round ${i}`,
            matches: matchesForRound
          });
        }

        tournamentsWithRounds.push({
          ...tournament,
          tier: tiers[tournament.tier] || 'local',
          status: statuses[tournament.status] || 'upcoming',
          rounds: roundsWithMatches
        });
      }

      return tournamentsWithRounds;
    } catch (error) {
      console.error('Error in getTournamentsWithRoundsMatches:', error);
      return [];
    }
  }

  /**
   * Get user tournament registrations - JavaScript replacement for get_user_tournament_registrations() function
   */
  async getUserTournamentRegistrations(userId: string) {
    try {
      // Get user's players
      const { data: players, error: playersError } = await this.supabase
        .from('players')
        .select('id')
        .eq('user_id', userId);

      if (playersError) {
        console.error('Error fetching user players:', playersError);
        return [];
      }

      const playerIds = players?.map(p => p.id) || [];
      
      if (playerIds.length === 0) {
        return [];
      }

      // Get tournaments where user's players are registered
      const { data: tournaments, error: tournamentsError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .order('start_date', { ascending: false });

      if (tournamentsError) {
        console.error('Error fetching tournaments:', tournamentsError);
        return [];
      }

      // Filter tournaments where user is registered
      const userTournaments = tournaments?.filter(tournament => {
        const registeredPlayers = tournament.registered_players || [];
        return registeredPlayers.some((reg: any) => 
          playerIds.includes(reg.player_id || reg.playerId)
        );
      }) || [];

      return userTournaments;
    } catch (error) {
      console.error('Error in getUserTournamentRegistrations:', error);
      return [];
    }
  }

  /**
   * Register player for tournament - JavaScript replacement for register_player_for_tournament() function
   */
  async registerPlayerForTournament(tournamentId: string, playerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get tournament details
      const { data: tournament, error: tournamentError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) {
        console.error('Error fetching tournament:', tournamentError);
        return { success: false, error: tournamentError.message };
      }

      // Check if tournament exists and is accepting registrations
      if (!tournament) {
        return { success: false, error: 'any not found' };
      }

      if (tournament.status !== 0) { // Assuming 0 = registration open
        return { success: false, error: 'any registration is closed' };
      }

      // Check if max participants reached
      if (tournament.max_participants && tournament.current_participants >= tournament.max_participants) {
        return { success: false, error: 'any is full' };
      }

      // Get player details
      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (playerError) {
        console.error('Error fetching player:', playerError);
        return { success: false, error: playerError.message };
      }

      if (tournament.min_player_level && player.level < tournament.min_player_level) {
        return { success: false, error: 'Player level too low for this tournament' };
      }

      const registeredPlayers = tournament.registered_players || [];
      
      const userRegistrations = registeredPlayers.filter((p:any) => p.user_id === player.user_id);
      if (userRegistrations.length >= 2) {
        return { success: false, error: 'Max 2 players per user per tournament' };
      }

      const isAlreadyRegistered = registeredPlayers.some((reg: any) => 
        reg.player_id === playerId || reg.playerId === playerId
      );

      if (isAlreadyRegistered) {
        return { success: false, error: 'Player already registered for this tournament' };
      }

      if (tournament.entry_fee) {
        const userId = player.user_id;
        const hasResources = await this.resourceService.hasSufficientResources(userId, tournament.entry_fee);
        
        if (!hasResources) {
          return { success: false, error: 'Insufficient resources for entry fee' };
        }

        // Deduct entry fee
        const transactions = Object.entries(tournament.entry_fee).map(([resourceType, amount]) => ({
          resource_type: resourceType,
          amount: -(amount as number),
          source: 'tournament_entry_fee',
          source_id: tournamentId
        }));

        const result = await this.resourceService.batchResourceTransactions(userId, transactions);
        if (!result.success) {
          return { success: false, error: 'Failed to process entry fee' };
        }
      }

             // Get user's team name
       const { data: userProfile } = await this.supabase
         .from('user_profiles')
         .select('team_name')
         .eq('user_id', player.user_id)
         .single();

       // Add player to registered players
       const newRegisteredPlayers = [...registeredPlayers, {
         player_id: playerId,
         player_name: player.name,
         user_id: player.user_id,
         team_name: userProfile?.team_name || 'No Team',
         registered_at: new Date().toISOString()
       }];

      // Update tournament
      const { error: updateError } = await this.supabase
        .from('tournament_list')
        .update({
          registered_players: newRegisteredPlayers,
          current_participants: tournament.current_participants + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId);

      if (updateError) {
        console.error('Error updating tournament:', updateError);
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in registerPlayerForTournament:', error);
      return { success: false, error: 'Failed to register player for tournament' };
    }
  }

  /**
   * Start tournament - JavaScript replacement for start_tournament() function
   */
  async startTournament(tournamentId: string): Promise<{ success: boolean; matches?: any[]; error?: string;  }> {
    try {
      console.log("starting tournament")
      // Get tournament details
      const { data: tournament, error: tournamentError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) {
        console.error('Error fetching tournament:', tournamentError);
        return { success: false, error: tournamentError.message };
      }

      if (!tournament) {
        return { success: false, error: 'any not found' };
      }

      if (tournament.status !== 0) {
        return { success: false, error: 'any already started or completed' };
      }

      let registeredPlayers = tournament.registered_players || [];
      const missing = tournament.max_participants - registeredPlayers.length;
      if (missing > 0) {
        const { data: cpuPlayers } = await this.supabase.from("players").select("id, name, user_id").eq("is_cpu", true).limit(missing);
        const cpuRegistrations = (cpuPlayers ?? []).map((cpu) => ({
          player_id: cpu.id,
          player_name: cpu.name,
          user_id: cpu.user_id,
          team_name: "CPU",
          registered_at: new Date().toISOString(),
        }));
        registeredPlayers.push(...cpuRegistrations);
      }
      registeredPlayers = [...registeredPlayers].sort(() => Math.random() - 0.5);

      // Update tournament status to started
      const { error: updateError } = await this.supabase
        .from('tournament_list')
        .update({
          status: 1, // Started
          updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId);
      
      console.log("Tournament list updated with status code")

      if (updateError) {
        console.error('Error updating tournament status:', updateError);
        return { success: false, error: updateError.message };
      }

      // Create first round
      console.log("Generating matches")
      const result = await this.generateMatches(tournamentId, tournament.round_interval_minutes, 1, registeredPlayers);
      if (!result.success) {
        return { success: false, matches: result.matches };
      }

      return { 
        success: true,
       };
    } catch (error) {
      console.log('Error in startTournament:', error);
      return { success: false, error: 'Failed to start tournament' };
    }
  }

  /**
   * Get all matches for a tournament
   */
  async getTournamentMatches(tournamentId: string): Promise<any[]> {
    const { data: matches, error: matchesError } = await this.supabase
      .from('match')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return [];
    }

    return matches;
  }

  /**
   * Populate first round matches - JavaScript replacement for populate_first_round_matches() function
   */
  simulateGame(): { p1: number; p2: number } {
    let p1 = Math.floor(Math.random() * 10) + 11; // 11 to 20
    let p2 = Math.floor(Math.random() * 10) + 11;

    while (p1 === p2 || Math.abs(p1 - p2) < 2) {
      if (p1 > p2) p1++;
      else p2++;
      if (p1 >= 30 || p2 >= 30) break; // max point cap
    }

    return { p1, p2 };
  }

  generateMatchResult(player1Id: string, player2Id: string | null) {
    // Handle bye (no opponent)
    if (!player2Id) {
      return {
        winnerId: player1Id,
        score: '21-0, 21-0',
        completed: true,
        status: 'bye',
      };
    }

    const games: string[] = [];
    let player1Wins = 0;
    let player2Wins = 0;

    // Simulate best-of-3
    while (player1Wins < 2 && player2Wins < 2) {
      const result = this.simulateGame();
      games.push(`${result.p1}-${result.p2}`);

      if (result.p1 > result.p2) player1Wins++;
      else player2Wins++;
    }

    return {
      winnerId: player1Wins > player2Wins ? player1Id : player2Id,
      score: games.join(', '),
      completed: true,
      status: 'completed',
    };
  }
  
  async generateMatches(tournamentId: string, round_interval_minutes: number, round_level: number, players: any[]): Promise<{ success: boolean; matches?: any[]; error?: string;  }> {
    try {
      // Shuffle players
      const shuffledPlayers = this.shuffleArray([...players]);

      console.log('[generateMatches] shuffledPlayers', shuffledPlayers);
      // Create matches
      const matches = [];
      for (let i = 0; i < shuffledPlayers.length; i += 2) {
        const player1 = shuffledPlayers[i];
        const player2 = shuffledPlayers[i + 1] || null;

        console.log('[generateMatches] making match between', player1, 'and', player2);
        matches.push({
          tournament_id: tournamentId,
          player1_id: player1.player_id,
          player2_id: player2?.player_id || null,
          winner_id: player2 ? null : player1.player_id,
          scheduled_start_time: new Date(new Date().getTime() + 1000 * 60 * round_interval_minutes || 10).toISOString(),
          created_at: new Date().toISOString(),
          completed: player2 ? false : true,
          status: player2 ? 'pending' : 'bye',
          score: player2 ? null : '21-0, 21-0',
          round_level: round_level
        });
      }

      console.log('[generateMatches] matches', matches);

      const { error: matchesError } = await this.supabase
        .from('match')
        .insert(matches);

      if (matchesError) {
        console.error('Error creating matches:', matchesError);
        return { success: false, error: matchesError.message };
      }

      const groupedMatchs = [
        {
          round_level: round_level,
          round_name: `Round ${round_level}`,
          matches
        }
      ]

      return { success: true, matches: groupedMatchs };
    } catch (error) {
      console.error('Error in generateMatches:', error);
      return { success: false, error: 'Failed to populate first round matches' };
    }
  }

  /**
   * Get user's next match - JavaScript replacement for get_user_next_match() function
   */
  async getUserNextMatch(userId: string) {
    try {
      // Get user's players
      const { data: players, error: playersError } = await this.supabase
        .from('players')
        .select('id')
        .eq('user_id', userId);

      if (playersError) {
        console.error('Error fetching user players:', playersError);
        return null;
      }

      const playerIds = players?.map(p => p.id) || [];
      
      if (playerIds.length === 0) {
        return null;
      }

      // Find pending matches for user's players
      const { data: matches, error: matchesError } = await this.supabase
        .from('match')
        .select('*')
        .or(playerIds.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(','))
        .eq('completed', false)
        .order('created_at', { ascending: true })
        .limit(1);

      if (matchesError) {
        console.error('Error fetching user matches:', matchesError);
        return null;
      }

      return matches?.[0] || null;
    } catch (error) {
      console.error('Error in getUserNextMatch:', error);
      return null;
    }
  }

  /**
   * Get tournament progress - JavaScript replacement for get_tournament_progress() function
   */
  async getTournamentProgress(tournamentId: string) {
    try {
      const { data: tournament, error: tournamentError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) {
        console.error('Error fetching tournament:', tournamentError);
        return null;
      }

      const { data: matches, error: matchesError } = await this.supabase
        .from('match')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        return null;
      }

      const totalMatchCount = this.calcTotalTournamentMatchCount(tournament.registered_players.length);
      const completedMatchCount = matches.filter((match: any) => match.completed === true).length;

      const progress = totalMatchCount > 0 ? (completedMatchCount / totalMatchCount) * 100 : 0;

      return {
        tournament,
        totalMatchCount,
        completedMatchCount,
        progress
      };
    } catch (error) {
      console.error('Error in getTournamentProgress:', error);
      return null;
    }
  }

  /**
   * Utility function to shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get tournament automation status - JavaScript replacement for get_tournament_automation_status() function
   */
  async getTournamentAutomationStatus(tournamentId: string) {
    try {
      const { data: tournament, error } = await this.supabase
        .from('tournament_list')
        .select('automation_enabled, automation_settings')
        .eq('id', tournamentId)
        .single();

      if (error) {
        console.error('Error fetching tournament automation status:', error);
        return null;
      }

      return {
        automation_enabled: tournament?.automation_enabled || false,
        automation_settings: tournament?.automation_settings || null
      };
    } catch (error) {
      console.error('Error in getTournamentAutomationStatus:', error);
      return null;
    }
  }

  /**
   * Disable tournament automation - JavaScript replacement for disable_tournament_automation() function
   */
  async toggleAutomation(tournamentId: string, enabled: boolean) {
    try {
      const { error: updateError } = await this.supabase
        .from('tournament_list')
        .update({ automation_enabled: enabled })
        .eq('id', tournamentId);

      if (updateError) {
        console.error('Error disabling automation:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in disableAutomation:', error);
      return false;
    }
  }

  async getCPUPlayers() {
    const { data, error } = await this.supabase
      .from('players')
      .select('*')
      .eq('is_cpu', true);

    if (error) {
      throw error;
    }

    return data;
  }

  async updateTournament(tournamentId: string, tournament: any, registeredPlayers: any[] = []) {
    if (registeredPlayers.length > 0) {
      const { data: cpuPlayersData, error: cpuPlayersError } = await this.supabase
        .from('players')
        .select('*')
        .in('id', registeredPlayers)

      if (cpuPlayersError) {
        throw cpuPlayersError;
      }

      const cpuRegistrations = (cpuPlayersData || []).map(player => ({
        player_id: player.id,
      }));

      tournament.registered_players = cpuRegistrations;
      tournament.current_participants = cpuRegistrations.length;
    }

    console.log('updating tournament', tournament);

    const { error } = await this.supabase
      .from('tournament_list')
      .update(tournament)
      .eq('id', tournamentId);

    if (error) {
      throw error;
    }

    return true;
  }

  async createTournament(tournament: any, registeredPlayers: any[] = []) {
    if (registeredPlayers.length > 0) {
      const { data: cpuPlayersData, error: cpuPlayersError } = await this.supabase
        .from('players')
        .select('*')
        .in('id', registeredPlayers)

      if (cpuPlayersError) {
        throw cpuPlayersError;
      }

      const cpuRegistrations = (cpuPlayersData || []).map(player => ({
        player_id: player.id,
      }));

      tournament.registered_players = cpuRegistrations;
      tournament.current_participants = cpuRegistrations.length;
    }

    console.log('creating tournament', tournament);

    const { data, error } = await this.supabase
      .from('tournament_list')
      .insert(tournament)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async deleteTournament(tournamentId: string) {
    try {
      // Delete matches associated with this tournament
      const { error: matchesDeleteError } = await this.supabase
        .from('match')
        .delete()
        .eq('tournament_id', tournamentId);

      if (matchesDeleteError) {
        console.error('Error deleting matches:', matchesDeleteError);
        throw matchesDeleteError;
      }

      // Delete tournament registrations
      const { error: registrationsError } = await this.supabase
        .from('user_tournament_registrations')
        .delete()
        .eq('tournament_id', tournamentId);

      if (registrationsError) {
        console.error('Error deleting tournament registrations:', registrationsError);
        // Don't throw here as this table might not exist or might not have records
      }

      // Finally, delete the tournament itself
      const { error } = await this.supabase
        .from('tournament_list')
        .delete()
        .eq('id', tournamentId);

      if (error) {
        console.error('Error deleting tournament:', error);
        throw error;
      }

      console.log(`Successfully deleted tournament ${tournamentId} and all associated records`);
      return true;
    } catch (error) {
      console.error('Error in deleteTournament:', error);
      throw error;
    }
  }

  async getRegisteredPlayers(tournamentId: string) {
    const { data, error } = await this.supabase
      .from('user_tournament_registrations')
      .select(`
        player_id,
        players!inner(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('status', 'active');

    if (error) {
      throw error;
    }

    return data;
  }

}