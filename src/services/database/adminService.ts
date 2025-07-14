import { SupabaseClient } from '@supabase/supabase-js';

export class AdminService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId?: string): Promise<boolean> {
    try {
      const checkUserId = userId || (await this.supabase.auth.getUser()).data.user?.id;
      
      if (!checkUserId) {
        return false;
      }

      const { data, error } = await this.supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', checkUserId)
        .single();

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error in isAdmin:', error);
      return false;
    }
  }

  /**
   * Get admin dashboard stats - JavaScript replacement for get_admin_dashboard_stats() function
   */
  async getAdminDashboardStats() {
    try {
      // Get total user count
      const { count: totalUsers } = await this.supabase
        .from('players')
        .select('user_id', { count: 'exact', head: true });

      // Get active tournaments count
      const { count: activeTournaments } = await this.supabase
        .from('tournament_list')
        .select('id', { count: 'exact', head: true })
        .in('status', [0, 1]); // Registration open or started

      // Get completed tournaments count
      const { count: completedTournaments } = await this.supabase
        .from('tournament_list')
        .select('id', { count: 'exact', head: true })
        .eq('status', 2); // Completed

      // Get total matches count
      const { count: totalMatches } = await this.supabase
        .from('match')
        .select('id', { count: 'exact', head: true });

      // Get completed matches count
      const { count: completedMatches } = await this.supabase
        .from('match')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed');

      // Get CPU teams count
      const { count: cpuTeams } = await this.supabase
        .from('cpu_teams')
        .select('id', { count: 'exact', head: true });

      // Get interclub seasons count
      const { count: interclubSeasons } = await this.supabase
        .from('interclub_seasons')
        .select('id', { count: 'exact', head: true });

      return {
        total_users: totalUsers || 0,
        active_tournaments: activeTournaments || 0,
        completed_tournaments: completedTournaments || 0,
        total_matches: totalMatches || 0,
        completed_matches: completedMatches || 0,
        cpu_teams: cpuTeams || 0,
        interclub_seasons: interclubSeasons || 0
      };
    } catch (error) {
      console.error('Error in getAdminDashboardStats:', error);
      return {
        total_users: 0,
        active_tournaments: 0,
        completed_tournaments: 0,
        total_matches: 0,
        completed_matches: 0,
        cpu_teams: 0,
        interclub_seasons: 0
      };
    }
  }

  // NOTE: CPU player generation functionality has been moved to PlayerService.generateCpuPlayersForTeam()
  // This provides a centralized, consistent approach to player creation

  /**
   * Log admin activity - JavaScript replacement for log_admin_activity() function
   */
  async logAdminActivity(
    adminUserId: string,
    actionType: string,
    targetType?: string,
    targetId?: string,
    details?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('admin_activity_logs')
        .insert({
          admin_user_id: adminUserId,
          action_type: actionType,
          target_type: targetType || null,
          target_id: targetId || null,
          details: details || null,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error logging admin activity:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in logAdminActivity:', error);
      return { success: false, error: 'Failed to log admin activity' };
    }
  }

  /**
   * Admin register player for tournament - JavaScript replacement for admin_register_player_for_tournament() function
   */
  async adminRegisterPlayerForTournament(
    tournamentId: string,
    playerId: string,
    adminUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user is admin
      const isAdminUser = await this.isAdmin(adminUserId);
      if (!isAdminUser) {
        return { success: false, error: 'Not authorized' };
      }

      // Get tournament and player details
      const [tournament, player] = await Promise.all([
        this.supabase.from('tournament_list').select('*').eq('id', tournamentId).single(),
        this.supabase.from('players').select('*').eq('id', playerId).single()
      ]);

      if (tournament.error) {
        return { success: false, error: 'Tournament not found' };
      }

      if (player.error) {
        return { success: false, error: 'Player not found' };
      }

      // Check if player is already registered
      const registeredPlayers = tournament.data.registered_players || [];
      const isAlreadyRegistered = registeredPlayers.some((reg: any) => 
        reg.player_id === playerId || reg.playerId === playerId
      );

      if (isAlreadyRegistered) {
        return { success: false, error: 'Player already registered for this tournament' };
      }

      // Add player to registered players (no entry fee for admin registration)
      const newRegisteredPlayers = [...registeredPlayers, {
        player_id: playerId,
        player_name: player.data.name,
        user_id: player.data.user_id,
        registered_at: new Date().toISOString(),
        admin_registered: true
      }];

      // Update tournament
      const { error: updateError } = await this.supabase
        .from('tournament_list')
        .update({
          registered_players: newRegisteredPlayers,
          current_participants: tournament.data.current_participants + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId);

      if (updateError) {
        console.error('Error updating tournament:', updateError);
        return { success: false, error: updateError.message };
      }

      // Log admin activity
      if (adminUserId) {
        await this.logAdminActivity(
          adminUserId,
          'admin_register_player',
          'tournament',
          tournamentId,
          { player_id: playerId, player_name: player.data.name }
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error in adminRegisterPlayerForTournament:', error);
      return { success: false, error: 'Failed to register player for tournament' };
    }
  }

  /**
   * Assign CPU players to tournament - JavaScript replacement for assign_cpu_players_to_tournament() function
   */
  async assignCpuPlayersToTournament(
    tournamentId: string,
    cpuTeamIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get tournament details
      const { data: tournament, error: tournamentError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) {
        return { success: false, error: 'Tournament not found' };
      }

      // Get CPU teams
      const { data: cpuTeams, error: cpuError } = await this.supabase
        .from('cpu_teams')
        .select('*')
        .in('id', cpuTeamIds);

      if (cpuError) {
        return { success: false, error: 'CPU teams not found' };
      }

      // Add CPU players to tournament
      const registeredPlayers = tournament.registered_players || [];
      let currentParticipants = tournament.current_participants;

      for (const cpuTeam of cpuTeams || []) {
        const cpuPlayers = cpuTeam.players || [];
        
        for (const cpuPlayer of cpuPlayers) {
          registeredPlayers.push({
            player_id: cpuPlayer.id,
            player_name: cpuPlayer.name,
            user_id: null, // CPU players don't have user IDs
            registered_at: new Date().toISOString(),
            cpu_team_id: cpuTeam.id,
            is_cpu: true
          });
          currentParticipants++;

          // Check max participants
          if (tournament.max_participants && currentParticipants >= tournament.max_participants) {
            break;
          }
        }

        if (tournament.max_participants && currentParticipants >= tournament.max_participants) {
          break;
        }
      }

      // Update tournament
      const { error: updateError } = await this.supabase
        .from('tournament_list')
        .update({
          registered_players: registeredPlayers,
          current_participants: currentParticipants,
          updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId);

      if (updateError) {
        console.error('Error updating tournament:', updateError);
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in assignCpuPlayersToTournament:', error);
      return { success: false, error: 'Failed to assign CPU players to tournament' };
    }
  }

  /**
   * Generate interclub groups - JavaScript replacement for generate_interclub_groups() function
   */
  async generateInterclubGroups(seasonId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get season details
      const { data: season, error: seasonError } = await this.supabase
        .from('interclub_seasons')
        .select('*')
        .eq('id', seasonId)
        .single();

      if (seasonError) {
        return { success: false, error: 'Season not found' };
      }

      // Get approved registrations
      const { data: registrations, error: regError } = await this.supabase
        .from('interclub_registrations')
        .select('*')
        .eq('season_id', seasonId)
        .eq('status', 'approved');

      if (regError) {
        return { success: false, error: 'Failed to fetch registrations' };
      }

      if (!registrations || registrations.length < 2) {
        return { success: false, error: 'Not enough teams to create groups' };
      }

      // Shuffle teams and create groups
      const shuffledTeams = this.shuffleArray([...registrations]);
      const maxTeamsPerGroup = season.max_teams_per_group || 8;
      const groups = [];
      
      let currentGroup = [];
      let groupNumber = 1;

      for (const team of shuffledTeams) {
        currentGroup.push({
          id: team.id,
          team_name: team.team_name,
          user_id: team.user_id,
          players: team.players
        });

        if (currentGroup.length >= maxTeamsPerGroup) {
          groups.push({
            group_number: groupNumber,
            teams: currentGroup
          });
          currentGroup = [];
          groupNumber++;
        }
      }

      // Add remaining teams to last group
      if (currentGroup.length > 0) {
        groups.push({
          group_number: groupNumber,
          teams: currentGroup
        });
      }

      // Update season with groups
      const { error: updateError } = await this.supabase
        .from('interclub_seasons')
        .update({
          groups: groups,
          updated_at: new Date().toISOString()
        })
        .eq('id', seasonId);

      if (updateError) {
        console.error('Error updating season groups:', updateError);
        return { success: false, error: updateError.message };
      }

      // Update registrations with group assignments
      for (const group of groups) {
        for (const team of group.teams) {
          await this.supabase
            .from('interclub_registrations')
            .update({ group_assignment: group.group_number })
            .eq('id', team.id);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error in generateInterclubGroups:', error);
      return { success: false, error: 'Failed to generate interclub groups' };
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
}