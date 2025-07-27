import { SupabaseClient } from '@supabase/supabase-js';

function generateInitialStats() {
  return {
    endurance: Math.floor(Math.random() * 20) + 40,
    strength: Math.floor(Math.random() * 20) + 40,
    agility: Math.floor(Math.random() * 20) + 40,
    speed: Math.floor(Math.random() * 20) + 40,
    explosiveness: Math.floor(Math.random() * 20) + 40,
    injury_prevention: Math.floor(Math.random() * 20) + 40,
    smash: Math.floor(Math.random() * 20) + 40,
    defense: Math.floor(Math.random() * 20) + 40,
    serve: Math.floor(Math.random() * 20) + 40,
    stick: Math.floor(Math.random() * 20) + 40,
    slice: Math.floor(Math.random() * 20) + 40,
    drop: Math.floor(Math.random() * 20) + 40,
  };
}

export function generateInitialStatLevels() {
  return {
    endurance: 0,
    strength: 0,
    agility: 0,
    speed: 0,
    explosiveness: 0,
    injury_prevention: 0,
    smash: 0,
    defense: 0,
    serve: 0,
    stick: 0,
    slice: 0,
    drop: 0,
  };
}

export function generateInitialStatLevelsFromStats(stats: Record<string, number>) {
  const levels: Record<string, number> = {};
  for (const key in stats) {
    const stat = stats[key];
    levels[key] = Math.floor(stat / 10);
  }
  return levels;
}

function generateInitialStrategy(): any {
  return {
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
  };
}

const maleFirstNames = [
  "Alex", "Jordan", "Morgan", "Taylor", "Sam", "Chris", "Pat", "Robin", "Jamie",
  "Lin", "Wei", "Chen", "Lee", "Kim", "Park", "Sato", "Tanaka", "Singh",
  "Thomas", "Martin", "Bernard", "Lucas", "Hugo", "Louis", "Nathan", "Gabriel", "Arthur"
];

const femaleFirstNames = [
  "Emma", "Marie", "Sophie", "Alice", "Julie", "Sarah", "Laura", "Clara", "Anna",
  "Mei", "Yuki", "Sakura", "Ji-eun", "Min", "Priya", "Ava", "Isabella", "Sophia",
  "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail", "Emily", "Elizabeth"
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Wang", "Li", "Zhang", "Liu", "Chen", "Kim", "Lee", "Park", "Singh", "Patel",
  "Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois",
  "Anderson", "Taylor", "Moore", "Jackson", "Thompson", "White", "Harris", "Clark"
];

export function generateRandomGender(): any {
  return Math.random() < 0.5 ? 'male' : 'female';
}

export function generateRandomName(gender: any): string {
  const firstNames = gender === 'male' ? maleFirstNames : femaleFirstNames;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Rarity = 'common' | 'rare' | 'epic' | 'premium' | 'legendary';

function chooseRarity(): { rarity: Rarity; max_level: number } {
  const roll = Math.random() * 100;
  if (roll < 0.5) {
    return {
      rarity: 'legendary',
      max_level: rand(400, 500),
    };
  } else if (roll < 2.0) {
    return {
      rarity: 'premium',
      max_level: rand(300, 400),
    };
  } else if (roll < 7.0) {
    return {
      rarity: 'epic',
      max_level: rand(220, 300),
    };
  } else if (roll < 25.0) {
    return {
      rarity: 'rare',
      max_level: rand(180, 220),
    };
  } else {
    return {
      rarity: 'common',
      max_level: rand(150, 180),
    };
  }
}

export class PlayerService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }
  
  async updatePlayerRank(playerId: string): Promise<{ success: boolean; error?: string }> {
    try {

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: matches, error: matchError } = await this.supabase
        .from('player_play_history')
        .select('*')
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false });

      if (matchError) {
        console.error('Error fetching match history:', matchError);
        return { success: false, error: matchError.message };
      }

      const pointTable: Record<string, number> = {
        P12: 5,
        P11: 7.67,
        P10: 12.67,
        D9: 17.67,
        D8: 22.67,
        D7: 27.67,
        R6: 34.33,
        R5: 42.67,
        R4: 51,
        N3: 62.67,
        N2: 77,
        N1: 93,
      };

      const rankFromPoints = (points: number): string => {
        if (points >= 451) return 'N1';
        if (points >= 371) return 'N2';
        if (points >= 301) return 'N3';
        if (points >= 251) return 'R4';
        if (points >= 201) return 'R5';
        if (points >= 161) return 'R6';
        if (points >= 131) return 'D7';
        if (points >= 101) return 'D8';
        if (points >= 71) return 'D9';
        if (points >= 41) return 'P10';
        if (points >= 21) return 'P11';
        return 'P12';
      };

      const winPoints: number[] = [];

      for (const match of matches || []) {

        const isPlayer1 = match.player1_id === playerId;
        const won = isPlayer1 ? match.result === true : match.result === false;


        if (!won) continue;

        const defeatedRankValue = isPlayer1 ? match.player2_rank : match.player1_rank;

        if (typeof defeatedRankValue !== 'number') continue;

        const defeatedRankLabel = rankFromPoints(defeatedRankValue);

        const earnedPoints = pointTable[defeatedRankLabel] || 0;

        winPoints.push(earnedPoints);
      }


      const top6Points = winPoints.sort((a, b) => b - a).slice(0, 6);

      const totalRankPoints = Number(top6Points.reduce((a, b) => a + b, 0).toFixed(2));

      const finalRank = rankFromPoints(totalRankPoints);

      const { error: updateError } = await this.supabase
        .from('players')
        .update({
          rank: totalRankPoints,
          rank_label: finalRank,
          updated_at: new Date().toISOString(),
        })
        .eq('id', playerId);

      if (updateError) {
        console.error('Error updating player rank:', updateError);
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updatePlayerRank:', error);
      return { success: false, error: 'Failed to update player rank' };
    }
  }

  async removeHealedInjuries(playerId: string, currentInjuries: any[]) {
    const now = Date.now();

    const activeInjuries = currentInjuries.filter(
      (injury) => injury.recoveryEndTime > now
    );

    if (activeInjuries.length === currentInjuries.length) return;

    const { error } = await this.supabase
      .from("players")
      .update({ injuries: activeInjuries })
      .eq("id", playerId);

    if (error) {
      console.error("Failed to update injuries:", error.message);
    }
  }

  /**
   * Get player with all related data
   */
  async getPlayerWithDetails(playerId: string) {
    try {
      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .eq('is_cpu', false)
        .single();

      if (playerError) {
        console.error('Error fetching player:', playerError);
        return null;
      }

      // Get player stats
      const { data: stats } = await this.supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', playerId)
        .single();

      // Get player levels
      const { data: levels } = await this.supabase
        .from('player_levels')
        .select('*')
        .eq('player_id', playerId)
        .single();

      // Get player strategy
      const { data: strategy } = await this.supabase
        .from('player_strategy')
        .select('*')
        .eq('player_id', playerId)
        .single();

      // Get player equipment
      const { data: equipment } = await this.supabase
        .from('player_equipment')
        .select('*')
        .eq('player_id', playerId);

      return {
        ...player,
        stats,
        levels,
        strategy,
        equipment
      };
    } catch (error) {
      console.error('Error in getPlayerWithDetails:', error);
      return null;
    }
  }

  /**
   * Create new real player with initial stats
   */
    async createPlayer(userId: string, name?: string, gender?: 'male'|'female') {
      try {
        const playerGender = gender ?? generateRandomGender();
         console.log("Creating real player. Gender ", playerGender)
        const { rarity, max_level } = chooseRarity();

        const statKeys = [
          'endurance','strength','agility','speed','explosiveness',
          'injury_prevention','smash','defense','serve','stick','slice','drop'
        ] as const;

        const initialStats = Object.fromEntries(statKeys.map((k) => [k, 0])) as Record<typeof statKeys[number], number>;
        const initialStrategy = generateInitialStrategy();
        const initialStatLevels = generateInitialStatLevelsFromStats(initialStats);
        const computedLevel = Object.values(initialStatLevels).reduce((sum, lvl) => sum + lvl, 0);

        const { data: player, error: playerError } = await this.supabase
          .from('players')
          .insert({
            user_id: userId,
            name: name || generateRandomName(playerGender),
            gender: playerGender,
            is_cpu: false,
            rarity,
            level: computedLevel,
            max_level,
            rank: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (playerError) throw playerError;

        await this.supabase.from('player_stats').insert({
          player_id: player.id,
          endurance: initialStats.endurance,
          strength: initialStats.strength,
          agility: initialStats.agility,
          speed: initialStats.speed,
          explosiveness: initialStats.explosiveness,
          injury_prevention: initialStats.injury_prevention,
          smash: initialStats.smash,
          defense: initialStats.defense,
          serve: initialStats.serve,
          stick: initialStats.stick,
          slice: initialStats.slice,
          drop: initialStats.drop,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        await this.supabase.from('player_levels').insert({
          player_id: player.id,
          endurance: initialStatLevels.endurance,
          strength: initialStatLevels.strength,
          agility: initialStatLevels.agility,
          speed: initialStatLevels.speed,
          explosiveness: initialStatLevels.explosiveness,
          injury_prevention: initialStatLevels.injury_prevention,
          smash: initialStatLevels.smash,
          defense: initialStatLevels.defense,
          serve: initialStatLevels.serve,
          stick: initialStatLevels.stick,
          slice: initialStatLevels.slice,
          drop: initialStatLevels.drop,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        await this.supabase.from('player_strategy').insert({
          player_id: player.id,
          physical_commitment: initialStrategy.physicalCommitment,
          play_style:       initialStrategy.playStyle,
          movement_speed:   initialStrategy.movementSpeed,
          fatigue_management: initialStrategy.fatigueManagement,
          rally_consistency: initialStrategy.rallyConsistency,
          risk_taking:      initialStrategy.riskTaking,
          attack:           initialStrategy.attack,
          soft_attack:      initialStrategy.softAttack,
          serving:          initialStrategy.serving,
          court_defense:    initialStrategy.courtDefense,
          mental_toughness: initialStrategy.mentalToughness,
          self_confidence:  initialStrategy.selfConfidence,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        return {
          success: true,
          player: {
            ...player,
            stats: initialStats,
            levels: initialStatLevels,
            strategy: initialStrategy,
            equipment: [],
          }
        };
      } catch (error: any) {
        console.error('Error in createPlayer:', error);
        return { success: false, error: error.message || 'Failed to create player' };
      }
  }

  /**
   * Create CPU player with specified skill level
   */
  async createCpuPlayer(
    cpuUserId: string,
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master' = 'beginner',
    teamName?: string,
    playerNumber?: number,
    gender?: 'male' | 'female'
  ) {
    try {
      const playerGender = gender || (Math.random() > 0.5 ? 'male' : 'female');
      console.log("Creating real player. Gender ", playerGender)
      const playerName = teamName && playerNumber 
        ? `${teamName} Player ${playerNumber}`
        : generateRandomName(playerGender);

      // Generate stats based on skill level
      const getStatValue = (skillLevel: string) => {
        switch (skillLevel) {
          case 'beginner': return Math.floor(Math.random() * 20) + 30; // 30-50
          case 'intermediate': return Math.floor(Math.random() * 20) + 50; // 50-70
          case 'advanced': return Math.floor(Math.random() * 20) + 70; // 70-90
          case 'expert': return Math.floor(Math.random() * 15) + 85; // 85-100
          case 'master': return Math.floor(Math.random() * 10) + 90; // 90-100
          default: return Math.floor(Math.random() * 20) + 40;
        }
      };

      const getLevel = (skillLevel: string) => {
        switch (skillLevel) {
          case 'beginner': return Math.floor(Math.random() * 3); // 0-2
          case 'intermediate': return Math.floor(Math.random() * 3) + 2; // 2-4
          case 'advanced': return Math.floor(Math.random() * 3) + 4; // 4-6
          case 'expert': return Math.floor(Math.random() * 3) + 6; // 6-8
          case 'master': return Math.floor(Math.random() * 3) + 8; // 8-10
          default: return Math.floor(Math.random() * 3);
        }
      };

      const getRank = (skillLevel: string) => {
        switch (skillLevel) {
          case 'beginner': return Math.floor(Math.random() * 50); // 0-50
          case 'intermediate': return Math.floor(Math.random() * 100) + 50; // 50-150
          case 'advanced': return Math.floor(Math.random() * 100) + 150; // 150-250
          case 'expert': return Math.floor(Math.random() * 150) + 250; // 250-400
          case 'master': return Math.floor(Math.random() * 150) + 400; // 400-550
          default: return 0;
        }
      };

      // Create CPU player
      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .insert({
          user_id: cpuUserId,
          name: playerName,
          level: Math.floor(Math.random() * 20) + 1,
          max_level: Math.floor(Math.random() * 50) + 150,
          rank: getRank(skillLevel),
          gender: playerGender,
          is_cpu: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (playerError) {
        console.error('Error creating CPU player:', playerError);
        return { success: false, error: playerError.message };
      }

      // Create stats based on skill level
      const { error: statsError } = await this.supabase
        .from('player_stats')
        .insert({
          player_id: player.id,
          endurance: getStatValue(skillLevel),
          strength: getStatValue(skillLevel),
          agility: getStatValue(skillLevel),
          speed: getStatValue(skillLevel),
          explosiveness: getStatValue(skillLevel),
          injury_prevention: getStatValue(skillLevel),
          smash: getStatValue(skillLevel),
          defense: getStatValue(skillLevel),
          serve: getStatValue(skillLevel),
          stick: getStatValue(skillLevel),
          slice: getStatValue(skillLevel),
          drop: getStatValue(skillLevel),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      console.log(statsError)
      if (statsError) {
        console.log('Error creating CPU player stats:', statsError);
        return { success: false, error: statsError.message };
      }

      // Create levels based on skill level
      const { error: levelsError } = await this.supabase
        .from('player_levels')
        .insert({
          player_id: player.id,
          endurance: getLevel(skillLevel),
          strength: getLevel(skillLevel),
          agility: getLevel(skillLevel),
          speed: getLevel(skillLevel),
          explosiveness: getLevel(skillLevel),
          injury_prevention: getLevel(skillLevel),
          smash: getLevel(skillLevel),
          defense: getLevel(skillLevel),
          serve: getLevel(skillLevel),
          stick: getLevel(skillLevel),
          slice: getLevel(skillLevel),
          drop: getLevel(skillLevel),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (levelsError) {
        console.log('Error creating CPU player levels:', levelsError);
        return { success: false, error: levelsError.message };
      }

      // Create strategy based on skill level
      const getStrategyValue = (skillLevel: string) => {
        switch (skillLevel) {
          case 'beginner': return Math.floor(Math.random() * 3) + 3; // 3-5
          case 'intermediate': return Math.floor(Math.random() * 3) + 4; // 4-6
          case 'advanced': return Math.floor(Math.random() * 3) + 5; // 5-7
          case 'expert': return Math.floor(Math.random() * 3) + 6; // 6-8
          case 'master': return Math.floor(Math.random() * 3) + 7; // 7-9
          default: return Math.floor(Math.random() * 3) + 4;
        }
      };

      const { error: strategyError } = await this.supabase
        .from('player_strategy')
        .insert({
          player_id: player.id,
          physical_commitment: getStrategyValue(skillLevel),
          play_style: getStrategyValue(skillLevel),
          movement_speed: getStrategyValue(skillLevel),
          fatigue_management: getStrategyValue(skillLevel),
          rally_consistency: getStrategyValue(skillLevel),
          risk_taking: getStrategyValue(skillLevel),
          attack: getStrategyValue(skillLevel),
          soft_attack: getStrategyValue(skillLevel),
          serving: getStrategyValue(skillLevel),
          court_defense: getStrategyValue(skillLevel),
          mental_toughness: getStrategyValue(skillLevel),
          self_confidence: getStrategyValue(skillLevel),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (strategyError) {
        console.log('Error creating CPU player strategy:', strategyError);
        return { success: false, error: strategyError.message };
      }

      return { success: true, player };
    } catch (error) {
      console.error('Error in createCpuPlayer:', error);
      return { success: false, error: 'Failed to create CPU player' };
    }
  }

  /**
   * Generate multiple CPU players for a team
   */
  async generateCpuPlayersForTeam(
    cpuUserId: string,
    teamId: string,
    teamName: string,
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master',
    playerCount: number,
    genderBalance: 'mixed' | 'male' | 'female' = 'mixed'
  ) {
    try {
      const players = [];
      
      for (let i = 1; i <= playerCount; i++) {
        let gender: 'male' | 'female';
        
        if (genderBalance === 'mixed') {
          gender = Math.random() > 0.5 ? 'male' : 'female';
        } else {
          gender = genderBalance;
        }

        const result = await this.createCpuPlayer(
          cpuUserId,
          skillLevel,
          teamName,
          i,
          gender
        );

        if (result.success && result.player) {
          players.push(result.player);
          
          // Associate player with team
          await this.supabase
            .from('player_team_assignments')
            .insert({
              team_id: teamId,
              player_id: result.player.id,
              assigned_at: new Date().toISOString()
            });
        }
      }

      return { success: true, players };
    } catch (error) {
      console.error('Error in generateCpuPlayersForTeam:', error);
      return { success: false, error: 'Failed to generate CPU players for team' };
    }
  }

  /**
   * Create quick CPU opponent for single matches
   */
  createQuickCpuOpponent(playerLevel: number) {
    const initialStats = generateInitialStats();
    const initialStatLevels = generateInitialStatLevels();
    const initialStrategy = generateInitialStrategy();
    const gender: 'male' | 'female' = Math.random() > 0.5 ? 'male' : 'female';

    return {
      id: `cpu-${Date.now()}`,
      name: generateRandomName(gender),
      gender,
      level: playerLevel,
      maxLevel: playerLevel + 10,
      stats: initialStats,
      statLevels: initialStatLevels,
      rank: Math.floor(Math.random() * 450),
      training: undefined,
      strategy: initialStrategy,
      equipment: {},
      injuries: [],
      best: []
    };
  }

  /**
   * Update player stats
   */
  async updatePlayerStats(playerId: string, stats: Record<string, number>) {
    try {
      const { error } = await this.supabase
        .from('player_stats')
        .update({
          endurance: stats.endurance,
          strength: stats.strength,
          agility: stats.agility,
          speed: stats.speed,
          explosiveness: stats.explosiveness,
          injury_prevention: stats.injury_prevention,
          smash: stats.smash,
          defense: stats.defense,
          serve: stats.serve,
          stick: stats.stick,
          slice: stats.slice,
          drop: stats.drop,
          updated_at: new Date().toISOString()
        })
        .eq('player_id', playerId);

      if (error) {
        console.error('Error updating player stats:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updatePlayerStats:', error);
      return { success: false, error: 'Failed to update player stats' };
    }
  }

  /**
   * Update player levels
   */
  async updatePlayerLevels(playerId: string, levels: Record<string, number>) {
    try {
      const { error: levelsError } = await this.supabase
        .from('player_levels')
        .update({
          endurance: levels.endurance,
          strength: levels.strength,
          agility: levels.agility,
          speed: levels.speed,
          explosiveness: levels.explosiveness,
          injury_prevention: levels.injury_prevention,
          smash: levels.smash,
          defense: levels.defense,
          serve: levels.serve,
          stick: levels.stick,
          slice: levels.slice,
          drop: levels.drop,
          updated_at: new Date().toISOString()
        })
        .eq('player_id', playerId);

      if (levelsError) {
        console.error('Error updating player levels:', levelsError);
        return { success: false, error: levelsError.message };
      }

      // 2) Recompute the player's overall level as the sum of all stat‐levels
      const totalLevel = Object.values(levels).reduce((sum, lvl) => sum + lvl, 0);

      // 3) Persist the new total into players.level
      const { error: playerError } = await this.supabase
        .from('players')
        .update({ level: totalLevel, updated_at: new Date().toISOString() })
        .eq('id', playerId);

      if (playerError) {
        console.error('Error syncing player.level:', playerError);
        return { success: false, error: playerError.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Unexpected error in updatePlayerLevels:', err);
      return { success: false, error: 'Failed to update player levels' };
    }
  }

  /**
   * Get players by user ID
   */
  async getPlayersByUserId(userId: string) {
    try {
      const { data, error } = await this.supabase
        .from('players')
        .select('*')
        .eq('user_id', userId)
        .eq('is_cpu', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching players by user ID:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPlayersByUserId:', error);
      return [];
    }
  }

  /**
   * Get player with team name
   */
  async getPlayerWithTeamName(playerId: string) {
    try {
      const { data, error } = await this.supabase
        .from('players')
        .select(`
          *,
          team_players!inner(
            teams!inner(
              name
            )
          )
        `)
        .eq('id', playerId)
        .eq('is_cpu', false)
        .single();

      if (error) {
        console.error('Error fetching player with team name:', error);
        return null;
      }

      return {
        ...data,
        teamName: data.team_players?.[0]?.teams?.name || 'No Team'
      };
    } catch (error) {
      console.error('Error in getPlayerWithTeamName:', error);
      return null;
    }
  }

  /**
   * Get multiple players with team names
   */
  async getPlayersWithTeamNames(playerIds: string[]) {
    try {
      const players = await Promise.all(
        playerIds.map(id => this.getPlayerWithTeamName(id))
      );

      return players.filter(player => player !== null);
    } catch (error) {
      console.error('Error in getPlayersWithTeamNames:', error);
      return [];
    }
  }

  /**
   * Update player name
   */
  async updatePlayerName(playerId: string, newName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('players')
        .update({
          name: newName,
          updated_at: new Date().toISOString()
        })
        .eq('id', playerId);

      if (error) {
        console.error('Error updating player name:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updatePlayerName:', error);
      return { success: false, error: 'Failed to update player name' };
    }
  }
} 