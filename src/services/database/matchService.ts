import { SupabaseClient } from '@supabase/supabase-js';
import { PlayerService } from './playerService';
import { TournamentService } from './tournamentService';

export class MatchService {
  private supabase: SupabaseClient;
  private playerService: PlayerService;
  private tournamentService: TournamentService;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.playerService = new PlayerService(supabaseClient);
    this.tournamentService = new TournamentService(supabaseClient);
  }

  /**
   * Execute match with simplified but comprehensive factor calculation
   */
  async executeTournamentMatch(
    matchId: string, 
  ): Promise<{ success: boolean; error?: string; matchData?: any }> {
    try {
      // Get match details
      const { data: match, error: matchError } = await this.supabase
        .from('match')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError) {
        console.error('Error fetching match:', matchError);
        return { success: false, error: matchError.message };
      }

      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      if (match.status !== 'pending') {
        return { success: false, error: 'Match already completed or in progress' };
      }

      const player1Data = await this.playerService.getPlayerWithDetails(match.player1_id);
      const player2Data = await this.playerService.getPlayerWithDetails(match.player2_id);


      // Handle bye matches
      // if (!match.player2_id) {
      //   const { error: updateError } = await this.supabase
      //     .from('match')
      //     .update({
      //       status: 'completed',
      //       completed: true,
      //       winner_id: match.player1_id,
      //       score: '21-0, 21-0',
      //       updated_at: new Date().toISOString()
      //     })
      //     .eq('id', matchId);

      //   if (updateError) {
      //     console.error('Error updating bye match:', updateError);
      //     return { success: false, error: updateError.message };
      //   }

      //   const matchResult = {
      //     winnerId: match.player1_id,
      //     winnerName: player1Data.name,
      //     score: '21-0, 21-0',
      //   }

      //   const { data: currentMatches } = await this.supabase
      //     .from('match')
      //     .select('*')
      //     .eq('tournament_id', match.tournament_id);

      //   const totalMatchCount = this.calcTotalTournamentMatchCount(match.tournament_id);
      //   if(currentMatches && currentMatches.filter((match: any) => match.status === 'pending').length === 0) {
      //     if(totalMatchCount === currentMatches.length) {
      //       console.log('All matches of tournament completed, tournament is over');
      //       await this.tournamentService.updateTournament(match.tournament_id, {
      //         status: 2,
      //         champion_id: matchResult.winnerId,
      //       });
      //     } else {
      //       console.log('All matches of current round completed, moving to next round');
      //       const tournament = await this.tournamentService.getTournamentById(match.tournament_id);
      //       const remainingPlayers = currentMatches.map((match: any) => match.winner_id);
      //       await this.tournamentService.generateMatches(match.tournament_id, tournament.round_interval_minutes, match.round_level + 1, remainingPlayers);
      //     }
      //   }


      //   return { success: true, matchData: matchResult };
      // }

      // Calculate player strengths with factors
      const player1Strength = this.calculatePlayerStrength(player1Data);
      const player2Strength = this.calculatePlayerStrength(player2Data);

      console.log('[Match Strengths]', {
        player1: { name: player1Data.name, strength: player1Strength },
        player2: { name: player2Data.name, strength: player2Strength }
      });

      // Simulate match
      const matchResult = this.simulateMatch(player1Data, player2Data, player1Strength, player2Strength);

      // Update match with result
      const { error: updateError } = await this.supabase
        .from('match')
        .update({
          status: 'completed',
          completed: true,
          winner_id: matchResult.winnerId,
          score: matchResult.score,
          actual_start_time: new Date().toISOString(),
          actual_end_time: new Date().toISOString()
        })
        .eq('id', matchId);

      if (updateError) {
        console.error('Error updating match:', updateError);
        return { success: false, error: updateError.message };
      }

      // Record match history
      await this.recordMatchHistory(match.player1_id, match.player2_id, matchResult);

      // Update player rankings using the instance method
      await Promise.all([
        this.playerService.updatePlayerRank(match.player1_id),
        this.playerService.updatePlayerRank(match.player2_id)
      ]);
      

      const matchResultFormatted = {
        winnerId: matchResult.winnerId,
        winnerName: matchResult.winnerId === match.player1_id ? player1Data.name : player2Data.name,
        score: matchResult.score,
      }

      const { data: allMatches } = await this.supabase
        .from('match')
        .select('*')
        .eq('tournament_id', match.tournament_id);

      const currentRountMatchCount = allMatches?.filter((match: any) => match.round_level === match.round_level).length || 0;


      if(currentRountMatchCount === 1) {
        console.log('All matches of tournament completed, tournament is over');
        await this.tournamentService.updateTournament(match.tournament_id, {
          status: 2,
          champion_id: matchResult.winnerId,
        });

      } else {
        console.log('All matches of current round completed, moving to next round');
        const tournament = await this.tournamentService.getTournamentById(match.tournament_id);
        const remainingPlayers = allMatches?.filter((one:any) => one.round_level === match.round_level).map((one: any) => one.winner_id) || [];
        console.log('remainingPlayers', remainingPlayers);
        await this.tournamentService.generateMatches(match.tournament_id, tournament.round_interval_minutes, match.round_level + 1, remainingPlayers);
      }
      return { success: true, matchData: matchResultFormatted };

    } catch (error) {
      console.error('Error in executeTournamentMatch:', error);
      return { success: false, error: 'Failed to execute match' };
    }
  }

  /**
   * Calculate player strength with key factors
   */
  private calculatePlayerStrength(player: any): number {
    const stats = player.stats || {};
    const levels = player.levels || {};
    const strategy = player.strategy || {};
    
    // Physical strength (25%)
    const physicalStrength = (
      (stats.endurance || 50) * (levels.endurance || 1) +
      (stats.strength || 50) * (levels.strength || 1) +
      (stats.agility || 50) * (levels.agility || 1) +
      (stats.speed || 50) * (levels.speed || 1) +
      (stats.explosiveness || 50) * (levels.explosiveness || 1)
    ) / 5;

    // Technical skills (35%)
    const technicalSkills = (
      (stats.smash || 50) * (levels.smash || 1) +
      (stats.defense || 50) * (levels.defense || 1) +
      (stats.serve || 50) * (levels.serve || 1) +
      (stats.stick || 50) * (levels.stick || 1) +
      (stats.slice || 50) * (levels.slice || 1) +
      (stats.drop || 50) * (levels.drop || 1)
    ) / 6;

    // Mental strength (20%)
    const mentalStrength = (
      (strategy.mental_toughness || 5) * 10 +
      (strategy.self_confidence || 5) * 10 +
      (stats.injury_prevention || 50) * (levels.injury_prevention || 1)
    ) / 3;

    // Experience (10%)
    const experience = (player.level || 1) * 2 + Math.max(0, (1000 - (player.rank || 1000)) / 20);

    // Strategy effectiveness (10%)
    const strategyEffectiveness = (
      (strategy.rally_consistency || 5) * 10 +
      (strategy.attack || 5) * 10 +
      (strategy.court_defense || 5) * 10
    ) / 3;

    // Calculate weighted total
    const baseStrength = (
      physicalStrength * 0.25 +
      technicalSkills * 0.35 +
      mentalStrength * 0.20 +
      experience * 0.10 +
      strategyEffectiveness * 0.10
    );

    // Apply modifiers
    const equipmentBonus = this.calculateEquipmentBonus(player.equipment);
    const injuryPenalty = this.calculateInjuryPenalty(player.injuries);
    const formFactor = this.calculateFormFactor(player);

    const finalStrength = Math.max(10, baseStrength + equipmentBonus - injuryPenalty + formFactor);

    return finalStrength;
  }

  /**
   * Calculate equipment bonus
   */
  private calculateEquipmentBonus(equipment: any[]): number {
    if (!Array.isArray(equipment) || equipment.length === 0) return 0;
    
    let bonus = 0;
    equipment.forEach(item => {
      if (item && item.stats) {
        // Sum equipment stat bonuses
        Object.values(item.stats).forEach((statValue: any) => {
          if (typeof statValue === 'number') {
            bonus += statValue * 0.1;
          }
        });
      } else {
        // Simple equipment bonus
        bonus += 1;
      }
    });
    
    return Math.min(bonus, 15); // Cap at 15 points
  }

  /**
   * Calculate injury penalty
   */
  private calculateInjuryPenalty(injuries: any[]): number {
    if (!Array.isArray(injuries) || injuries.length === 0) return 0;
    
    const activeInjuries = injuries.filter(injury => 
      injury.recoveryEndTime && injury.recoveryEndTime > Date.now()
    );
    
    return activeInjuries.reduce((penalty, injury) => {
      const severity = injury.severity || 1;
      return penalty + (severity * 3); // Each injury point reduces strength by 3
    }, 0);
  }

  /**
   * Calculate form factor based on recent performance
   */
  private calculateFormFactor(player: any): number {
    const recentMatches = player.recent_matches || [];
    if (recentMatches.length === 0) return 0;
    
    const recentWins = recentMatches.filter((m: any) => m.winner_id === player.id).length;
    const winRate = recentWins / recentMatches.length;
    
    // Convert win rate to bonus/penalty (-5 to +5)
    return (winRate - 0.5) * 10;
  }

  /**
   * Simulate match between two players
   */
  private simulateMatch(player1: any, player2: any, strength1: number, strength2: number) {
    // Add performance variance
    const variance1 = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
    const variance2 = 0.85 + Math.random() * 0.3;
    
    const finalStrength1 = strength1 * variance1;
    const finalStrength2 = strength2 * variance2;

    // Determine winner
    const winnerId = finalStrength1 > finalStrength2 ? player1.id : player2.id;
    const winner = winnerId === player1.id ? player1 : player2;
    const loser = winnerId === player1.id ? player2 : player1;

    // Generate match score
    const matchScore = this.generateMatchScore(finalStrength1, finalStrength2);
    const duration = this.calculateMatchDuration(Math.abs(finalStrength1 - finalStrength2));

    return {
      winnerId,
      score: matchScore.score,
      matchData: {
        player1_strength: strength1,
        player2_strength: strength2,
        player1_final_strength: finalStrength1,
        player2_final_strength: finalStrength2,
        performance_variance: { player1: variance1, player2: variance2 },
        winner_name: winner.name,
        loser_name: loser.name,
        match_duration: duration,
        strength_difference: Math.abs(finalStrength1 - finalStrength2)
      }
    };
  }

  /**
   * Generate realistic match score
   */
  private generateMatchScore(strength1: number, strength2: number) {
    const totalStrength = strength1 + strength2;
    const player1WinProb = strength1 / totalStrength;
    
    const sets = [];
    let player1Sets = 0;
    let player2Sets = 0;

    // Play best of 3 sets
    while (player1Sets < 2 && player2Sets < 2) {
      const setResult = this.simulateSet(player1WinProb);
      sets.push(setResult);
      
      if (setResult.winner === 1) {
        player1Sets++;
      } else {
        player2Sets++;
      }
    }

    // Format score as "21-13, 21-15" style
    const scoreString = sets.map(set => `${set.player1Score}-${set.player2Score}`).join(', ');

    return {
      score: scoreString,
      winner: player1Sets > player2Sets ? 1 : 2
    };
  }

  /**
   *  Calculate total match counts from player count
   */
  public calcTotalTournamentMatchCount(playerCount: number) {
    return playerCount - 1;
  }

  /**
   * Simulate a single set
   */
  private simulateSet(player1WinProb: number) {
    let player1Score = 0;
    let player2Score = 0;

    // Play to 21 points (must win by 2)
    while (true) {
      if (Math.random() < player1WinProb) {
        player1Score++;
      } else {
        player2Score++;
      }

      // Check win conditions
      if (player1Score >= 21 || player2Score >= 21) {
        if (Math.abs(player1Score - player2Score) >= 2) {
          break;
        }
      }

      // Cap at 30 points
      if (player1Score >= 30 || player2Score >= 30) {
        break;
      }
    }

    return {
      player1Score,
      player2Score,
      winner: player1Score > player2Score ? 1 : 2
    };
  }

  /**
   * Calculate match duration based on competitiveness
   */
  private calculateMatchDuration(strengthDifference: number): number {
    const baseDuration = 45; // Base 45 minutes
    const competitiveness = Math.max(0.8, 1.2 - (strengthDifference / 100));
    return Math.floor(baseDuration * competitiveness + Math.random() * 15);
  }

  /**
   * Record match in play history
   */
  private async recordMatchHistory(player1Id: string, player2Id: string, matchResult: any) {
    try {
      await this.supabase
        .from('player_play_history')
        .insert({
          player1_id: player1Id,
          player2_id: player2Id,
          result: matchResult.winnerId === player1Id,
          player1_rank: matchResult.matchData.player1_final_strength,
          player2_rank: matchResult.matchData.player2_final_strength,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error recording match history:', error);
    }
  }

  /**
   * Get match details with player information
   */
  async getMatchWithDetails(matchId: string) {
    try {
      const { data: match, error } = await this.supabase
        .from('match')
        .select(`
          *,
          player1:player1_id(
            id,
            name,
            level,
            rank
          ),
          player2:player2_id(
            id, 
            name,
            level,
            rank
          )
        `)
        .eq('id', matchId)
        .single();

      if (error) {
        console.error('Error fetching match details:', error);
        return null;
      }

      return match;
    } catch (error) {
      console.error('Error in getMatchWithDetails:', error);
      return null;
    }
  }
  
} 