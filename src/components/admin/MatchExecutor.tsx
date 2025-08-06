import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Play, 
  Trophy, 
  Clock, 
  CheckCircle, 
  User,
  Zap,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { MatchService } from '../../services/database/matchService';
import { TournamentService } from '../../services/database/tournamentService';

const matchService = new MatchService(supabase);
const tournamentService = new TournamentService(supabase);

interface MatchExecutorProps {
  tournamentId: string;
  onMatchComplete: () => void;
}

const MatchExecutor: React.FC<MatchExecutorProps> = ({ 
  tournamentId, 
  onMatchComplete 
}) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [executingMatch, setExecutingMatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMatches();
  }, [tournamentId]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      console.log('[MatchExecutor] Loading matches with JavaScript logic', tournamentId);
      
      // Get all rounds for the tournament
      const tournamentWithMatches = await tournamentService.getTournamentWithMatches(tournamentId);

      console.log('tournamentWithMatches', tournamentWithMatches);
      setMatches(tournamentWithMatches.rounds);

      console.log('[MatchExecutor] Loaded. tournamentWithMatches =>', tournamentWithMatches);

    } catch (err) {
      console.error('[MatchExecutor] Error loading matches:', err);
      setError('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const executeMatch = async (matchId: string) => {
    setExecutingMatch(matchId);
    setError(null);
    
    try {
      console.log('[MatchExecutor] Executing match with JavaScript logic:', matchId);
      
      // Get match details
      const res = await matchService.executeTournamentMatch(matchId);

      if(res.success) {
        await loadMatches();
        onMatchComplete();
        
        // Show match result notification
        toast.success(`Match completed! Winner: ${res.matchData.winnerName}\nScore: ${res.matchData.score}`, {
          duration: 6000
        });  
      } else {
        toast.error(res.error || 'Failed to execute match');
      }
      
    } catch (err: any) {
      console.error('[MatchExecutor] Error executing match:', err);
      setError(err.message || 'Failed to execute match');
    } finally {
      setExecutingMatch(null);
    }
  };

  const executeRoundMatches = async (roundLevel: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const roundMatches = matches[roundLevel - 1].matches.filter((m: any) => !m.completed);
      console.log('roundLevel', roundLevel);
      console.log('total matches', matches);
      console.log('round matches', roundMatches);
      
      if (roundMatches.length === 0) {
        toast.info('No incomplete matches in this round');
        return;
      }

      console.log(`Starting execution of ${roundMatches.length} matches in round ${roundLevel}`);
      
      let completedCount = 0;
      let failedMatches: Array<{match: any, error: string}> = [];
      
      for (const match of roundMatches) {
        try {
          console.log(`[MatchExecutor] Executing match ${match.id}:`, {
            player1: match.player1_id,
            player2: match.player2_id
          });
          
          // Execute match using JavaScript logic
          await executeMatch(match.id);
          
          console.log(`[MatchExecutor] Match ${match.id} completed successfully`);
          completedCount++;
          
          // Small delay between matches
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err: any) {
          console.error(`[MatchExecutor] Failed to execute match ${match.id}:`, err);
          failedMatches.push({
            match: match,
            error: err.message || 'Unknown error'
          });
        }
      }
      
      // Reload matches after all executions
      await loadMatches();
      onMatchComplete();
      
      if (failedMatches.length > 0) {
        console.error('Failed matches:', failedMatches);
        const failedMatchDetails = failedMatches.map(fm => 
          `Match ${fm.match.id}: ${fm.error}`
        ).join('\n');
        
        toast.warning(`Round partially completed!\n${completedCount}/${roundMatches.length} matches executed successfully.\n\nFailed matches:\n${failedMatchDetails}`, {
          duration: 6000
        });
        setError(`Failed to execute ${failedMatches.length} matches. Check console for details.`);
      } else {
        toast.success(`Round completed! ${completedCount}/${roundMatches.length} matches executed successfully.`);
      }
      
    } catch (err: any) {
      console.error('Error executing round matches:', err);
      setError(err.message || 'Failed to execute round matches');
    } finally {
      setLoading(false);
    }
  };


  if (loading && matches.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
        <span>Loading matches...</span>
      </div>
    );
  }

  console.log('[matches]', matches);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Matches</h3>
        <button
          onClick={loadMatches}
          disabled={loading}
          className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Matches by Round */}
      {matches.map((roundGroup: any) => {
        const incompleteMatches = roundGroup.matches.filter((m: any) => m.completed === false);
        const completedMatches = roundGroup.matches.filter((m: any) => m.completed === true);
        
        return (
          <div key={`${roundGroup.round_level}-${roundGroup.round_name}`} 
               className="bg-white border border-gray-200 rounded-lg mb-6">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {roundGroup.round_name} (Level {roundGroup.round_level})
                  </h4>
                  <p className="text-sm text-gray-600">
                    {completedMatches.length}/{roundGroup.matches.length} matches completed
                  </p>
                </div>
                
                {incompleteMatches.length > 0 && (
                  <button
                    onClick={() => executeRoundMatches(roundGroup.round_level)}
                    disabled={loading}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Execute All ({incompleteMatches.length})
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roundGroup.matches.map((match: any) => {
                  const isExecuting = executingMatch === match.match_id;
                  
                  return (
                    <div key={match.match_id} 
                      className={`border rounded-lg p-4 ${
                        match.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}>
                      
                      {/* Match Header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-600">
                          Match
                        </span>
                        {match.winner_id ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>

                      {/* Players */}
                      <div className="space-y-2 mb-4">
                        <div className={`flex items-center justify-between p-2 rounded ${
                          match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-white'
                        }`}>
                          <div className="flex items-center">
                            <User className={`w-4 h-4 mr-2 ${match.player1_is_cpu ? 'text-blue-500' : 'text-green-500'}`} />
                            <div>
                              <span className="text-sm font-medium">{match.player1_name}</span>
                              <span className="text-xs text-gray-500 ml-1">
                                (Lv.{match.player1_level}) {match.player1_is_cpu ? 'CPU' : 'Player'}
                              </span>
                            </div>
                          </div>
                          {match.winner_id === match.player1_id && (
                            <Trophy className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        
                        <div className="text-center text-xs text-gray-500 py-1">vs</div>
                        
                        <div className={`flex items-center justify-between p-2 rounded ${
                          match.winner_id === match.player2_id ? 'bg-green-100 border border-green-300' : 'bg-white'
                        }`}>
                          <div className="flex items-center">
                            <User className={`w-4 h-4 mr-2 ${match.player2_is_cpu ? 'text-blue-500' : 'text-green-500'}`} />
                            <div>
                              <span className="text-sm font-medium">{match.player2_name}</span>
                              <span className="text-xs text-gray-500 ml-1">
                                (Lv.{match.player2_level}) {match.player2_is_cpu ? 'CPU' : 'Player'}
                              </span>
                            </div>
                          </div>
                          {match.winner_id === match.player2_id && (
                            <Trophy className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                      </div>

                      {/* Score */}
                      {match.score && (
                        <div className="text-xs text-gray-600 mb-3 p-2 bg-gray-100 rounded">
                          <strong>Score:</strong> {match.score}
                        </div>
                      )}

                      {/* Execute Button */}
                      {!match.completed && (
                        <button
                          onClick={() => executeMatch(match.id)}
                          disabled={isExecuting || loading}
                          className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {isExecuting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Executing...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Execute Match
                            </>
                          )}
                        </button>
                      )}

                      {/* Not Ready */}
                      {!match.completed && (!match.player1_id || !match.player2_id) && (
                        <div className="text-center text-xs text-gray-500 py-2 bg-gray-100 rounded">
                          Waiting for players...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {matches.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p>No matches found for this tournament</p>
        </div>
      )}
    </div>
  );
};

export default MatchExecutor; 