import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (_req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const now = new Date().toISOString();
  const { data: tournaments, error } = await supabase.from("tournament_list").select("*").eq("status", 0).lte("start_date", now);
  if (error) {
    console.error("Fetch error:", error);
    return new Response("Error fetching tournaments", {
      status: 500
    });
  } else if (tournaments && tournaments.length > 0) {
    const tournamentService = new TournamentService(supabase);
    for (const tournament of tournaments) {
      try {
        console.log(`Starting tournament ${tournament.id} - ${tournament.name}`);
        const result = await tournamentService.startTournament(tournament.id);

        if (result.success) {
          console.log(`Started tournament: ${tournament.id}`);
        } else {
          console.warn(`Failed to start tournament ${tournament.id}:`, result.error);
        }
      } catch (err) {
        console.error(`Error starting tournament ${tournament.id}:`, err);
      }
    }
  } else {
  console.log('No tournaments to start.');
  }
  return new Response("Tournaments auto-started", {
    status: 200
  });
});