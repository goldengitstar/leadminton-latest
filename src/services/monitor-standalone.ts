import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { MatchService } from './database/matchService';
import { PlayerService } from './database/playerService';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create service instances
const matchService = new MatchService(supabase);
const playerService = new PlayerService(supabase);

class StandaloneMonitorService {
  private static isRunning = false;
  private static monitorInterval: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL = 30000; // Check every 30 seconds

  /**
   * Initialize the monitoring service
   */
  static initialize() {
    if (this.isRunning) {
      console.log('[Monitor Service] Already running');
      return;
    }

    console.log('[Monitor Service] Starting tournament and match monitoring...');
    this.isRunning = true;
    this.startMonitoring();
  }

  /**
   * Stop the monitoring service
   */
  static shutdown() {
    if (!this.isRunning) {
      return;
    }

    console.log('[Monitor Service] Shutting down monitoring...');
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
  }

  /**
   * Start periodic monitoring
   */
  private static startMonitoring() {
    // Run initial check
    this.runMonitoringCycle();

    // Set up periodic monitoring
    this.monitorInterval = setInterval(() => {
      this.runMonitoringCycle();
    }, this.CHECK_INTERVAL);

    console.log(`[Monitor Service] Monitoring started - checking every ${this.CHECK_INTERVAL / 1000} seconds`);
  }

  /**
   * Run one complete monitoring cycle
   */
  private static async runMonitoringCycle() {
    try {
      const currentTime = new Date();
      console.log(`[Monitor Service] Running check at ${currentTime.toISOString()}`);

      // Run both monitoring functions in parallel
      await Promise.all([
        this.monitorTournaments(),
        this.monitorMatches()
      ]);

    } catch (error) {
      console.error('[Monitor Service] Error in monitoring cycle:', error);
    }
  }

  /**
   * Monitor tournaments that should start
   */
  static async monitorTournaments() {
    try {
      const { data, error } = await supabase
        .from('tournament_list')
        .select('*')
        .eq('status', 0); // Only upcoming tournaments

      if (error) {
        console.error('[Monitor Service] Error fetching tournaments:', error);
        return;
      }

      const currentTime = new Date();
      
      for (const tournament of data || []) {
        if (tournament.start_date && new Date(tournament.start_date) <= currentTime) {
          console.log(`[Monitor Service] Starting tournament: ${tournament.name} (${tournament.id})`);
          
          try {
            await this.startTournament(tournament.id);
            console.log(`[Monitor Service] ✅ Tournament started: ${tournament.id}`);
          } catch (error) {
            console.error(`[Monitor Service] ❌ Failed to start tournament ${tournament.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Monitor Service] Error in monitorTournaments:', error);
    }
  }

  /**
   * Monitor matches that should be executed
   */
  static async monitorMatches() {
    try {
      const { data, error } = await supabase
        .from('match')
        .select('*')
        .eq('completed', false); // Only pending matches

      if (error) {
        console.error('[Monitor Service] Error fetching matches:', error);
        return;
      }

      for (const match of data) {
        console.log('monitoring match', match);
        if (match.scheduled_start_time && new Date(match.scheduled_start_time) < new Date()) {
          if (match.player1_id === null || match.player2_id === null) {
            console.log(`[Monitor Service] ⚠️ Skipping null player IDs for ${match.id}`);
            continue;
          }
          await matchService.executeTournamentMatch(match.id);
        }
      }
    } catch (error) {
      console.error('[Monitor Service] Error in monitorMatches:', error);
    }
  }

  /**
   * Start a tournament (simplified version)
   */
  static async startTournament(tournamentId: string) {
    try {
      // Get tournament details
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournament_list')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError || !tournament) {
        throw new Error('Tournament not found');
      }

      if (tournament.status !== 0) {
        console.log(`[Monitor Service] Tournament ${tournamentId} already started or completed`);
        return;
      }

      // Update tournament status to started
      const { error: updateError } = await supabase
        .from('tournament_list')
        .update({
          status: 1, // Started
          updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId);

      if (updateError) {
        throw updateError;
      }

      console.log(`[Monitor Service] Tournament ${tournament.name} status updated to started`);
    } catch (error) {
      console.error(`[Monitor Service] Error starting tournament ${tournamentId}:`, error);
      throw error;
    }
  }

  /**
   * Get monitoring status
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.CHECK_INTERVAL,
      nextCheck: this.monitorInterval ? new Date(Date.now() + this.CHECK_INTERVAL) : null
    };
  }
}

// Auto-initialize when run directly
console.log('[Monitor Service] Starting standalone monitor service...');
StandaloneMonitorService.initialize();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('[Monitor Service] Received SIGINT, shutting down...');
  StandaloneMonitorService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Monitor Service] Received SIGTERM, shutting down...');
  StandaloneMonitorService.shutdown();
  process.exit(0);
});

// Keep process alive
setInterval(() => {
  // Just keep the process running
}, 60000); 