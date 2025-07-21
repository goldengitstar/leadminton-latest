// services/database/facilityService.ts

import { supabase } from "@/lib/supabase";

interface Resources {
  shuttlecocks: number;
  meals: number;
  coins: number;
  diamonds: number;
}

interface Facility {
  id: string;
  name: string;
  type: 'shuttlecock-machine' | 'canteen' | 'sponsors' | 'training-center';
  level: number;
  productionRate: number;
  resourceType?: keyof Omit<Resources, 'diamonds'>;
  maxPlayers: number;
  upgradeCost: {
    coins: number;
    shuttlecocks: number;
    meals: number;
    diamonds: number;
  };
  upgrading?: {
    startTime: number;
    period: number;
  };
}

export class FacilityService {
  private table = "facilities";

  async getFacilities(userId: string): Promise<Facility[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("user_id", userId)

    if (error) {
      console.error("[FacilityService] Error fetching facilities:", error);
      return [];
    }

    return (data || []).map((f: any): Facility => ({
      id: f.id,
      name: f.name,
      type: f.type,
      level: f.level,
      productionRate: f.production_rate,
      resourceType: f.resource_type || undefined,
      maxPlayers: f.max_players || 0,
      upgradeCost: f.upgrade_cost || {
        coins: 0,
        shuttlecocks: 0,
        meals: 0,
        diamonds: 0,
      },
      upgrading: f.upgrading || undefined,
    }));
  }
}