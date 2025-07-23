import { SupabaseClient } from '@supabase/supabase-js';
import { ResourceService } from './resourceService';
import { PlayerService } from './playerService';
import { MatchService } from './matchService';
import { supabase } from '@/lib/supabase';
import {
  InterclubSeason,
  InterclubRegistration,
  InterclubEncounter,
  InterclubLineup,
  InterclubTier,
  InterclubRegistrationRequest,
  LineupSubmission,
  InterclubTeam,
  InterclubPlayer,
  GroupStanding,
  IndividualMatch,
  MATCHDAYS_BY_TEAMS,
  TIER_REQUIREMENTS,
  MATCH_TYPES
} from '../../types/interclub';

export class InterclubService {
  private supabase: SupabaseClient;
  private resourceService: ResourceService;
  private playerService: PlayerService;
  private matchService: MatchService;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.resourceService = new ResourceService(supabaseClient);
    this.playerService = new PlayerService(supabaseClient);
    this.matchService = new MatchService(supabaseClient);
  }

  // ==========================================
  // SEASON MANAGEMENT
  // ==========================================

  /**
   * Get available seasons for user based on their unlocked tiers
   */
  async getAvailableSeasons(userId: string): Promise<{ seasons: InterclubSeason[]; unlockedTiers: InterclubTier[] }> {
    try {
      // Get user's unlocked tiers based on their past performance
      const unlockedTiers = await this.getUserUnlockedTiers(userId);
      console.log("Unlocked tiers", unlockedTiers)
      // Get seasons for unlocked tiers
      const { data: seasons, error } = await this.supabase
        .from('interclub_seasons')
        .select('*')
        .in('tier', unlockedTiers)
        .eq('status', 'registration_open')
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching available seasons:', error);
        throw error;
      }

      console.log(seasons)

      const parsedSeasons = (seasons || []).map(season => ({
        ...season,
        groups: JSON.parse(season.groups || '[]'),
        week_schedule: JSON.parse(season.week_schedule || '[]')
      }));

      return {
        seasons: parsedSeasons,
        unlockedTiers
      };
    } catch (error) {
      console.error('Error in getAvailableSeasons:', error);
      throw error;
    }
  }

  /**
   * Get user's unlocked tiers based on past interclub performance
   */
  private async getUserUnlockedTiers(userId: string): Promise<InterclubTier[]> {
    try {
      // Always unlock departmental
      let unlockedTiers: InterclubTier[] = ['departmental'];
      // Check past season results to unlock higher tiers
      const { data: pastRegistrations, error } = await this.supabase
        .from('interclub_registrations')
        .select(`
          *,
          season:season_id(tier, status)
        `)
        .eq('user_id', userId)
        .eq('status', 'approved');

      if (error) {
        console.error('Error fetching past registrations:', error);
        return unlockedTiers;
      }

      // Check for top 2 finishes to unlock next tiers
      for (const registration of pastRegistrations || []) {
        if (registration.season?.status === 'completed') {
          const finalPosition = await this.getUserFinalPosition(userId, registration.season_id);
          if (finalPosition <= 2) {
            const currentTier = registration.season.tier;
            const nextTier = this.getNextTier(currentTier);
            if (nextTier && !unlockedTiers.includes(nextTier)) {
              unlockedTiers.push(nextTier);
            }
          }
        }
      }
      return unlockedTiers;
    } catch (error) {
      console.error('Error in getUserUnlockedTiers:', error);
      return ['departmental'];
    }
  }


  private validatePlayerUsageLimit(lineup: LineupSubmission['lineup']): { valid: boolean; error?: string } {
    const allPlayerIds = [
      lineup.mens_singles,
      lineup.womens_singles,
      ...lineup.mens_doubles,
      ...lineup.womens_doubles,
      ...lineup.mixed_doubles
    ];

    const usage: Record<string, number> = {};
    allPlayerIds.forEach(id => {
      usage[id] = (usage[id] || 0) + 1;
    });

    const overused = Object.entries(usage).filter(([_, count]) => count > 3);
    if (overused.length > 0) {
      const overusedList = overused.map(([id]) => id).join(', ');
      return {
        valid: false,
        error: `Players used more than 3 times: ${overusedList}`
      };
    }

    return { valid: true };
  }

  /**
   * Get next tier in progression
   */
  private getNextTier(currentTier: InterclubTier): InterclubTier | null {
    const progression: InterclubTier[] = ['departmental', 'regional', 'national', 'top12'];
    const currentIndex = progression.indexOf(currentTier);
    return currentIndex < progression.length - 1 ? progression[currentIndex + 1] : null;
  }

  /**
   * Get user's final position in a completed season
   */
  private async getUserFinalPosition(userId: string, seasonId: string): Promise<number> {
    try {
      const { data: registration, error } = await this.supabase
        .from('interclub_registrations')
        .select('group_assignment')
        .eq('user_id', userId)
        .eq('season_id', seasonId)
        .single();

      if (error || !registration) {
        return 999; // Not found
      }

      const standings = await this.getGroupStandings(seasonId, registration.group_assignment);
      const userStanding = standings.find(s => s.team_id === userId);
      return userStanding?.position || 999;
    } catch (error) {
      console.error('Error getting final position:', error);
      return 999;
    }
  }

  // ==========================================
  // REGISTRATION MANAGEMENT
  // ==========================================

  /**
   * Register user for an interclub season
   */
  async registerForSeason(userId: string, request: InterclubRegistrationRequest): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[InterclubService] Registering for season:', request);

      // Validate registration eligibility
      const validationResult = await this.validateRegistrationEligibility(userId, request);
      if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
      }

      // Get season details
      const { data: season, error: seasonError } = await this.supabase
        .from('interclub_seasons')
        .select('*')
        .eq('id', request.season_id)
        .single();

      if (seasonError || !season) {
        return { success: false, error: 'Season not found' };
      }

      // Get selected players with details
      const playerDetails = await Promise.all(
        request.selected_players.map(playerId => 
          this.playerService.getPlayerWithDetails(playerId)
        )
      );

      // Prepare registration data
      const registrationData = {
        season_id: request.season_id,
        user_id: userId,
        team_name: request.team_name,
        players: JSON.stringify(playerDetails),
        status: 'pending'
      };

      // Insert registration
      const { data: registration, error: registrationError } = await this.supabase
        .from('interclub_registrations')
        .insert(registrationData)
        .select()
        .single();


      if (registrationError) {
        console.error('Error creating registration:', registrationError);
        return { success: false, error: registrationError.message };
      }

      // Deduct resources
      const resourceCost = TIER_REQUIREMENTS[season.tier as InterclubTier];
      await this.resourceService.batchResourceTransactions(userId, [
        { resource_type: 'coins', amount: -resourceCost.coins, source: 'interclub_registration', source_id: registration.id },
        { resource_type: 'shuttlecocks', amount: -resourceCost.shuttlecocks, source: 'interclub_registration', source_id: registration.id },
        { resource_type: 'meals', amount: -resourceCost.meals, source: 'interclub_registration', source_id: registration.id }
      ]);

      console.log('[InterclubService] Registration successful:', registration.id);
      return { success: true };
    } catch (error) {
      console.error('Error in registerForSeason:', error);
      return { success: false, error: 'Failed to register for season' };
    }
  }

  /**
   * Validate registration eligibility
   */
  private async validateRegistrationEligibility(
    userId: string, 
    request: InterclubRegistrationRequest
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if season exists and is open for registration
      const { data: season, error: seasonError } = await this.supabase
        .from('interclub_seasons')
        .select('*')
        .eq('id', request.season_id)
        .single();

      if (seasonError || !season) {
        return { valid: false, error: 'Season not found' };
      }

      if (season.status !== 'registration_open') {
        return { valid: false, error: 'Registration is not open for this season' };
      }

      // Check registration deadline (48 hours before start)
      const now = new Date();
      const registrationDeadline = new Date(season.registration_deadline);
      if (now > registrationDeadline) {
        return { valid: false, error: 'Registration deadline has passed' };
      }

      // Check if user already registered
      const { data: existingRegistration } = await this.supabase
        .from('interclub_registrations')
        .select('id')
        .eq('season_id', request.season_id)
        .eq('user_id', userId)
        .single();

      if (existingRegistration) {
        return { valid: false, error: 'Already registered for this season' };
      }

      // Check minimum players requirement
      if (request.selected_players.length < 5) {
        return { valid: false, error: 'Minimum 5 players required' };
      }

      // Check if user has enough resources
      const resourceCost = TIER_REQUIREMENTS[season.tier as InterclubTier];
      const userResources = await this.resourceService.getUserResourceBalances(userId);
      
      if (userResources.coins < resourceCost.coins ||
          userResources.shuttlecocks < resourceCost.shuttlecocks ||
          userResources.meals < resourceCost.meals) {
        return { valid: false, error: 'Insufficient resources' };
      }

      // Check if all selected players belong to user and are available
      const { data: userPlayers } = await this.supabase
        .from('players')
        .select('id')
        .eq('user_id', userId)
        .in('id', request.selected_players);

      if (!userPlayers || userPlayers.length !== request.selected_players.length) {
        return { valid: false, error: 'Invalid player selection' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating registration:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }

  /**
   * Get user's current registrations
   */
  async getUserRegistrations(userId: string): Promise<InterclubRegistration[]> {
    try {
      const { data: registrations, error } = await this.supabase
        .from('interclub_registrations')
        .select(`
          *,
          season:season_id(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user registrations:', error);
        throw error;
      }

      return (registrations || []).map(reg => ({
        ...reg,
        players: JSON.parse(reg.players || '[]')
      }));
    } catch (error) {
      console.error('Error in getUserRegistrations:', error);
      throw error;
    }
  }

  // ==========================================
  // LINEUP MANAGEMENT
  // ==========================================

  /**
   * Submit lineup for an encounter
   */
  async submitLineup(userId: string, submission: LineupSubmission): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[InterclubService] Submitting lineup:', submission);

      // Validate lineup submission
      const validationResult = await this.validateLineupSubmission(userId, submission);
      if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
      }

      const validation = this.validatePlayerUsageLimit(submission.lineup);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Get encounter details
      const { data: encounter, error: encounterError } = await this.supabase
        .from('interclub_matches')
        .select('*')
        .eq('id', submission.encounter_id)
        .single();

      if (encounterError || !encounter) {
        return { success: false, error: 'Encounter not found' };
      }

      // Determine if this is home or away lineup
      const isHomeTeam = encounter.home_team_id === userId;
      const lineupField = isHomeTeam ? 'home_lineup' : 'away_lineup';

      // Get player details for lineup
      const lineupWithDetails = await this.buildLineupWithPlayerDetails(submission.lineup);

      // Prepare lineup data
      const lineupData = {
        encounter_id: submission.encounter_id,
        team_id: userId,
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
        lineup: lineupWithDetails,
        is_auto_generated: false
      };

      // Update encounter with lineup
      const { error: updateError } = await this.supabase
        .from('interclub_matches')
        .update({
          [lineupField]: JSON.stringify(lineupData),
          status: this.calculateEncounterStatus(encounter, lineupField)
        })
        .eq('id', submission.encounter_id);

      if (updateError) {
        console.error('Error updating encounter with lineup:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('[InterclubService] Lineup submitted successfully');
      return { success: true };
    } catch (error) {
      console.log('Error in submitLineup:', error);
      return { success: false, error: 'Failed to submit lineup' };
    }
  }

  async generateAndPersistMatchSchedule(
    seasonId: string,
    teamIds: string[],
    computeMatchDate: (matchday: number) => string,
    groupNumber: number
  ): Promise<{ success: boolean; error?: string }> {
    // 1) Build one‐leg round robin (Berger tables)
    const n = teamIds.length;
    if (n % 2 !== 0) {
      teamIds = [...teamIds, 'BYE']; // add dummy for odd count
    }
    const rounds: { home: string; away: string }[][] = [];
    const teams = [...teamIds];
    const fixed = teams[0];
    const rotating = teams.slice(1);

    for (let r = 0; r < teams.length - 1; r++) {
      const pairings: { home: string; away: string }[] = [];
      const current = [fixed, ...rotating];
      for (let i = 0; i < current.length / 2; i++) {
        const t1 = current[i];
        const t2 = current[current.length - 1 - i];
        if (t1 !== 'BYE' && t2 !== 'BYE') {
          // alternate home/away each round
          if (r % 2 === 0) pairings.push({ home: t1, away: t2 });
          else pairings.push({ home: t2, away: t1 });
        }
      }
      rounds.push(pairings);
      // rotate
      rotating.unshift(rotating.pop()!);
    }

    // 2) Duplicate for second leg (swap home/away)
    const fullSchedule = [
      ...rounds,
      ...rounds.map(day => day.map(m => ({ home: m.away, away: m.home })))
    ];

    // 3) Bucket matchdays into 4 weeks (spread 10 MDs into 4 buckets of 2–3)
    const totalMD = fullSchedule.length;         // e.g. 10
    const weeks = 4;
    const perWeek = Math.floor(totalMD / weeks); // 2
    const extras = totalMD % weeks;               // 2
    const weekBuckets = Array.from({ length: weeks }, (_, i) =>
      perWeek + (i < extras ? 1 : 0)
    );

    // 4) Build fixturesToInsert
    let md = 1, cursor = 0;
    const fixturesToInsert: any[] = [];
    for (let w = 0; w < weeks; w++) {
      for (let k = 0; k < weekBuckets[w]; k++, md++) {
        for (const m of fullSchedule[md - 1]) {
          fixturesToInsert.push({
            season_id: seasonId,
            week_number: w + 1,
            home_team_id: m.home,
            away_team_id: m.away,
            match_date: computeMatchDate(md),
            status: 'lineup_pending',
            group_number: groupNumber
          });
        }
      }
    }

    // 5) Bulk insert
    const { error: insertError } = await this.supabase
      .from('interclub_matches')
      .insert(fixturesToInsert);
    if (insertError) {
      console.log('Error inserting fixtures:', insertError);
      return { success: false, error: insertError.message };
    }

    // 6) Persist week_schedule JSON
    // rebuild week_schedule structure for storage
    let idx = 1;
    const week_schedule = weekBuckets.map((count, w) => {
      const matchdays = Array.from({ length: count }, () => idx++);
      return { week: w + 1, matchdays };
    });

    const { error: updateError } = await this.supabase
      .from('interclub_seasons')
      .update({
        week_schedule: JSON.stringify(week_schedule),
        updated_at: new Date().toISOString()
      })
      .eq('id', seasonId);
    if (updateError) {
      console.log('Error updating week_schedule:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  }

  /**
   * Validate lineup submission
   */
  private async validateLineupSubmission(
    userId: string, 
    submission: LineupSubmission
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Get encounter details
      const { data: encounter, error } = await this.supabase
        .from('interclub_matches')
        .select('*')
        .eq('id', submission.encounter_id)
        .single();

      if (error || !encounter) {
        return { valid: false, error: 'Encounter not found' };
      }

      // Check if user is part of this encounter
      if (encounter.home_team_id !== userId && encounter.away_team_id !== userId) {
        return { valid: false, error: 'Not authorized to submit lineup for this encounter' };
      }

      // Check if lineup deadline has passed
      const matchDate = new Date(encounter.match_date);
      const now = new Date();
      const deadlineHours = 2; // 2 hours before match
      if (now > new Date(matchDate.getTime() - deadlineHours * 60 * 60 * 1000)) {
        return { valid: false, error: 'Lineup submission deadline has passed' };
      }

      // Validate lineup constraints
      const constraintValidation = await this.validateLineupConstraints(userId, submission.lineup);
      if (!constraintValidation.valid) {
        return constraintValidation;
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating lineup submission:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }

  /**
   * Validate lineup constraints (max 3 matches per player, gender rules)
   */
  private async validateLineupConstraints(
    userId: string, 
    lineup: LineupSubmission['lineup']
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Get all player IDs in lineup
      const allPlayerIds = [
        lineup.mens_singles,
        lineup.womens_singles,
        ...lineup.mens_doubles,
        ...lineup.womens_doubles,
        ...lineup.mixed_doubles
      ];

      // Count player usage
      const playerUsage: Record<string, number> = {};
      allPlayerIds.forEach(playerId => {
        playerUsage[playerId] = (playerUsage[playerId] || 0) + 1;
      });

      // Check max 3 matches per player
      for (const [playerId, count] of Object.entries(playerUsage)) {
        if (count > 3) {
          return { valid: false, error: `Player can participate in maximum 3 matches` };
        }
      }

      // Get player details to validate gender constraints
      const { data: players, error } = await this.supabase
        .from('players')
        .select('id, name, gender')
        .eq('user_id', userId)
        .in('id', allPlayerIds);

      if (error || !players) {
        return { valid: false, error: 'Failed to validate players' };
      }

      const playerMap = players.reduce((map, player) => {
        map[player.id] = player;
        return map;
      }, {} as Record<string, any>);

      // Validate gender constraints
      const mensSinglesPlayer = playerMap[lineup.mens_singles];
      const womensSinglesPlayer = playerMap[lineup.womens_singles];
      const mensDoublesPlayers = lineup.mens_doubles.map(id => playerMap[id]);
      const womensDoublesPlayers = lineup.womens_doubles.map(id => playerMap[id]);
      const mixedDoublesPlayers = lineup.mixed_doubles.map(id => playerMap[id]);

      if (mensSinglesPlayer?.gender !== 'male') {
        return { valid: false, error: 'Men\'s singles must be played by a male player' };
      }
      if (womensSinglesPlayer?.gender !== 'female') {
        return { valid: false, error: 'Women\'s singles must be played by a female player' };
      }
      if (mensDoublesPlayers.some(p => p?.gender !== 'male')) {
        return { valid: false, error: 'Men\'s doubles must be played by male players' };
      }
      if (womensDoublesPlayers.some(p => p?.gender !== 'female')) {
        return { valid: false, error: 'Women\'s doubles must be played by female players' };
      }
      
      const mixedMale = mixedDoublesPlayers.find(p => p?.gender === 'male');
      const mixedFemale = mixedDoublesPlayers.find(p => p?.gender === 'female');
      if (!mixedMale || !mixedFemale) {
        return { valid: false, error: 'Mixed doubles must have one male and one female player' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating lineup constraints:', error);
      return { valid: false, error: 'Constraint validation failed' };
    }
  }

  /**
   * Build lineup with full player details
   */
  private async buildLineupWithPlayerDetails(
    lineup: LineupSubmission['lineup']
  ): Promise<{
    mens_singles: any;
    womens_singles: any;
    mens_doubles: any[];
    womens_doubles: any[];
    mixed_doubles: any[];
  }> {
    // 1) Collect all the IDs we need
    const allPlayerIds = [
      lineup.mens_singles,
      lineup.womens_singles,
      ...lineup.mens_doubles,
      ...lineup.womens_doubles,
      ...lineup.mixed_doubles,
    ];

    // 2) Batch‑fetch everything in parallel
    const [
      { data: players, error: playersErr },
      { data: levels, error: levelsErr },
      { data: stats, error: statsErr },
      { data: equipments, error: equipErr },
    ] = await Promise.all([
      supabase.from('players').select('*').in('id', allPlayerIds),
      supabase.from('player_levels').select('*').in('player_id', allPlayerIds),
      supabase.from('player_stats').select('*').in('player_id', allPlayerIds),
      supabase.from('player_equipment').select('*').in('player_id', allPlayerIds),
    ]);

    if (playersErr) throw playersErr;
    if (levelsErr)  throw levelsErr;
    if (statsErr)   throw statsErr;
    if (equipErr)   throw equipErr;

    // 3) Build a lookup map so we can merge in O(1)
    const playerMap: Record<string, any> = {};
    players!.forEach(p => {
      playerMap[p.id] = {
        ...p,
        player_levels: levels!.find(l => l.player_id === p.id) || {},
        strategy:       stats!.find(s => s.player_id === p.id) || {},
        equipments:     equipments!.filter(e => e.player_id === p.id),
      };
    });

    // 4) Re‑assemble the structure
    return {
      mens_singles:  playerMap[lineup.mens_singles],
      womens_singles: playerMap[lineup.womens_singles],
      mens_doubles:  lineup.mens_doubles.map(id => playerMap[id]),
      womens_doubles: lineup.womens_doubles.map(id => playerMap[id]),
      mixed_doubles: lineup.mixed_doubles.map(id => playerMap[id]),
    };
  }

  /**
   * Calculate encounter status based on lineup submissions
   */
  private calculateEncounterStatus(encounter: any, updatedField: string): string {
    const hasHomeLineup = encounter.home_lineup || updatedField === 'home_lineup';
    const hasAwayLineup = encounter.away_lineup || updatedField === 'away_lineup';
    
    if (hasHomeLineup && hasAwayLineup) {
      return 'ready';
    } else {
      return 'lineup_pending';
    }
  }

  /**
   * Auto-generate lineup for teams that didn't submit
   */
  async autoGenerateLineup(userId: string, encounterId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[InterclubService] Auto-generating lineup for encounter:', encounterId);

      // Get user's players
      const { data: players, error } = await this.supabase
        .from('players')
        .select('*')
        .eq('user_id', userId)
        .order('rank', { ascending: true }); // Best players first

      if (error || !players || players.length < 5) {
        return { success: false, error: 'Insufficient players for auto-generation' };
      }

      // Separate by gender
      const malePlayers = players.filter(p => p.gender === 'male');
      const femalePlayers = players.filter(p => p.gender === 'female');

      if (malePlayers.length < 3 || femalePlayers.length < 2) {
        return { success: false, error: 'Insufficient players by gender for auto-generation' };
      }

      // Generate lineup automatically
      const autoLineup = {
        mens_singles: malePlayers[0].id,
        womens_singles: femalePlayers[0].id,
        mens_doubles: [malePlayers[1].id, malePlayers[2].id] as [string, string],
        womens_doubles: [femalePlayers[1].id, femalePlayers[2]?.id || femalePlayers[0].id] as [string, string],
        mixed_doubles: [malePlayers[3]?.id || malePlayers[0].id, femalePlayers[1]?.id || femalePlayers[0].id] as [string, string]
      };

      const validation = this.validatePlayerUsageLimit(autoLineup);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Submit the auto-generated lineup
      const submission: LineupSubmission = {
        encounter_id: encounterId,
        lineup: autoLineup
      };

      return await this.submitLineup(userId, submission);
    } catch (error) {
      console.error('Error in autoGenerateLineup:', error);
      return { success: false, error: 'Failed to auto-generate lineup' };
    }
  }

  // ==========================================
  // MATCH EXECUTION
  // ==========================================

  /**
   * Execute interclub encounter (all 5 matches)
   */
  async executeEncounter(encounterId: string): Promise<{ success: boolean; error?: string; results?: any }> {
    try {
      console.log('[InterclubService] Executing encounter:', encounterId);

      // Get encounter details
      const { data: encounter, error } = await this.supabase
        .from('interclub_matches')
        .select('*')
        .eq('id', encounterId)
        .single();

      if (error || !encounter) {
        return { success: false, error: 'Encounter not found' };
      }

      if (encounter.status !== 'ready') {
        return { success: false, error: 'Encounter not ready for execution' };
      }

      // Parse lineups
      const homeLineup = JSON.parse(encounter.home_lineup || '{}');
      const awayLineup = JSON.parse(encounter.away_lineup || '{}');

      // Execute all 5 matches
      const matchResults = [];
      let homeWins = 0;
      let awayWins = 0;

      for (const matchType of MATCH_TYPES) {
        const result = await this.executeIndividualMatch(matchType, homeLineup.lineup, awayLineup.lineup);
        matchResults.push({
          match_type: matchType,
          ...result
        });

        if (result.winner === 'home') {
          homeWins++;
        } else {
          awayWins++;
        }
      }

      // Determine encounter winner
      const encounterWinner = homeWins > awayWins ? 'home' : 'away';
      const winnerTeamId = encounterWinner === 'home' ? encounter.home_team_id : encounter.away_team_id;
      const finalScore = `${homeWins}-${awayWins}`;

      // Update encounter with results
      const { error: updateError } = await this.supabase
        .from('interclub_matches')
        .update({
          status: 'completed',
          results: JSON.stringify(matchResults),
          winner_team_id: winnerTeamId,
          final_score: finalScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', encounterId);

      if (updateError) {
        console.error('Error updating encounter results:', updateError);
        return { success: false, error: updateError.message };
      }

      // Update group standings
      await this.updateGroupStandings(encounter.season_id, encounter.group_number);

      console.log('[InterclubService] Encounter executed successfully:', {
        finalScore,
        winner: encounterWinner
      });

      return {
        success: true,
        results: {
          finalScore,
          winner: encounterWinner,
          matchResults
        }
      };
    } catch (error) {
      console.error('Error in executeEncounter:', error);
      return { success: false, error: 'Failed to execute encounter' };
    }
  }

  /**
   * Execute individual match within an encounter
   */
  private async executeIndividualMatch(matchType: string, homeLineup: any, awayLineup: any): Promise<any> {
    try {
      // Get players for this match type
      const homePlayers = this.getPlayersForMatchType(matchType, homeLineup);
      const awayPlayers = this.getPlayersForMatchType(matchType, awayLineup);

      // For singles matches, simulate individual match
      if (matchType.includes('singles')) {
        return this.simulateSinglesMatch(homePlayers[0], awayPlayers[0]);
      }

      // For doubles matches, simulate team match
      return this.simulateDoublesMatch(homePlayers, awayPlayers);
    } catch (error) {
      console.error('Error executing individual match:', error);
      // Return random result as fallback
      const homePlayers = this.getPlayersForMatchType(matchType, homeLineup);
      const awayPlayers = this.getPlayersForMatchType(matchType, awayLineup);
      return {
        winner: Math.random() > 0.5 ? 'home' : 'away',
        score: '21-19, 21-17',
        players: {
          home: homePlayers,
          away: awayPlayers
        }
      };
    }
  }

  /**
   * Get players for specific match type from lineup
   */
  private getPlayersForMatchType(matchType: string, lineup: any): any[] {
    switch (matchType) {
      case 'mens_singles':
        return [lineup.mens_singles];
      case 'womens_singles':
        return [lineup.womens_singles];
      case 'mens_doubles':
        return lineup.mens_doubles;
      case 'womens_doubles':
        return lineup.womens_doubles;
      case 'mixed_doubles':
        return lineup.mixed_doubles;
      default:
        return [];
    }
  }

  /**
   * Simulate singles match
   */
  private simulateSinglesMatch(homePlayer: any, awayPlayer: any): any {
    // Calculate player strengths (simplified version of match service logic)
    const homeStrength = (homePlayer.rank || 500) + Math.random() * 100;
    const awayStrength = (awayPlayer.rank || 500) + Math.random() * 100;

    const winner = homeStrength > awayStrength ? 'home' : 'away';
    
    // Generate realistic score
    const strongerWon = winner === 'home' ? homeStrength > awayStrength : awayStrength > homeStrength;
    const scores = strongerWon 
      ? ['21-15, 21-18', '21-12, 21-16', '21-18, 19-21, 21-15']
      : ['19-21, 21-18, 21-19', '15-21, 21-19, 21-17'];
    
    return {
      winner,
      score: scores[Math.floor(Math.random() * scores.length)],
      players: {
        home: [homePlayer],
        away: [awayPlayer]
      }
    };
  }

  /**
   * Simulate doubles match
   */
  private simulateDoublesMatch(homePlayers: any[], awayPlayers: any[]): any {
    // Calculate team strengths
    const homeStrength = homePlayers.reduce((sum, player) => sum + (player.rank || 500), 0) / homePlayers.length;
    const awayStrength = awayPlayers.reduce((sum, player) => sum + (player.rank || 500), 0) / awayPlayers.length;

    // Add randomness
    const homePerformance = homeStrength * (0.8 + Math.random() * 0.4);
    const awayPerformance = awayStrength * (0.8 + Math.random() * 0.4);

    const winner = homePerformance > awayPerformance ? 'home' : 'away';
    
    // Generate realistic score
    const strongerWon = winner === 'home' ? homePerformance > awayPerformance : awayPerformance > homePerformance;
    const scores = strongerWon 
      ? ['21-15, 21-18', '21-12, 21-16', '21-18, 19-21, 21-15']
      : ['19-21, 21-18, 21-19', '15-21, 21-19, 21-17'];
    
    return {
      winner,
      score: scores[Math.floor(Math.random() * scores.length)],
      players: {
        home: homePlayers,
        away: awayPlayers
      }
    };
  }

  // ==========================================
  // STANDINGS & STATISTICS
  // ==========================================
  async getGroupStandings(seasonId: string, groupNumber: number): Promise<GroupStanding[]> {
    try {
      console.log("🏁 Start getGroupStandings", { seasonId, groupNumber });

      // Fetch completed encounters
      const { data: encounters, error } = await this.supabase
        .from('interclub_matches')
        .select('home_team_id, away_team_id, results')
        .eq('season_id', seasonId)
        .eq('group_number', groupNumber)
        .eq('status', 'completed');
      if (error) {
        console.error('❌ Error fetching encounters:', error);
        return [];
      }

      // Fetch registrations
      const { data: registrations, error: regError } = await this.supabase
        .from('interclub_registrations')
        .select('user_id, team_name')
        .eq('season_id', seasonId)
        .eq('group_assignment', groupNumber);
      if (regError) {
        console.error('❌ Error fetching registrations:', regError);
        return [];
      }

      // Initialize standings
      const standings: Record<string, GroupStanding> = {};
      registrations.forEach(reg => {
        standings[reg.user_id] = {
          team_id: reg.user_id,
          team_name: reg.team_name,
          is_cpu: false,
          position: 0,
          matches_played: 0,
          encounters_won: 0,
          encounters_lost: 0,
          individual_matches_won: 0,
          individual_matches_lost: 0,
          points: 0,
          form: []
        };
      });

      // Process each encounter
      encounters.forEach((enc, idx) => {
        const homeId = enc.home_team_id;
        const awayId = enc.away_team_id;
        standings[homeId].matches_played++;
        standings[awayId].matches_played++;

        // Parse results object: one key per category
        const raw = enc.results as Record<string, any>;
        let homeWins = 0;
        let awayWins = 0;

        Object.values(raw).forEach(slot => {
          // count points per individual match
          // assume summary included in slot.score or similar;
          if (slot.winner_team_id === homeId) homeWins++;
          else if (slot.winner_team_id === awayId) awayWins++;
        });

        standings[homeId].individual_matches_won += homeWins;
        standings[homeId].individual_matches_lost += awayWins;
        standings[awayId].individual_matches_won += awayWins;
        standings[awayId].individual_matches_lost += homeWins;

        // Encounter outcome
        if (homeWins > awayWins) {
          standings[homeId].encounters_won++;
          standings[homeId].points += 3;
          standings[homeId].form.push('W');
          standings[awayId].encounters_lost++;
          standings[awayId].form.push('L');
        } else if (awayWins > homeWins) {
          standings[awayId].encounters_won++;
          standings[awayId].points += 3;
          standings[awayId].form.push('W');
          standings[homeId].encounters_lost++;
          standings[homeId].form.push('L');
        } else {
          // draw
          standings[homeId].points += 1;
          standings[awayId].points += 1;
          standings[homeId].form.push('D');
          standings[awayId].form.push('D');
        }
      });

      // Sort and assign positions
      const sorted = Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.individual_matches_won - a.individual_matches_lost;
        const diffB = b.individual_matches_won - b.individual_matches_lost;
        return diffB - diffA;
      });
      sorted.forEach((s, idx) => {
        s.position = idx + 1;
        s.form = s.form.slice(-5);
      });

      return sorted;
    } catch (err) {
      console.error('🔥 Unexpected error in getGroupStandings:', err);
      return [];
    }
  }
  /**
   * Update group standings after an encounter
   */
  private async updateGroupStandings(seasonId: string, groupNumber: number): Promise<void> {
    try {
      // Recalculate standings
      const standings = await this.getGroupStandings(seasonId, groupNumber);
      
      // Update season with new standings
      const { data: season, error: seasonError } = await this.supabase
        .from('interclub_seasons')
        .select('groups')
        .eq('id', seasonId)
        .single();

      if (seasonError || !season) {
        console.error('Error fetching season for standings update');
        return;
      }

      const groups = JSON.parse(season.groups || '[]');
      const groupIndex = groups.findIndex((g: any) => g.group_number === groupNumber);
      
      if (groupIndex >= 0) {
        groups[groupIndex].standings = standings;
        
        await this.supabase
          .from('interclub_seasons')
          .update({
            groups: JSON.stringify(groups),
            updated_at: new Date().toISOString()
          })
          .eq('id', seasonId);
      }
    } catch (error) {
      console.error('Error updating group standings:', error);
    }
  }

  // ==========================================
  // USER INTERFACE METHODS
  // ==========================================

  /**
   * Get user's next encounter
   */
  async getUserNextEncounter(userId: string): Promise<InterclubEncounter | null> {
    try {
      // Step 1: Fetch next encounter match
      const { data: encounter, error } = await this.supabase
        .from('interclub_matches')
        .select('*')
        .or(`home_team_id.eq.${userId},away_team_id.eq.${userId}`)
        .in('status', ['lineup_pending'])
        .order('match_date', { ascending: true })
        .limit(1)
        .single();

      if (error || !encounter) {
        throw new Error('Match not found or error occurred');
      }

      
      // Step 2: Get home and away club names
      const [homeRes, awayRes] = await Promise.all([
        this.supabase
          .from('club_managers')
          .select('club_name')
          .eq('user_id', encounter.home_team_id)
          .single(),

        this.supabase
          .from('club_managers')
          .select('club_name')
          .eq('user_id', encounter.away_team_id)
          .single(),
      ]);

      const home_club = homeRes.data?.club_name ?? 'DUMMY CLUB';
      const away_club = awayRes.data?.club_name ?? 'DUMMY CLUB';

      // Step 2: Fetch team names using the IDs from the encounter
      const { data: teams, error: teamError } = await this.supabase
        .from('interclub_registrations')
        .select('user_id, team_name')
        .in('user_id', [encounter.home_team_id, encounter.away_team_id]);

      if (teamError) {
        console.error('Error fetching team names:', teamError);
        return null;
      }

      // Step 3: Match team names to their respective IDs
      const homeTeamName = teams.find(t => t.user_id === encounter.home_team_id)?.team_name || 'Unknown';
      const awayTeamName = teams.find(t => t.user_id === encounter.away_team_id)?.team_name || 'Unknown';

      console.log("Home team name ", homeTeamName);
      console.log("Away team name ", awayTeamName);

      // Step 4: Parse lineups safely
      const homeLineup = encounter.home_lineup ? JSON.parse(encounter.home_lineup) : null;
      const awayLineup = encounter.away_lineup ? JSON.parse(encounter.away_lineup) : null;

      console.log("Home lineup", homeLineup, "Away team ", awayLineup)

      // Step 5: Return enriched encounter object
      return {
        ...encounter,
        home_club: home_club,
        away_club: away_club,
        home_lineup: homeLineup,
        away_lineup: awayLineup,
        home_team_name: homeTeamName,
        away_team_name: awayTeamName,
        matches: []
      } as InterclubEncounter;
    } catch (error) {
      console.error('Error in getUserNextEncounter:', error);
      return null;
    }
  }

  /**
   * Get user's current season status
   */
  async getUserCurrentSeasonStatus(userId: string): Promise<any> {
    try {
      const { data: registrations, error } = await this.supabase
        .from('interclub_registrations')
        .select(`
          *,
          season:season_id(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching season status:', error);
        return null;
      }

      const activeRegistrations = registrations?.filter(reg => 
        reg.season.status === 'active' || reg.season.status === 'registration_closed'
      );

      if (activeRegistrations && activeRegistrations.length > 0) {
        const currentReg = activeRegistrations[0];
        const standings = await this.getGroupStandings(currentReg.season_id, currentReg.group_assignment);
        const userStanding = standings.find(s => s.team_id === userId);
        
        return {
          registration: currentReg,
          standing: userStanding,
          standings: standings
        };
      }

      return null;
    } catch (error) {
      console.error('Error in getUserCurrentSeasonStatus:', error);
      return null;
    }
  }
}