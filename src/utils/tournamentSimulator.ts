import { Player } from '../types/game';
import { calculatePlayerStrength } from './playerUtils';
import { generateMatchSummary } from './matchUtils';
import { checkForInjury } from './injuryUtils';
import { PlayerService } from '../services/database/playerService';
import { supabase } from '@/lib/supabase';

const playerService = new PlayerService(supabase);

/**
 * Simulate match againt two players
 * @param player1 
 * @param player2 
 * @returns 
 */
export function simulateMatch(player1: Player, player2: Player) {
  // console.log(player1)
  const player1Strength = calculatePlayerStrength(player1);
  const player2Strength = calculatePlayerStrength(player2);
  console.log(player1.id.includes('cpu') ? player1.id : player1.name, " ", player1.level, player1.rank, " ", player1Strength, " ", player2.id.includes('cpu') ? player2.id : player2.name, " ", player2.level, player2.rank, player2Strength);
  const totalStrength = player1Strength + player2Strength;
  const player1WinProbability = player1Strength / totalStrength;

  const sets = [0, 0];
  const points = [];

  // Simulate 3 sets
  for (let set = 0; set < 3; set++) {
    let player1Points = 0;
    let player2Points = 0;
    // Count random win points of players
    while ((player1Points < 21 && player2Points < 21) || Math.abs(player1Points - player2Points) < 2) {
      if (Math.random() < player1WinProbability) {
        player1Points++;
      } else {
        player2Points++;
      }
    }
    points.push(`${player1Points}-${player2Points}`);
    if (player1Points > player2Points) {
      sets[0]++;
    } else {
      sets[1]++;
    }

    // if one player wins twice, finish match
    if (sets[0] === 2 || sets[1] === 2) break;
  }

  const winner = sets[0] > sets[1] ? player1 : player2;
  const loser = sets[0] > sets[1] ? player2 : player1;
  const score = points.join(', ');

  // Increase the chances of injury for the loser
  const injury1 = checkForInjury(player1);
  const injury2 = checkForInjury(player2);
  // console.log('Match result:', { winner: winner.name, injury });

  return {
    players: [player1, player2],
    winner,
    loser,
    score,
    summary: generateMatchSummary(winner, loser, score),
    newInjury: injury1,
    newInjury1: injury2
  };
}

/**
 * Simulate match player vs cpu
 * @param player 
 * @returns 
 */
export function simulateQuickTournament(player: Player) {
  // create random player
  const cpuOpponent = playerService.createQuickCpuOpponent(player.level);
  return simulateMatch(player, cpuOpponent);
}