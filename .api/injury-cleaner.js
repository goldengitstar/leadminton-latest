import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
serve(async ()=>{
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  try {
    // 1) Fetch players with existing injuries
    const { data: players, error: fetchError } = await supabase.from('players').select('id, injuries').not('injuries', 'is', null);
    if (fetchError) {
      console.error('Error fetching players:', fetchError);
      return new Response('Fetch Error', {
        status: 500
      });
    }
    const nowMs = Date.now();
    const updates = [];
    // 2) Iterate and filter injuries arrays
    for (const player of players || []){
      const inj = player.injuries;
      const filtered = inj.filter((elem)=>{
        const end = Number(elem.recoveryEndTime);
        return end > nowMs;
      });
      updates.push(supabase.from('players').update({
        injuries: filtered
      }).eq('id', player.id));
    }
    // 3) Execute all updates in parallel
    const results = await Promise.all(updates);
    for (const res of results){
      if (res.error) {
        console.error('Update error:', res.error);
      }
    }
    return new Response('Injuries cleaned', {
      status: 200
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response('Internal Error', {
      status: 500
    });
  }
});
