import { supabase } from '../lib/supabase';

export interface AdminUser {
  id: string;
  user_id: string;
  permissions: {
    tournaments: boolean;
    interclub: boolean;
    users: boolean;
    cpu_teams: boolean;
    equipments_management:boolean;
  };
  created_at: string;
  updated_at: string;
}

export const checkAdminPermissions = async (userId: string): Promise<AdminUser | null> => {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as AdminUser;
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    return null;
  }
};

export const logAdminActivity = async (
  adminUserId: string,
  actionType: string,
  targetType?: string,
  targetId?: string,
  details?: any
) => {
  try {
    console.log('Logging admin activity:', {
      adminUserId,
      actionType,
      targetType,
      targetId,
      details
    });
    // for now we are not logging admin activity because it will increase the size of the database
    // const { error } = await supabase.rpc('log_admin_activity', {
    //   p_admin_user_id: adminUserId,
    //   p_action_type: actionType,
    //   p_target_type: targetType,
    //   p_target_id: targetId,
    //   p_details: details
    // });

    // if (error) {
    //   console.error('Error logging admin activity:', error);
    // }
  } catch (error) {
    console.error('Error logging admin activity:', error);
  }
}; 