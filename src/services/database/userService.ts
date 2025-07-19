import { PlayerService } from './playerService';
import { ResourceService } from './resourceService';
import { SupabaseClient } from '@supabase/supabase-js';

export class UserService {
  private supabase: SupabaseClient;
  private playerService: PlayerService;
  private resourceService: ResourceService;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.playerService = new PlayerService(supabaseClient);
    this.resourceService = new ResourceService(supabaseClient);
  }

  /**
   * Handle new user registration - JavaScript replacement for handle_new_user() function
   */
  async handleNewUser(userId: string, email?: string, teamName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Give initial resources to new user
      const initialResources = [
        { resource_type: 'coins', amount: 50000, source: 'initial_resources' },
        { resource_type: 'shuttlecocks', amount: 50000, source: 'initial_resources' },
        { resource_type: 'meals', amount: 50000, source: 'initial_resources' },
        { resource_type: 'diamonds', amount: 50000, source: 'initial_resources' }
      ];

      const resourceResult = await this.resourceService.batchResourceTransactions(userId, initialResources);
      if (!resourceResult.success) {
        console.warn('Failed to give initial resources:', resourceResult.error);
      }

      // Create initial facilities
      const initialFacilities = [
        {
          user_id: userId,
          name: 'Shuttlecock Machine',
          type: 'shuttlecock-machine',
          level: 1,
          production_rate: 1,
          resource_type: 'shuttlecocks',
          max_players: 0,
          upgrade_cost: { coins: 100 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: userId,
          name: 'Canteen',
          type: 'canteen',
          level: 1,
          production_rate: 1,
          resource_type: 'meals',
          max_players: 0,
          upgrade_cost: { coins: 150 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: userId,
          name: 'Sponsors',
          type: 'sponsors',
          level: 1,
          production_rate: 2,
          resource_type: 'coins',
          max_players: 0,
          upgrade_cost: { coins: 200 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: userId,
          name: 'Training Center',
          type: 'training-center',
          level: 1,
          production_rate: 0,
          resource_type: 'training',
          max_players: 2,
          upgrade_cost: { coins: 300, shuttlecocks: 50, meals: 50 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const { error: facilitiesError } = await this.supabase
        .from('facilities')
        .insert(initialFacilities);

      console.log("Created initial facilities")

      if (facilitiesError) {
        console.warn('Failed to create initial facilities:', facilitiesError);
      }

      // Create initial managers
      const initialManagers = [
        {
          user_id: userId,
          name: 'José',
          facility_type: 'shuttlecock-machine',
          production_bonus: 0.5,
          active: false,
          image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
          cost: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: userId,
          name: 'Gordon Ramsay',
          facility_type: 'canteen',
          production_bonus: 0.5,
          active: false,
          image_url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c',
          cost: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: userId,
          name: 'Ronald Dump',
          facility_type: 'sponsors',
          production_bonus: 0.5,
          active: false,
          image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
          cost: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const { error: managersError } = await this.supabase
        .from('managers')
        .insert(initialManagers);

      console.log("Created initial managers")

      if (managersError) {
        console.warn('Failed to create initial managers:', managersError);
        // Don't fail user creation for this
      }

      return { success: true };
    } catch (error) {
      console.error('Error in handleNewUser:', error);
      return { success: false, error: 'Failed to set up new user' };
    }
  }

  /**
   * Admin change user password - JavaScript replacement for admin_change_user_password() function
   */
  async adminChangeUserPassword(
    targetUserId: string,
    newPassword: string,
    adminUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if requester is admin (simplified check)
      if (adminUserId) {
        const { data: adminCheck } = await this.supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', adminUserId)
          .single();

        if (!adminCheck) {
          return { success: false, error: 'Not authorized' };
        }
      }

      // Note: This is a simplified implementation
      // In a real implementation, you would need to use Supabase Admin API
      // or a server-side function to change passwords
      
      // For now, we'll just log the attempt
      console.log(`Admin ${adminUserId} requested password change for user ${targetUserId} with new password ${newPassword}`);
      
      // You would typically use the Supabase Admin client here:
      // const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      //   password: newPassword
      // });

      return { success: false, error: 'Password change requires server-side implementation' };
    } catch (error) {
      console.error('Error in adminChangeUserPassword:', error);
      return { success: false, error: 'Failed to change user password' };
    }
  }

  /**
   * Get user profile with all related data
   */
  async getUserProfile(userId: string) {
    try {
      // Get user profile with team name
      const { data: userProfile } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Get user's players
      const players = await this.playerService.getPlayersByUserId(userId);

      // Get user's facilities
      const { data: facilities, error: facilitiesError } = await this.supabase
        .from('facilities')
        .select('*')
        .eq('user_id', userId);

      if (facilitiesError) {
        console.error('Error fetching facilities:', facilitiesError);
      }

      // Get user's managers
      const { data: managers, error: managersError } = await this.supabase
        .from('managers')
        .select('*')
        .eq('user_id', userId);

      if (managersError) {
        console.error('Error fetching managers:', managersError);
      }

      // Get user's resource balances
      const resourceBalances = await this.resourceService.getUserResourceBalances(userId);

      // Get user's tournament history
      const { data: tournamentHistory, error: tournamentsError } = await this.supabase
        .from('tournament_list')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(10);

      if (tournamentsError) {
        console.error('Error fetching tournament history:', tournamentsError);
      }

      // Filter tournaments where user participated
      const userTournaments = tournamentHistory?.filter(tournament => {
        const registeredPlayers = tournament.registered_players || [];
        return registeredPlayers.some((reg: any) => reg.user_id === userId);
      }) || [];

      return {
        userProfile: userProfile || null,
        players: players || [],
        facilities: facilities || [],
        managers: managers || [],
        resourceBalances,
        tournamentHistory: userTournaments
      };
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return {
        userProfile: null,
        players: [],
        facilities: [],
        managers: [],
        resourceBalances: {},
        tournamentHistory: []
      };
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId: string) {
    try {
      // Get user's players
      const { data: players } = await this.supabase
        .from('players')
        .select('id')
        .eq('user_id', userId);

      const playerIds = players?.map(p => p.id) || [];

      if (playerIds.length === 0) {
        return {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          tournamentsPlayed: 0,
          tournamentsWon: 0
        };
      }

      // Get match statistics
      const { data: matchHistory } = await this.supabase
        .from('player_play_history')
        .select('*')
        .or(playerIds.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(','));

      let wins = 0;
      let losses = 0;

      matchHistory?.forEach(match => {
        const isPlayer1 = playerIds.includes(match.player1_id);
        const won = isPlayer1 ? match.result : !match.result;
        
        if (won) {
          wins++;
        } else {
          losses++;
        }
      });

      const totalMatches = wins + losses;
      const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

      // Get tournament statistics (simplified)
      const { data: tournaments } = await this.supabase
        .from('tournament_list')
        .select('registered_players, status');

      let tournamentsPlayed = 0;
      let tournamentsWon = 0; // This would need more complex logic to determine

      tournaments?.forEach(tournament => {
        const registeredPlayers = tournament.registered_players || [];
        const isParticipant = registeredPlayers.some((reg: any) => reg.user_id === userId);
        
        if (isParticipant) {
          tournamentsPlayed++;
          // Tournament win logic would need to be implemented based on final standings
        }
      });

      return {
        totalMatches,
        wins,
        losses,
        winRate: Math.round(winRate * 100) / 100,
        tournamentsPlayed,
        tournamentsWon
      };
    } catch (error) {
      console.error('Error in getUserStatistics:', error);
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        tournamentsPlayed: 0,
        tournamentsWon: 0
      };
    }
  }

  /**
   * Update user team name
   */
  async updateUserTeamName(userId: string, teamName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .update({
          team_name: teamName,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating team name:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateUserTeamName:', error);
      return { success: false, error: 'Failed to update team name' };
    }
  }

  /**
   * Get user team name
   */
  async getUserTeamName(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('team_name')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching team name:', error);
        return null;
      }

      return data?.team_name || null;
    } catch (error) {
      console.error('Error in getUserTeamName:', error);
      return null;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: any): Promise<{ success: boolean; error?: string }> {
    try {
      // For now, we'll store preferences in a simple way
      // In a real implementation, you might have a user_preferences table
      
      // Update a player record with preferences (simplified approach)
      const { data: player } = await this.supabase
        .from('players')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      console.log(`Updating user preferences for user ${userId} with preferences ${JSON.stringify(preferences)}`);
      
      if (player) {
        const { error } = await this.supabase
          .from('players')
          .update({
            // Store preferences in a JSON field or create a separate table
            updated_at: new Date().toISOString()
          })
          .eq('id', player.id);

        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateUserPreferences:', error);
      return { success: false, error: 'Failed to update user preferences' };
    }
  }

  /**
   * Delete user account and all related data
   */
  async deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete in reverse order of dependencies
      
      // Delete user's resource transactions
      await this.supabase.from('resource_transactions').delete().eq('user_id', userId);
      
      // Delete user's match history (where they were involved)
      const { data: players } = await this.supabase
        .from('players')
        .select('id')
        .eq('user_id', userId);

      const playerIds = players?.map(p => p.id) || [];
      
      if (playerIds.length > 0) {
        await this.supabase
          .from('player_play_history')
          .delete()
          .or(playerIds.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(','));
      }

      // Delete user's players (cascading will handle related tables)
      await this.supabase.from('players').delete().eq('user_id', userId);
      
      // Delete user's facilities
      await this.supabase.from('facilities').delete().eq('user_id', userId);
      
      // Delete user's managers
      await this.supabase.from('managers').delete().eq('user_id', userId);
      
      // Delete user's interclub registrations
      await this.supabase.from('interclub_registrations').delete().eq('user_id', userId);

      return { success: true };
    } catch (error) {
      console.error('Error in deleteUserAccount:', error);
      return { success: false, error: 'Failed to delete user account' };
    }
  }

  /**
   * Get user activity logs with pagination
   */
  async getUserActivityLogs(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await this.supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching user activity logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserActivityLogs:', error);
      return [];
    }
  }

  /**
   * Load complete game state for a user
   */
  async loadGameState(userId?: string): Promise<any> {
    console.log("Loading game state")
    const state: any = {
      players: [],
      facilities: [],
      managers: [], // Will be replaced with initial managers if no data
      seasons: [],
    };

    if (!userId) {
      return state; // Return empty state if no user
    }

    try {
      const { data: players_db } = await this.supabase.from("players").select("*").eq('user_id', userId).eq('is_cpu', false).order('created_at', { ascending: true });
      
      // Get all player IDs for this user
      const playerIds = players_db?.map(p => p.id) || [];
      
      // Fetch stats for all user's players
      const { data: player_stats } = playerIds.length > 0 
        ? await this.supabase.from("player_stats").select("*").in('player_id', playerIds)
        : { data: [] };
      const { data: player_levels } = playerIds.length > 0
        ? await this.supabase.from("player_levels").select("*").in('player_id', playerIds)
        : { data: [] };
      const { data: player_strategies } = playerIds.length > 0
        ? await this.supabase.from("player_strategy").select("*").in('player_id', playerIds)
        : { data: [] };
      const { data: facilities_db } = await this.supabase.from("facilities").select("*").eq('user_id', userId).order('created_at', { ascending: true });
      const { data: managers_db } = await this.supabase.from("managers").select("*").eq('user_id', userId).order('created_at', { ascending: true });
      const { data: play_history_db } = await this.supabase.from('player_play_history').select("*");
      const { data: season_list_db } = await this.supabase.from('season_list').select("*");

      state.facilities = (facilities_db || []).map((facility_db: any): any => ({
        id: facility_db.id,
        name: facility_db.name,
        type: facility_db.type,
        level: facility_db.level,
        productionRate: facility_db.production_rate,
        resourceType: facility_db.resource_type,
        maxPlayers: facility_db.max_players,
        upgradeCost: facility_db.upgrade_cost,
        upgrading: facility_db.upgrading,
      }));

      state.managers = (managers_db || []).map((manager_db: any): any => ({
        id: manager_db.id,
        name: manager_db.name,
        facilityType: manager_db.facility_type,
        productionBonus: manager_db.production_bonus,
        active: manager_db.active,
        imageUrl: manager_db.image_url,
        cost: manager_db.cost,
        purchasing: manager_db.purchasing
      }));

      state.seasons = (season_list_db || []).map((season_db: any) => ({
        id: season_db.id,
        entryFee: {
          coins: season_db.entryFee.coins,
          shuttlecocks: season_db.entryFee.shuttlecocks,
          meals: season_db.entryFee.meals,
          diamonds: season_db.entryFee.diamonds,
          player: season_db.entryFee.player,
        },
        startDate: season_db.start_date,
        prizePool: season_db.prizePool,
        match_days: season_db.match_days,
        type: season_db.type,
      }));

      const getBestMatches = (player_id: string) => {
        // Filter matches where the player won
        const wonMatches = play_history_db
          ?.filter(play_db =>
            (play_db.player1_id === player_id && play_db.result === true) ||
            (play_db.player2_id === player_id && play_db.result === false)
          )
          .map(play_db => ({
            opponent_id: play_db.player1_id === player_id ? play_db.player2_id : play_db.player1_id,
            opponent_rank: play_db.player1_id === player_id ? play_db.player2_rank : play_db.player1_rank,
            match_date: play_db.created_at
          }))
          .sort((a, b) => b.opponent_rank - a.opponent_rank) // Sort by highest opponent rank
          .slice(0, 6); // Get top 6

        return wonMatches || [];
      };

      const players: any[] = [];
      (players_db || []).map((player_db: any) => {
        // Import equipment data
        const EQUIPMENT_DATA: any[] = []; // You might need to import this
        
        const equipment_id_map: {
          [key: string]: string
        } = player_db.equipment;
        const equipment: {
          [key: string]: any
        } = {};
        equipment_id_map && Object.entries(equipment_id_map).map(([type, id]) => {
          equipment[type] = EQUIPMENT_DATA.find((equipment) => equipment.id == id) as any;
        });

        // Generate initial stats/levels/strategy from utilities
        const generateInitialStats = () => ({
          endurance: Math.floor(Math.random() * 20) + 40,
          strength: Math.floor(Math.random() * 20) + 40,
          agility: Math.floor(Math.random() * 20) + 40,
          speed: Math.floor(Math.random() * 20) + 40,
          explosiveness: Math.floor(Math.random() * 20) + 40,
          injuryPrevention: Math.floor(Math.random() * 20) + 40,
          smash: Math.floor(Math.random() * 20) + 40,
          defense: Math.floor(Math.random() * 20) + 40,
          serve: Math.floor(Math.random() * 20) + 40,
          stick: Math.floor(Math.random() * 20) + 40,
          slice: Math.floor(Math.random() * 20) + 40,
          drop: Math.floor(Math.random() * 20) + 40,
        });

        const generateInitialStatLevels = () => ({
          endurance: 0,
          strength: 0,
          agility: 0,
          speed: 0,
          explosiveness: 0,
          injuryPrevention: 0,
          smash: 0,
          defense: 0,
          serve: 0,
          stick: 0,
          slice: 0,
          drop: 0,
        });

        const generateInitialStrategy = () => ({
          physicalCommitment: 5,
          playStyle: 5,
          movementSpeed: 5,
          fatigueManagement: 5,
          rallyConsistency: 5,
          riskTaking: 5,
          attack: 5,
          softAttack: 5,
          serving: 5,
          courtDefense: 5,
          mentalToughness: 5,
          selfConfidence: 5,
        });

        const player: any = {
          id: player_db.id,
          gender: player_db.gender,
          name: player_db.name,
          stats: generateInitialStats(),
          statLevels: generateInitialStatLevels(),
          level: player_db.level,
          maxLevel: player_db.max_level,
          rank: player_db.rank,
          best: getBestMatches(player_db.id),
          training: player_db.training,
          equipment: equipment,
          injuries: (player_db.injuries || []),
          strategy: generateInitialStrategy()
        };

        const player_stat = (player_stats || []).find(({ player_id }: any) => player_id == player_db.id);
        player_stat && (player.stats = {
          endurance: player_stat.endurance,
          strength: player_stat.strength,
          agility: player_stat.agility,
          speed: player_stat.speed,
          explosiveness: player_stat.explosiveness,
          injuryPrevention: player_stat.injury_prevention,
          smash: player_stat.smash,
          defense: player_stat.defense,
          serve: player_stat.serve,
          stick: player_stat.stick,
          slice: player_stat.slice,
          drop: player_stat.drop,
        });

        const player_level = (player_levels || []).find(({ player_id }: any) => player_id == player_db.id);
        player_level && (player.statLevels = {
          endurance: player_level.endurance,
          strength: player_level.strength,
          agility: player_level.agility,
          speed: player_level.speed,
          explosiveness: player_level.explosiveness,
          injuryPrevention: player_level.injury_prevention,
          smash: player_level.smash,
          defense: player_level.defense,
          serve: player_level.serve,
          stick: player_level.stick,
          slice: player_level.slice,
          drop: player_level.drop,
        });

        const player_strategy = (player_strategies || []).find(({ player_id }: any) => player_id == player_db.id);
        player_strategy && (player.strategy = {
          physicalCommitment: player_strategy.physical_commitment,
          playStyle: player_strategy.play_style,
          movementSpeed: player_strategy.movement_speed,
          fatigueManagement: player_strategy.fatigue_management,
          rallyConsistency: player_strategy.rally_consistency,
          riskTaking: player_strategy.risk_taking,
          attack: player_strategy.attack,
          softAttack: player_strategy.soft_attack,
          serving: player_strategy.serving,
          courtDefense: player_strategy.court_defense,
          mentalToughness: player_strategy.mental_toughness,
          selfConfidence: player_strategy.self_confidence,
        });

        players.push(player);
      });

      state.players = players;
      return state;
    } catch (error) {
      console.log('Error in loadGameState:', error);
      return state;
    }
  }
} 