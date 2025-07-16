// supabase/functions/facilityProduction/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import type { Facility, Manager } from "./types.ts"; // Optional: split types to file if needed

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.replace("Bearer ", "");

  if (!jwt) {
    return new Response("Missing auth token", { status: 401 });
  }

  const {
    data: {
      user: { id: userId },
    },
    error: userError,
  } = await supabase.auth.getUser(jwt);

  if (userError || !userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: facilities, error: facilityError } = await supabase
    .from("facilities")
    .select("*")
    .eq("user_id", userId);

  const { data: managers, error: managerError } = await supabase
    .from("managers")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true); // only active ones affect production

  if (facilityError || managerError) {
    return new Response("Error loading data", { status: 500 });
  }

  const activeManagers = managers as Manager[];
  const productionRecords: {
    user_id: string;
    resource_type: string;
    amount: number;
    source: string;
    source_id: string | null;
  }[] = [];

  for (const facility of facilities as Facility[]) {
    if (facility.type === "training-center" || !facility.resourceType) continue;

    const baseRate = calculateBaseProductionRate(facility, facility.level);
    const manager = activeManagers.find(
      (m) => m.facilityType === facility.type
    );
    const finalRate = manager
      ? Math.ceil(baseRate * (1 + manager.productionBonus))
      : baseRate;

    if (finalRate > 0) {
      productionRecords.push({
        user_id: userId,
        resource_type: facility.resourceType,
        amount: finalRate,
        source: "facility_production",
        source_id: facility.id,
      });
    }
  }

  if (productionRecords.length > 0) {
    const { error: insertError } = await supabase
      .from("resource_transactions")
      .insert(productionRecords);

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500 }
      );
    }
  }

  return new Response(
    JSON.stringify({
      message: "Production recorded",
      transactions: productionRecords,
    }),
    { status: 200 }
  );
});

// Utility function for base production
function calculateBaseProductionRate(facility: Facility, level: number): number {
  if (facility.type === "training-center") return 0;

  const baseRates = {
    "shuttlecock-machine": 1,
    "canteen": 1,
    "sponsors": 2,
  };

  const baseRate = baseRates[facility.type as keyof typeof baseRates] || 1;
  return Math.ceil(baseRate * (1 + (level - 1) * 0.5));
}