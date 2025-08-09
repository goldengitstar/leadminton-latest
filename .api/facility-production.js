// supabase/functions/facilityProduction/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
function calculateBaseProductionRate(facility, level) {
  if (facility.type === "training-center") return 0;
  const baseRates = {
    "shuttlecock-machine": 2.5,
    "canteen": 2.5,
    "sponsors": 2.5
  };
  const baseRate = baseRates[facility.type] || 1;
  return Math.ceil(baseRate * (1 + (level - 1) * 0.5));
}
function calculateProductionRate(facility, level = facility.level, activeManagers = []) {
  if (facility.type === "training-center") return 0;
  const baseRate = calculateBaseProductionRate(facility, level);
  const manager = activeManagers.find((m)=>m.facility_type === facility.type && m.active);
  const finalRate = manager ? Math.ceil(baseRate * (1 + manager.production_bonus)) : baseRate;
  return finalRate;
}
serve(async ()=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: users, error: userErr } = await supabase.from("club_managers").select("user_id");
  if (userErr || !users) {
    return new Response("Failed to retrieve users", {
      status: 500
    });
  }
  const productionResults = [];
  for (const user of users){
    const userId = user.user_id;
    const { data: facilities, error: facilityError } = await supabase.from("facilities").select("*").eq("user_id", userId);
    const { data: managers, error: managerError } = await supabase.from("managers").select("*").eq("user_id", userId).eq("active", true);
    if (facilityError || managerError || !facilities) continue;
    const activeManagers = managers ?? [];
    const productionRecords = [];
    for (const facility of facilities){
      if (facility.type === "training-center" || !facility.resource_type) continue;
      const finalRate = calculateProductionRate(facility, facility.level, activeManagers);
      if (finalRate > 0) {
        productionRecords.push({
          user_id: userId,
          resource_type: facility.resource_type,
          amount: finalRate,
          source: "facility_production",
          source_id: facility.id
        });
      }
    }
    if (productionRecords.length > 0) {
      const { error: insertError } = await supabase.from("resource_transactions").insert(productionRecords);
      if (!insertError) {
        productionResults.push({
          userId,
          records: productionRecords
        });
      } else {
        console.log(insertError);
      }
    }
  }
  return new Response(JSON.stringify({
    message: "Facility production processed",
    summary: productionResults
  }), {
    status: 200
  });
});
