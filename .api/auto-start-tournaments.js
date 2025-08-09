import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';
const INJURIES = [
  {
    type: 'Ankle sprain',
    severity: 'minor',
    recovery: 30,
    affectedStats: [
      'speed',
      'agility'
    ],
    statPenalty: 20
  },
  {
    type: 'Muscle strain',
    severity: 'minor',
    recovery: 45,
    affectedStats: [
      'strength',
      'explosiveness'
    ],
    statPenalty: 25
  },
  {
    type: 'Knee pain',
    severity: 'moderate',
    recovery: 60,
    affectedStats: [
      'speed',
      'agility',
      'explosiveness'
    ],
    statPenalty: 30
  },
  {
    type: 'Wrist sprain',
    severity: 'moderate',
    recovery: 90,
    affectedStats: [
      'smash',
      'defense',
      'serve'
    ],
    statPenalty: 35
  },
  {
    type: 'Back injury',
    severity: 'severe',
    recovery: 120,
    affectedStats: [
      'endurance',
      'strength',
      'agility',
      'speed',
      'explosiveness'
    ],
    statPenalty: 40
  }
];
class TournamentService {
  supabase;
  constructor(){
    this.supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  }
  async getOrCreateRound(tournamentId, level) {
    const { data: existing } = await this.supabase.from('round').select('id').eq('tournament_id', tournamentId).eq('level', level).single();
    if (existing) return existing.id;
    const { data: inserted } = await this.supabase.from('round').insert({
      tournament_id: tournamentId,
      level,
      name: `Round ${level}`
    }).select('id').single();
    return inserted.id;
  }
  async getPlayerStats(playerId) {
    const { data } = await this.supabase.from('player_stats').select('*').eq('player_id', playerId).single();
    return data;
  }
  calculateScore(stats) {
    const weights = {
      endurance: 0.1,
      strength: 0.1,
      agility: 0.1,
      speed: 0.1,
      explosiveness: 0.1,
      injury_prevention: 0.05,
      smash: 0.15,
      defense: 0.15,
      serve: 0.15,
      stick: 0.05,
      slice: 0.025,
      drop: 0.025
    };
    return Object.entries(weights).reduce((total, [key, weight])=>{
      const value = stats[key] ?? 0;
      return total + value * weight;
    }, 0);
  }
  async generateMatchResult(player1Id, player2Id) {
    if (!player2Id) {
      return {
        winnerId: player1Id,
        score: '21-0, 21-0',
        completed: true,
        status: 'bye'
      };
    }
    const [stats1, stats2] = await Promise.all([
      this.getPlayerStats(player1Id),
      this.getPlayerStats(player2Id)
    ]);
    const score1 = this.calculateScore(stats1);
    console.log("Score 1 : ", score1, "stats 1 : ", stats1);
    const score2 = this.calculateScore(stats2);
    console.log("Score 2 : ", score1, "stats 2 : ", stats2);
    const games = [];
    let wins1 = 0;
    let wins2 = 0;
    while(wins1 < 2 && wins2 < 2){
      let p1, p2;
      if (score1 > score2) {
        // Player 1 wins this game convincingly
        p1 = 11;
        p2 = Math.floor(4 + Math.random() * 4); // 4–7
        wins1++;
      } else if (score2 > score1) {
        // Player 2 wins this game convincingly
        p2 = 11;
        p1 = Math.floor(4 + Math.random() * 4); // 4–7
        wins2++;
      } else {
        // Scores are equal — simulate a close game and randomly assign the winner
        const winner = Math.random() < 0.5 ? 'p1' : 'p2';
        const loserScore = Math.floor(9 + Math.random() * 2); // 9–10
        if (winner === 'p1') {
          p1 = 11;
          p2 = loserScore;
          wins1++;
        } else {
          p2 = 11;
          p1 = loserScore;
          wins2++;
        }
      }
      games.push(`${p1}-${p2}`);
    }
    return {
      winnerId: wins1 > wins2 ? player1Id : player2Id,
      score: games.join(', '),
      completed: true,
      status: 'completed'
    };
  }
  calculateInjuryRisk(stats) {
    const base = 0.8;
    const prevention = (stats.injury_prevention ?? 0) / 200;
    return Math.max(0.3, base - prevention);
  }
  simulateInjury(playerStats, existingInjuries) {
    const risk = this.calculateInjuryRisk(playerStats);
    if (Math.random() >= risk) return null;
    const injury = INJURIES[Math.floor(Math.random() * INJURIES.length)];
    const now = Date.now();
    const affectedStats = {};
    for (const stat of injury.affectedStats || []){
      affectedStats[stat] = Math.max(0, (playerStats[stat] ?? 0) - (injury.statPenalty ?? 0));
    }
    return {
      id: `injury-${now}-${Math.random().toString(36).slice(2)}`,
      type: injury.type,
      severity: injury.severity,
      recoveryTime: injury.recovery * 60 * 1000,
      recoveryEndTime: now + injury.recovery * 60 * 1000,
      affectedStats,
      createdAt: now
    };
  }
  async generateMatches(tournamentId, interval, level, players, startTime) {
    const roundId = await this.getOrCreateRound(tournamentId, level);
    const shuffled = [
      ...players
    ].sort(()=>Math.random() - 0.5);
    const matches = [];
    for(let i = 0; i < shuffled.length; i += 2){
      const p1 = shuffled[i]?.player_id;
      const p2 = shuffled[i + 1]?.player_id ?? null;
      const result = await this.generateMatchResult(p1, p2);
      const scheduled = new Date(startTime.getTime() + interval * 60000);
      const end = new Date(scheduled.getTime() + interval * 60000);
      matches.push({
        round_id: roundId,
        tournament_id: tournamentId,
        player1_id: p1,
        player2_id: p2,
        winner_id: result.winnerId,
        round_level: level,
        completed: result.completed,
        status: result.status,
        score: result.score,
        scheduled_start_time: scheduled.toISOString(),
        actual_start_time: scheduled.toISOString(),
        actual_end_time: end.toISOString()
      });
    }
    await this.supabase.from("match").insert(matches);
    for (const match of matches){
      const [p1, p2] = [
        match.player1_id,
        match.player2_id
      ].filter(Boolean);
      const [s1, s2] = await Promise.all([
        this.supabase.from("players").select("rank").eq("id", p1).single(),
        p2 ? this.supabase.from("players").select("rank").eq("id", p2).single() : {}
      ]);
      await this.supabase.from("player_play_history").insert({
        player1_id: p1,
        player2_id: p2,
        result: match.winner_id === p1,
        player1_rank: s1?.data?.rank ?? null,
        player2_rank: s2?.data?.rank ?? null,
        created_at: new Date().toISOString()
      });
      for (const playerId of [
        p1,
        p2
      ].filter(Boolean)){
        const { data: player } = await this.supabase.from("players").select("injuries").eq("id", playerId).single();
        const { data: stats } = await this.supabase.from("player_stats").select("*").eq("player_id", playerId).single();
        if (!stats) continue;
        const newInjury = this.simulateInjury(stats, player?.injuries ?? []);
        if (newInjury) {
          await this.supabase.from("players").update({
            injuries: [
              ...player?.injuries || [],
              newInjury
            ]
          }).eq("id", playerId);
        }
      }
    }
    return {
      success: true,
      nextRoundStart: new Date(startTime.getTime() + interval * 60000)
    };
  }
  async updatePlayerRank(playerId) {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: matches, error: matchError } = await this.supabase.from('player_play_history').select('*').or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`).gte('created_at', ninetyDaysAgo).order('created_at', {
        ascending: false
      });
      if (matchError) {
        console.error('Error fetching match history:', matchError);
        return {
          success: false,
          error: matchError.message
        };
      }
      const pointTable = {
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
        N1: 93
      };
      const rankFromPoints = (points)=>{
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
      const winPoints = [];
      for (const match of matches || []){
        const isPlayer1 = match.player1_id === playerId;
        const won = isPlayer1 ? match.result === true : match.result === false;
        if (!won) continue;
        const defeatedRankValue = isPlayer1 ? match.player2_rank : match.player1_rank;
        if (typeof defeatedRankValue !== 'number') continue;
        const defeatedRankLabel = rankFromPoints(defeatedRankValue);
        const earnedPoints = pointTable[defeatedRankLabel] || 0;
        winPoints.push(earnedPoints);
      }
      const top6Points = winPoints.sort((a, b)=>b - a).slice(0, 6);
      const totalRankPoints = Number(top6Points.reduce((a, b)=>a + b, 0).toFixed(2));
      const finalRank = rankFromPoints(totalRankPoints);
      const { error: updateError } = await this.supabase.from('players').update({
        rank: totalRankPoints,
        rank_label: finalRank,
        updated_at: new Date().toISOString()
      }).eq('id', playerId);
      if (updateError) {
        console.error('Error updating player rank:', updateError);
        return {
          success: false,
          error: updateError.message
        };
      }
      return {
        success: true
      };
    } catch (error) {
      console.error('Error in updatePlayerRank:', error);
      return {
        success: false,
        error: 'Failed to update player rank'
      };
    }
  }
  async updateAllPlayerRanks() {
    const { data: players, error } = await this.supabase.from('players').select('id').eq('is_cpu', true);
    if (error) {
      console.error('Error fetching players:', error);
      return;
    }
    if (!players || players.length === 0) {
      console.log('No players found.');
      return;
    }
    for (const player of players){
      try {
        await this.updatePlayerRank(player.id);
      } catch (err) {
        console.error(`Failed to update rank for player ${player.id}:`, err);
      }
    }
    console.log('Finished updating all player ranks.');
  }
}
serve(async ()=>{
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const svc = new TournamentService();
  const now = new Date();
  const { data: newTournaments } = await supabase.from('tournament_list').select('id, max_participants, round_interval_minutes, registered_players, end_date, min_player_level').eq('status', 0).lte('start_date', now.toISOString());
  for (const t of newTournaments || []){
    const nowISO = now.toISOString();
    const registeredPlayers = t.registered_players || [];
    const players = registeredPlayers.map((r)=>({
        player_id: r.player_id
      }));
    const missing = (t.max_participants ?? 0) - players.length;
    console.log("Missing", missing);
    console.log("Max participants", t.max_participants);
    let bots = [];
    if (missing > 0) {
      // Collect IDs of already registered players
      const existingPlayerIds = new Set(registeredPlayers.map((p)=>p.player_id));
      const { data: fetchedBots } = await supabase.from('players').select('id, name, user_id').eq('is_cpu', true).gte('level', t.min_player_level);
      const availableBots = (fetchedBots || []).filter((bot)=>!existingPlayerIds.has(bot.id)).slice(0, missing);
      bots = availableBots.map((p)=>({
          player_id: p.id
        }));
      players.push(...bots);
      console.log("Number of fetched bots", bots.length);
      // Update registered_players by appending bot entries
      const botEntries = bots.map((b)=>({
          player_id: b.player_id,
          player_name: b.name,
          user_id: b.user_id,
          team_name: 'Bot Team',
          registered_at: nowISO
        }));
      const updatedRegisteredPlayers = [
        ...registeredPlayers,
        ...botEntries
      ];
      await supabase.from('tournament_list').update({
        registered_players: updatedRegisteredPlayers,
        current_participants: updatedRegisteredPlayers.length,
        status: 1,
        updated_at: nowISO,
        current_round_level: 1
      }).eq('id', t.id);
    } else {
      await supabase.from('tournament_list').update({
        status: 1,
        updated_at: nowISO,
        current_round_level: 1
      }).eq('id', t.id);
    }
    const { success, nextRoundStart } = await svc.generateMatches(t.id, t.round_interval_minutes, 1, players, now);
    if (success) {
      await supabase.from('tournament_list').update({
        next_round_start_time: nextRoundStart.toISOString()
      }).eq('id', t.id);
    }
  }
  const { data: ongoingTournaments } = await supabase.from('tournament_list').select('id, round_interval_minutes, next_round_start_time, current_round_level').eq('status', 1);
  for (const t of ongoingTournaments || []){
    console.log("Found 1 ongoing tournament ", t.id);
    const nextStart = new Date(t.next_round_start_time);
    if (nextStart.getTime() > Date.now()) continue;
    const { data: allMatches } = await supabase.from('match').select('round_level, completed').eq('tournament_id', t.id);
    const currentRoundMatches = allMatches.filter((m)=>m.round_level === t.current_round_level);
    if (!currentRoundMatches.every((m)=>m.completed)) continue;
    const { data: roundWinners } = await supabase.from('match').select('winner_id').eq('tournament_id', t.id).eq('round_level', t.current_round_level);
    const winners = roundWinners?.map((r)=>({
        player_id: r.winner_id
      }));
    if (winners.length >= 2) {
      console.log("More than two winners, proceeding to the next round");
      const roundStart = new Date();
      const { success, nextRoundStart } = await svc.generateMatches(t.id, t.round_interval_minutes, t.current_round_level + 1, winners, roundStart);
      if (success) {
        await supabase.from('tournament_list').update({
          current_round_level: t.current_round_level + 1,
          next_round_start_time: nextRoundStart.toISOString(),
          updated_at: roundStart.toISOString()
        }).eq('id', t.id);
        const { data: roundWinners } = await supabase.from('match').select('winner_id').eq('tournament_id', t.id).eq('round_level', t.current_round_level + 1);
        const winners = roundWinners?.map((r)=>({
            player_id: r.winner_id
          }));
        if (winners?.length == 1) {
          console.log("Only one winner remaining, tournament status ended ", t.id);
          await supabase.from('tournament_list').update({
            status: 2,
            updated_at: now.toISOString(),
            next_round_start_time: null
          }).eq('id', t.id);
          // Get previous round level
          const finalRoundLevel = t.current_round_level;
          // Get all matches from the previous round (final round)
          const { data: finalRoundMatches } = await supabase.from("match").select("player1_id, player2_id, winner_id").eq("tournament_id", t.id).eq("round_level", finalRoundLevel);
          // Determine 1st, 2nd, and 3rd
          const firstPlaceId = winners[0]?.player_id;
          const finalMatch = finalRoundMatches.find((m)=>m.winner_id === firstPlaceId);
          const secondPlaceId = finalMatch?.player1_id === firstPlaceId ? finalMatch?.player2_id : finalMatch?.player1_id;
          // Determine third place: loser from semifinals with better score
          const { data: semiFinalMatches } = await supabase.from("match").select("player1_id, player2_id, winner_id").eq("tournament_id", t.id).eq("round_level", finalRoundLevel - 1);
          const thirdPlaceCandidateIds = semiFinalMatches.map((m)=>m.winner_id === firstPlaceId || m.winner_id === secondPlaceId ? m.player1_id === m.winner_id ? m.player2_id : m.player1_id : null).filter(Boolean);
          const thirdPlaceId = thirdPlaceCandidateIds[0]; // pick one — or apply more logic
          const prizeTypes = [
            "first",
            "second",
            "third"
          ];
          const winnerIds = [
            firstPlaceId,
            secondPlaceId,
            thirdPlaceId
          ];
          console.log("Winner Ids", winnerIds);
          const { data: tournament } = await supabase.from("tournament_list").select("prize_pool").eq("id", t.id).single();
          for(let i = 0; i < 3; i++){
            const prize = tournament?.prize_pool?.[prizeTypes[i]];
            console.log("Prize ", prize);
            const { data: playerData } = await supabase.from("players").select("user_id").eq("id", winnerIds[i]).single();
            console.log("Players users ids ", playerData);
            const userId = playerData?.user_id;
            console.log("User id to award ", playerData?.user_id);
            for (const [resource_type, amount] of Object.entries(prize || {})){
              if (amount > 0) {
                console.log("Amount is greater than 0, amount : ", amount);
                const { error: error } = await supabase.from("resource_transactions").insert({
                  user_id: userId,
                  resource_type,
                  amount,
                  source: "tournament_reward",
                  source_id: t.id
                });
                if (error) {
                  console.log(error);
                }
              } else {
                console.log("Amount is not greater than 0, amount : ", amount);
              }
            }
          }
          svc.updateAllPlayerRanks();
        }
      }
    } else {
      console.log("Only one winner remaining, tournament status ended ", t.id);
      await supabase.from('tournament_list').update({
        status: 2,
        updated_at: now.toISOString(),
        next_round_start_time: null
      }).eq('id', t.id);
      // Get previous round level
      const finalRoundLevel = t.current_round_level;
      // Get all matches from the previous round (final round)
      const { data: finalRoundMatches } = await supabase.from("match").select("player1_id, player2_id, winner_id").eq("tournament_id", t.id).eq("round_level", finalRoundLevel);
      // Determine 1st, 2nd, and 3rd
      const firstPlaceId = winners[0]?.player_id;
      const finalMatch = finalRoundMatches.find((m)=>m.winner_id === firstPlaceId);
      const secondPlaceId = finalMatch?.player1_id === firstPlaceId ? finalMatch?.player2_id : finalMatch?.player1_id;
      // Determine third place: loser from semifinals with better score
      const { data: semiFinalMatches } = await supabase.from("match").select("player1_id, player2_id, winner_id").eq("tournament_id", t.id).eq("round_level", finalRoundLevel - 1);
      const thirdPlaceCandidateIds = semiFinalMatches.map((m)=>m.winner_id === firstPlaceId || m.winner_id === secondPlaceId ? m.player1_id === m.winner_id ? m.player2_id : m.player1_id : null).filter(Boolean);
      const thirdPlaceId = thirdPlaceCandidateIds[0]; // pick one — or apply more logic
      const prizeTypes = [
        "first",
        "second",
        "third"
      ];
      const winnerIds = [
        firstPlaceId,
        secondPlaceId,
        thirdPlaceId
      ];
      console.log("Winner Ids", winnerIds);
      const { data: tournament } = await supabase.from("tournament_list").select("prize_pool").eq("id", t.id).single();
      for(let i = 0; i < 3; i++){
        const prize = tournament?.prize_pool?.[prizeTypes[i]];
        console.log("Prize ", prize);
        const { data: playerData } = await supabase.from("players").select("user_id").eq("id", winnerIds[i]).single();
        console.log("Players users ids ", playerData);
        const userId = playerData?.user_id;
        for (const [resource_type, amount] of Object.entries(prize || {})){
          if (amount > 0) {
            const { error: error } = await supabase.from("resource_transactions").insert({
              user_id: userId,
              resource_type,
              amount,
              source: "tournament_reward",
              source_id: t.id
            });
            if (error) {
              console.log(error);
            }
          }
        }
      }
      svc.updateAllPlayerRanks();
    }
  }
  return new Response('Tournament cron completed', {
    status: 200
  });
});
