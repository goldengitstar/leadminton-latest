// services/database/managerService.ts

import { supabase } from "@/lib/supabase";

interface Manager {
  id: string;
  name: string;
  facilityType: 'shuttlecock-machine' | 'canteen' | 'sponsors';
  productionBonus: number;
  active: boolean;
  imageUrl: string;
  cost: number;
  purchasing?: {
    startTime: number;
    period: number;
  };
}

export class ManagerService {
  private table = "managers";

  async getManagersByUser(userId: string): Promise<Manager[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("[ManagerService] Error fetching managers:", error);
      return [];
    }

    return (data || []).map((m: any): Manager => ({
      id: m.id,
      name: m.name,
      facilityType: m.facility_type,
      productionBonus: m.production_bonus || 0,
      active: m.active || false,
      imageUrl: m.image_url || "",
      cost: m.cost || 0,
      purchasing: m.purchasing || undefined,
    }));
  }

  // Optional: Add methods to activate, assign, or purchase a manager
}