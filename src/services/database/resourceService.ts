import { SupabaseClient } from '@supabase/supabase-js';

export interface ResourceTransaction {
  resource_type: string;
  amount: number;
  source: string;
  source_id?: string;
}

export class ResourceService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Batch resource transactions - JavaScript replacement for batch_resource_transactions() function
   */
  async batchResourceTransactions(
    userId: string, 
    transactions: ResourceTransaction[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate inputs
      if (!userId || !transactions?.length) {
        return { success: false, error: 'Invalid parameters' };
      }

      // Prepare transaction data
      const transactionData = transactions.map(tx => ({
        user_id: userId,
        resource_type: tx.resource_type,
        amount: tx.amount,
        source: tx.source,
        source_id: tx.source_id || null,
        created_at: new Date().toISOString()
      }));

      // Insert transactions
      const { error } = await this.supabase
        .from('resource_transactions')
        .insert(transactionData);

      if (error) {
        console.error('Error in batch resource transactions:', error);
        return { success: false, error: error.message };
      }

      // Refresh materialized view (optional for performance)
      // await this.refreshResourceBalances();

      return { success: true };
    } catch (error) {
      console.error('Error in batchResourceTransactions:', error);
      return { success: false, error: 'Failed to process resource transactions' };
    }
  }

  /**
   * Get user resource balances - now consistent with loadResources
   */
  async getUserResourceBalances(userId: string): Promise<Record<string, number>> {
    try {
      const { data, error } = await this.supabase
        .from('resource_transactions')
        .select('resource_type, amount')
        .eq('user_id', userId);

      if (error) {
        console.error('Error getting resource balances:', error);
        return {};
      }

      console.log('[ResourceService] Raw transactions:', data);
      
      // Calculate balances - start from zero
      const balances: Record<string, number> = {
        shuttlecocks: 0,
        meals: 0,
        coins: 0,
        diamonds: 0,
      };

      data?.forEach(transaction => {
        const { resource_type, amount } = transaction;
        if (resource_type in balances) {
          balances[resource_type] += amount;
        }
      });

      console.log('[ResourceService] Final balances:', balances);
      return balances;
    } catch (error) {
      console.error('Error in getUserResourceBalances:', error);
      return {};
    }
  }

  /**
   * Get resource balance for a specific resource type
   */
  async getResourceBalance(userId: string, resourceType: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('resource_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('resource_type', resourceType);

      if (error) {
        console.error('Error getting resource balance:', error);
        return 0;
      }

      return data?.reduce((total, tx) => total + tx.amount, 0) || 0;
    } catch (error) {
      console.error('Error in getResourceBalance:', error);
      return 0;
    }
  }

  /**
   * Refresh materialized view for resource balances
   */
  async refreshResourceBalances(): Promise<void> {
    try {
      // Refresh the materialized view
      const { error } = await this.supabase.rpc('refresh_materialized_view', {
        view_name: 'user_resource_balances'
      });

      if (error) {
        console.warn('Could not refresh materialized view:', error);
        // This is not critical, so we don't throw
      }
    } catch (error) {
      console.warn('Error refreshing resource balances:', error);
      // Non-critical error
    }
  }

  /**
   * Add single resource transaction
   */
  async addResourceTransaction(
    userId: string,
    resourceType: string,
    amount: number,
    source: string,
    sourceId?: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.batchResourceTransactions(userId, [{
      resource_type: resourceType,
      amount,
      source,
      source_id: sourceId
    }]);
  }

  /**
   * Check if user has sufficient resources
   */
  async hasSufficientResources(
    userId: string, 
    requiredResources: Record<string, number>
  ): Promise<boolean> {
    try {
      const balances = await this.getUserResourceBalances(userId);
      
      return Object.entries(requiredResources).every(([resourceType, required]) => {
        const current = balances[resourceType] || 0;
        return current >= required;
      });
    } catch (error) {
      console.error('Error checking sufficient resources:', error);
      return false;
    }
  }
} 