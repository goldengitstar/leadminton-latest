import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Initialize Supabase client
const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
// Injury configuration
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
// --- Rating Helpers ---
function computePlayerRating(p) {
  // Sum of level stats (now including strength, injury_prevention, stick, slice)
  const levelTotal = p.player_levels.smash + p.player_levels.defense + p.player_levels.serve + p.player_levels.explosiveness + p.player_levels.speed + p.player_levels.endurance + p.player_levels.agility + p.player_levels.strength + p.player_levels.injury_prevention + p.player_levels.stick + p.player_levels.slice;
  // Sum of the new strategy fields only
  const strat = p.strategy;
  const strategyTotal = strat.physical_commitment + strat.play_style + strat.movement_speed + strat.fatigue_management + strat.rally_consistency + strat.risk_taking + strat.attack + strat.soft_attack + strat.serving + strat.court_defense + strat.mental_toughness + strat.self_confidence;
  // Weighted combination
  return 0.4 * levelTotal + 0.3 * strategyTotal;
}
function computeLineupRating(slot) {
  console.log("Computing lineup rating");
  if (Array.isArray(slot)) {
    return (computePlayerRating(slot[0]) + computePlayerRating(slot[1])) / 2;
  }
  return computePlayerRating(slot);
}
function simulateCategory(homeRating, awayRating) {
  const homeIsStronger = homeRating >= awayRating;
  let homeWins = 0, awayWins = 0;
  const games = [];
  // 1) Compute a "base margin" from the rating difference (scaled into 1-10)
  const diff = Math.abs(homeRating - awayRating);
  const baseMargin = Math.min(10, Math.max(1, Math.floor(diff / 5)));
  // 2) Build a small sequence of margins for each game
  const margins = [
    baseMargin,
    Math.min(10, baseMargin + 2),
    Math.max(1, baseMargin - 2)
  ];
  let gameIdx = 0;
  // 3) Best-of-3 loop
  while(homeWins < 2 && awayWins < 2){
    const m = margins[gameIdx % margins.length];
    const variation = Math.floor(Math.random() * 5) - 2;
    const winnerScore = 21 + variation;
    const loserScore = Math.max(0, winnerScore - m);
    if (homeIsStronger) {
      homeWins++;
      games.push([
        winnerScore,
        loserScore
      ]);
    } else {
      awayWins++;
      games.push([
        loserScore,
        winnerScore
      ]);
    }
    gameIdx++;
  }
  return {
    games,
    winnerIndex: homeIsStronger ? 1 : 2
  };
}
function summarizeGames(games) {
  let homeTotal = 0, awayTotal = 0;
  const parts = games.map(([h, a])=>{
    homeTotal += h;
    awayTotal += a;
    return `${h}-${a}`;
  });
  return {
    scoreStr: parts.join(', '),
    homePoints: homeTotal,
    awayPoints: awayTotal
  };
}
function calculateInjuryRisk(stats) {
  const base = 0.8;
  const prevention = (stats.injury_prevention ?? 0) / 200;
  return Math.max(0.3, base - prevention);
}
function simulateInjury(playerStats, existingInjuries) {
  const risk = calculateInjuryRisk(playerStats);
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
async function updatePlayerRank(playerId) {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: matches, error: matchError } = await supabase.from('player_play_history').select('*').or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`).gte('created_at', ninetyDaysAgo).order('created_at', {
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
    const { error: updateError } = await supabase.from('players').update({
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
async function generateLineup(teamId, teamType) {
  console.log(`[Lineup] Generating lineup for ${teamType}:${teamId}`);
  // Step 1: Fetch player IDs from registration
  const { data: reg, error: regErr } = await supabase.from('interclub_registrations').select('players').eq('team_id', teamId).single();
  if (regErr) throw regErr;
  const rawRoster = typeof reg.players === 'string' ? JSON.parse(reg.players) : reg.players || [];
  if (rawRoster.length < 5) {
    throw new Error('Need at least 5 players in the pool');
  }
  const ids = rawRoster.map((p)=>p.id);
  // Step 2: Fetch enriched player data
  const [{ data: players = [], error: pErr }, { data: levels = [], error: lvlErr }, { data: stats = [], error: stErr }, { data: equipments = [], error: eqErr }] = await Promise.all([
    supabase.from('players').select('*, injuries').in('id', ids),
    supabase.from('player_stats').select('*').in('player_id', ids),
    supabase.from('player_strategy').select('*').in('player_id', ids),
    supabase.from('player_equipment').select('*').in('player_id', ids)
  ]);
  if (pErr) throw pErr;
  if (lvlErr) throw lvlErr;
  if (stErr) throw stErr;
  if (eqErr) throw eqErr;
  // Step 3: Enrich roster with injuries
  const roster = players.map((p)=>({
      ...p,
      player_levels: levels.find((l)=>l.player_id === p.id) || {},
      strategy: stats.find((s)=>s.player_id === p.id) || {},
      equipments: equipments.filter((e)=>e.player_id === p.id),
      injuries: p.injuries || []
    }));
  const males = roster.filter((p)=>p.gender === 'male');
  const females = roster.filter((p)=>p.gender === 'female');
  if (males.length + females.length < 5) {
    throw new Error('Need at least 5 total players');
  }
  // Step 4: Track usage
  const usage = {};
  roster.forEach((p)=>{
    usage[p.id] = 0;
  });
  function picker(pool, gender) {
    return ()=>{
      // Filter out players with active injuries
      const available = pool.filter((p)=>{
        const activeInjuries = p.injuries?.filter((i)=>new Date(i.recoveryEndTime) > new Date());
        return usage[p.id] < 3 && (!activeInjuries || activeInjuries.length === 0);
      });
      if (available.length > 0) {
        const choice = available[0];
        usage[choice.id]++;
        return choice;
      }
      // Fallback - pick any player even if they've played 3 matches already or have injuries
      const p = pool[0];
      usage[p.id]++;
      return p;
    };
  }
  const pickMale = picker(males, 'Male');
  const pickFemale = picker(females, 'Female');
  // Step 5: Assign match slots
  return {
    mens_singles: pickMale(),
    womens_singles: pickFemale(),
    mens_doubles: [
      pickMale(),
      pickMale()
    ],
    womens_doubles: [
      pickFemale(),
      pickFemale()
    ],
    mixed_doubles: [
      pickMale(),
      pickFemale()
    ]
  };
}
// --- Cron Handler ---
serve(async ()=>{
  console.log('[Cron] Starting interclub cron job');
  const now = new Date().toISOString();
  // Activate upcoming seasons
  await supabase.from('interclub_seasons').update({
    status: 'active',
    updated_at: now
  }).lte('start_date', now).neq('status', 'active');
  // Fetch active seasons
  const { data: seasons = [] } = await supabase.from('interclub_seasons').select('id').eq('status', 'active');
  for (const { id: season_id } of seasons){
    console.log(`[Cron] Processing season ${season_id}`);
    // STEP 1: Update match statuses
    const { data: upcomingMatches = [] } = await supabase.from('interclub_matches').select('id, match_date, home_lineup, away_lineup, status').eq('season_id', season_id).neq('status', 'completed').gt('match_date', now);
    for (const m of upcomingMatches){
      const hasHome = !!m.home_lineup;
      const hasAway = !!m.away_lineup;
      if ((!hasHome || !hasAway) && m.status !== 'lineup_pending') {
        await supabase.from('interclub_matches').update({
          status: 'lineup_pending',
          updated_at: now
        }).eq('id', m.id);
      }
      if (hasHome && hasAway && m.status === 'lineup_pending') {
        await supabase.from('interclub_matches').update({
          status: 'scheduled',
          updated_at: now
        }).eq('id', m.id);
      }
    }
    // Transition scheduled to in_progress if time passed
    const { data: schedMatches = [] } = await supabase.from('interclub_matches').select('id, match_date, status').eq('season_id', season_id).in('status', [
      'scheduled',
      'lineup_pending'
    ]);
    for (const m of schedMatches){
      if (new Date(m.match_date).toISOString() <= now) {
        await supabase.from('interclub_matches').update({
          status: 'in_progress',
          updated_at: now
        }).eq('id', m.id);
      }
    }
    // STEP 2: Handle in_progress matches whose time has passed
    const { data: toSimulate = [] } = await supabase.from('interclub_matches').select('*').eq('season_id', season_id).eq('status', 'in_progress').lte('match_date', now);
    for (const match of toSimulate){
      try {
        // Generate missing lineups if needed
        const needsHome = !match.home_lineup;
        const needsAway = !match.away_lineup;
        if (needsHome || needsAway) {
          const updates = {
            updated_at: now
          };
          if (needsHome) {
            updates.home_lineup = {
              lineup: await generateLineup(match.home_team_id, match.home_team_type)
            };
          }
          if (needsAway) {
            updates.away_lineup = {
              lineup: await generateLineup(match.away_team_id, match.away_team_type)
            };
          }
          await supabase.from('interclub_matches').update(updates).eq('id', match.id);
          console.log(`[Cron] Generated missing lineups for match ${match.id}`);
          continue;
        }
        // Both lineups exist → simulate the match
        console.log(`[Cron] Simulating match ${match.id}`);
        const homeLineup = typeof match.home_lineup === 'string' ? JSON.parse(match.home_lineup).lineup : match.home_lineup.lineup;
        const awayLineup = typeof match.away_lineup === 'string' ? JSON.parse(match.away_lineup).lineup : match.away_lineup.lineup;
        let cumHome = 0, cumAway = 0;
        const results = {};
        // Simulate each category
        for (const slot of [
          'mens_singles',
          'womens_singles',
          'mens_doubles',
          'womens_doubles',
          'mixed_doubles'
        ]){
          const hR = computeLineupRating(homeLineup[slot]);
          const aR = computeLineupRating(awayLineup[slot]);
          console.log("Home rating : ", hR, "Away rating: ", aR);
          const { games, winnerIndex } = simulateCategory(hR, aR);
          const { scoreStr, homePoints, awayPoints } = summarizeGames(games);
          console.log(scoreStr, "Home points ", homePoints, " Away points", awayPoints);
          cumHome += homePoints;
          cumAway += awayPoints;
          results[slot] = {
            score: scoreStr,
            home_rating: hR,
            away_rating: aR,
            winner_team_id: winnerIndex === 1 ? match.home_team_id : match.away_team_id,
            winner_team_type: winnerIndex === 1 ? match.home_team_type : match.away_team_type,
            home_players: Array.isArray(homeLineup[slot]) ? homeLineup[slot].map((p)=>p.id) : [
              homeLineup[slot].id
            ],
            away_players: Array.isArray(awayLineup[slot]) ? awayLineup[slot].map((p)=>p.id) : [
              awayLineup[slot].id
            ],
            games
          };
        }
        // Determine overall winner
        const overallWinnerId = cumHome > cumAway ? match.home_team_id : match.away_team_id;
        const overallWinnerType = cumHome > cumAway ? match.home_team_type : match.away_team_type;
        // Update match record
        await supabase.from('interclub_matches').update({
          status: 'completed',
          results,
          final_score: `${cumHome}-${cumAway}`,
          winner_team_id: overallWinnerId,
          winner_team_type: overallWinnerType,
          updated_at: now
        }).eq('id', match.id);
        // Record individual matchups in player_play_history and handle injuries
        const allPlayerIds = new Set();
        for (const slot of [
          'mens_singles',
          'womens_singles',
          'mens_doubles',
          'womens_doubles',
          'mixed_doubles'
        ]){
          console.log("Starting process to add to player play history");
          const matchSlot = results[slot];
          const homePlayers = Array.isArray(homeLineup[slot]) ? homeLineup[slot] : [
            homeLineup[slot]
          ];
          const awayPlayers = Array.isArray(awayLineup[slot]) ? awayLineup[slot] : [
            awayLineup[slot]
          ];
          const isHomeWin = matchSlot.winner_team_id === match.home_team_id;
          // For each pairing in this slot (1 for singles, 2 for doubles)
          for(let i = 0; i < homePlayers.length; i++){
            const homePlayerId = homePlayers[i].id;
            const awayPlayerId = awayPlayers[i]?.id;
            if (homePlayerId) allPlayerIds.add(homePlayerId);
            if (awayPlayerId) allPlayerIds.add(awayPlayerId);
            console.log("Home player id ", homePlayerId, " Away player id ", awayPlayerId);
            // Fetch current ranks
            const [{ data: homeRank }, { data: awayRank }] = await Promise.all([
              supabase.from('players').select('rank').eq('id', homePlayerId).maybeSingle(),
              supabase.from('players').select('rank').eq('id', awayPlayerId).maybeSingle()
            ]);
            console.log("Home rank ", homeRank, "away Rank ", awayRank);
            // Record the matchup
            const { data: historyData, error: historyError } = await supabase.from('player_play_history').insert({
              player1_id: homePlayerId,
              player2_id: awayPlayerId,
              result: isHomeWin,
              player1_rank: homeRank?.rank || null,
              player2_rank: awayRank?.rank || null,
              created_at: now
            });
            if (historyError) {
              console.error('❌ Error inserting player_play_history:', historyError);
            } else {
              console.log('✅ Inserted player_play_history record:', historyData);
            }
          }
        }
        // Simulate injuries for all participating players
        for (const playerId of Array.from(allPlayerIds)){
          try {
            const [{ data: player }, { data: stats }] = await Promise.all([
              supabase.from('players').select('injuries').eq('id', playerId).single(),
              supabase.from('player_stats').select('*').eq('player_id', playerId).single()
            ]);
            if (!stats) continue;
            const newInjury = simulateInjury(stats, player?.injuries || []);
            if (newInjury) {
              await supabase.from('player_injuries').insert({
                player_id: playerId,
                ...newInjury
              });
              console.log(`Recorded new injury for player ${playerId}: ${newInjury.type}`);
            }
            // Update player rank after match
            await updatePlayerRank(playerId);
          } catch (err) {
            console.error(`Error processing injuries/rank for player ${playerId}:`, err);
          }
        }
        console.log(`[Cron] Successfully simulated match ${match.id}`);
      } catch (err) {
        console.error(`[Cron] ❌ Error simulating match ${match.id}:`, err);
      }
    }
    // Complete season if no active matches left
    const { count: remaining } = await supabase.from('interclub_matches').select('id', {
      count: 'exact',
      head: true
    }).eq('season_id', season_id).neq('status', 'completed');
    if (remaining === 0) {
      console.log(`[Cron] Completing season ${season_id}`);
      // 1) Count wins per team
      const { data: allResults = [] } = await supabase.from('interclub_matches').select('winner_team_id').eq('season_id', season_id);
      const winCounts = {};
      allResults.forEach((m)=>{
        winCounts[m.winner_team_id] = (winCounts[m.winner_team_id] || 0) + 1;
      });
      // 2) Sort teams by wins and take top 3
      const topTeams = Object.entries(winCounts).sort(([, a], [, b])=>b - a).slice(0, 3) // first three entries
      .map(([teamId])=>teamId);
      // 3) Load prize pool for this season
      const { data: seasonData } = await supabase.from('interclub_seasons').select('prize_pool').eq('id', season_id).single();
      const prizePool = seasonData.prize_pool;
      // 4) For each place (first, second, third), award resources
      const placeKeys = [
        'first',
        'second',
        'third'
      ];
      for(let i = 0; i < topTeams.length; i++){
        const teamId = topTeams[i];
        const place = placeKeys[i];
        const awards = prizePool[place] || {};
        // fetch the winning team's user_id
        const { data: teamInfo } = await supabase.from('interclub_teams').select('user_id').eq('id', teamId).eq('season_id', season_id).single();
        const userId = teamInfo.user_id;
        // insert one transaction per resource type
        for (const [resource_type, amount] of Object.entries(awards)){
          if (amount > 0) {
            await supabase.from('resource_transactions').insert({
              user_id: userId,
              resource_type,
              amount,
              source: 'tournament_reward',
              source_id: season_id
            });
          }
        }
      }
      // 5) Finally, mark the season completed
      await supabase.from('interclub_seasons').update({
        status: 'completed',
        updated_at: now
      }).eq('id', season_id);
    }
  }
  console.log('[Cron] Done');
  return new Response('Cron executed', {
    status: 200
  });
});
