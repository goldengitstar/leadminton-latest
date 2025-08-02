// Local game actions without database
import { calculateTrainingTime, calculateUpgradeTime } from '@/utils/timeCalculator';
import { Player, Facility, PlayerStrategy, Resources, Injury, PlayHistory } from '../types/game';
import { supabase } from './supabase';
import { Equipment } from '@/types/equipment';
import { ResourceService, PlayerService } from '@/services/database';

const playerService = new PlayerService(supabase);
const resourceService = new ResourceService(supabase);

export async function recordResourceUpdate(userId: string | undefined, source: string, changes: Partial<Record<keyof Resources, number>>, isAdd: boolean = true) {
  if (!changes || !source || !userId) {
    console.error('[recordResourceUpdate] Invalid parameters:', { userId, source, changes, isAdd });
    return;
  }

  const transactions = Object.entries(changes).map(([resource, amount]) => ({
    resource_type: resource,
    amount: isAdd ? amount! : -amount!,
    source: source
  }));

  console.log('[recordResourceUpdate] Recording transactions:', transactions);

  const result = await resourceService.batchResourceTransactions(userId, transactions);
  if (!result.success) {
    console.error('[recordResourceUpdate] Failed to record transactions:', result.error);
    throw new Error(`Resource update failed: ${result.error}`);
  }
  
  console.log('[recordResourceUpdate] Transactions recorded successfully');
}

export async function recordTrainingStart(
  player: Player,
  stat: keyof Player['stats'],
  costs: { shuttlecocks: number; meals: number; coins: number }
) {
  if (!player.id) return;
  // Local implementation - no database needed
  await supabase
    .from('players')
    .update({
      training: {
        stat,
        startTime: Date.now(),
        period: calculateTrainingTime(player.statLevels[stat])
      }
    })
    .eq('id', player.id);
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export async function recordTrainingComplete(
  player: Player,
  stat: keyof Player['stats'],
  newValue: number
) {
  if (!player.id) return;

  const columnName = toSnakeCase(stat as string); // Convert camelCase → snake_case

  // 1. Update training & level
  const { error: playerUpdateError } = await supabase
    .from('players')
    .update({
      training: null,
      level: player.level + 1
    })
    .eq('id', player.id);

  if (playerUpdateError) {
    console.error('Error updating players table:', playerUpdateError.message);
  }

  console.log('Recording training complete, stat:', stat);

  // 2. Update stat
  const { error: statUpdateError } = await supabase
    .from('player_stats')
    .update({
      [columnName]: newValue
    })
    .eq('player_id', player.id);

  if (statUpdateError) {
    console.error('Error updating player_stats:', statUpdateError.message);
  }

  // 3. Update stat level
  const { error: levelUpdateError } = await supabase
    .from('player_levels')
    .update({
      [columnName]: player.statLevels[stat] + 1
    })
    .eq('player_id', player.id);

  if (levelUpdateError) {
    console.error('Error updating player_levels:', levelUpdateError.message);
  }
}

export async function recordPlayerStrategyChange(playerId: string, strategy: PlayerStrategy) {
  if (!playerId) return;
  await supabase
    .from('player_strategy')
    .update([{
      physical_commitment: strategy.physicalCommitment,
      play_style: strategy.playStyle,
      movement_speed: strategy.movementSpeed,
      fatigue_management: strategy.fatigueManagement,
      rally_consistency: strategy.rallyConsistency,
      risk_taking: strategy.riskTaking,
      attack: strategy.attack,
      soft_attack: strategy.softAttack,
      serving: strategy.serving,
      court_defense: strategy.courtDefense,
      mental_toughness: strategy.mentalToughness,
      self_confidence: strategy.selfConfidence,
    }])
    .eq('player_id', playerId);
}

export async function recordHireManagerComplete(
  managerId: string,
) {
  await supabase
    .from('managers')
    .update([{
      active: false,
      purchasing: null
    }])
    .eq('id', managerId);
}

export async function recordHireManager(
  managerId: string,
) {
  await supabase
    .from('managers')
    .update([{
      active: true,
      purchasing: {
        startTime: Date.now(),
        period: (5 * 24 * 60 * 60 * 1000), // 5 days
      }
    }])
    .eq('id', managerId);
}

export async function recordFacilityUpgradeStart(
  facility: Facility,
  costs: { coins: number; shuttlecocks: number; meals: number }
) {
  await supabase
    .from('facilities')
    .update([{
      upgrading: {
        startTime: Date.now(),
        period: calculateUpgradeTime(facility.level),
      }
    }])
    .eq('id', facility.id);
}

export async function recordFacilityUpgradeComplete(facility: Facility, upgradedFacility: Partial<Facility>) {
  await supabase
    .from('facilities')
    .update([{
      level: upgradedFacility.level,
      production_rate: upgradedFacility.productionRate,
      max_players: upgradedFacility.maxPlayers,
      upgrade_cost: upgradedFacility.upgradeCost,
      upgrading: upgradedFacility.upgrading || null,
    }])
    .eq('id', facility.id);
  // Local implementation - no database needed
}

export async function recordEquipmentChange(
  player: Player,
  equipment: Equipment,
  action: 'purchase' | 'equip' | 'unequip',
  costs?: { coins: number; diamonds: number }
) {
  if (!player) return;
  console.log(player.equipment)
  console.log(equipment)
  const { error } = await supabase
    .from('player_equipment')
    .insert([
      {
        player_id: player.id,
        equipment_id: equipment.id,
        equipment_type: equipment.type,
        created_at: new Date().toISOString(),
        equipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ]);

  if (error) {
    console.error('Error inserting player_equipment:', error);
  }

}

export async function recordInjuriesChange(
  player: Player,
  injuries: Injury[]
) {
  if (!player) return;
  const now = Date.now();
  // Appliquer la réduction à toutes les blessures actives
  const updatedInjuries = injuries.filter(injury => injury.recoveryEndTime > now);
  console.log(updatedInjuries)
  await supabase
    .from('players')
    .update([{
      injuries: updatedInjuries,
    }])
    .eq('id', player.id);
}


export async function recordMatch(
  player1: Player,
  player2: Player,
  result: PlayHistory
) {
  if (!player1 || !player2) return;
  await supabase.from('player_play_history').insert([{
    player1_id: player1.id.includes('cpu') ? null : player1.id,
    player2_id: player2.id.includes('cpu') ? null : player2.id,
    result: result.result,
    player1_rank: result.level1,
    player2_rank: result.level2,
  }]);
}

export async function updatePlayerRank(player: string) {
  const result = await playerService.updatePlayerRank(player);
  if (!result.success) {
    console.error("Error updating player rank:", result.error);
  }
  return result.success;
}