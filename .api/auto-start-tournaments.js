import { createClient } from '@supabase/supabase-js';

export async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const now = new Date().toISOString();

  const { data: tournaments, error } = await supabase
    .from('tournament_list')
    .select('*')
    .eq('status', 0)
    .lte('start_date', now);

  if (error) return res.status(500).json({ error: error.message });

  for (const tournament of tournaments) {
    const registeredPlayers = tournament.registered_players || [];
    const missing = tournament.max_participants - registeredPlayers.length;

    if (missing > 0) {
      const { data: cpuPlayers } = await supabase
        .from('players')
        .select('id, name, user_id')
        .eq('is_cpu', true)
        .limit(missing);

      const cpuRegistrations = cpuPlayers.map(cpu => ({
        player_id: cpu.id,
        player_name: cpu.name,
        user_id: cpu.user_id,
        team_name: 'CPU',
        registered_at: new Date().toISOString(),
      }));

      registeredPlayers.push(...cpuRegistrations);
    }

    const shuffled = [...registeredPlayers].sort(() => Math.random() - 0.5);
    const matches = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];
      const isBye = !p2;

      matches.push({
        tournament_id: tournament.id,
        player1_id: p1.player_id,
        player2_id: isBye ? null : p2.player_id,
        winner_id: isBye ? p1.player_id : null,
        round_level: 1,
        completed: isBye,
        status: isBye ? 'bye' : 'pending',
        score: isBye ? '21-0, 21-0' : null,
        scheduled_start_time: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    }

    await supabase
      .from('tournament_list')
      .update({
        status: 1,
        registered_players: registeredPlayers,
        current_participants: registeredPlayers.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', tournament.id);

    await supabase.from('match').insert(matches);
  }

  return res.status(200).json({ message: 'Tournaments processed' });
}