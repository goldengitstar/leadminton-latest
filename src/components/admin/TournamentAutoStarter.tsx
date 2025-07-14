import React, { useState, useEffect } from 'react';
import { Tournament } from '../../types/tournament';
import { Timer, Play, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { TournamentService } from '@/services/database/tournamentService';
import { supabase } from '@/lib/supabase';

const tournamentService = new TournamentService(supabase);

interface TournamentAutoStarterProps {
  tournament: Tournament;
}

// Helper function to populate tournament bracket with proper bye handling
// const populateTournamentBracket = async (tournamentId: string, rounds: any[], registeredPlayers: any[]) => {
//   console.log('[populateTournamentBracket] Starting bracket population');
  
//   // Shuffle players for random seeding
//   const shuffledPlayers = [...registeredPlayers].sort(() => Math.random() - 0.5);
//   const playerCount = shuffledPlayers.length;
  
//   // Find the bracket size (next power of 2)
//   const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(playerCount, 2))));
//   const firstRoundMatches = bracketSize / 2;
  
//   console.log('[populateTournamentBracket] Player count:', playerCount, 'Bracket size:', bracketSize, 'First round matches:', firstRoundMatches);
  
//   // Get first round
//   const firstRound = rounds.find(r => r.level === 1);
//   if (!firstRound) {
//     console.error('[populateTournamentBracket] No first round found');
//     return;
//   }
  
//   // Get matches for first round
//   const { data: matches, error: matchesError } = await supabase
//     .from('match')
//     .select('*')
//     .eq('round_id', firstRound.id)
//     .order('id');

//   if (matchesError) {
//     console.error('[populateTournamentBracket] Error loading matches:', matchesError);
//     return;
//   }
  
//   // Calculate byes needed
//   const byesNeeded = bracketSize - playerCount;
//   const playersInFirstRound = playerCount - byesNeeded;
//   const matchesWithPlayers = Math.floor(playersInFirstRound / 2);
  
//   console.log('[populateTournamentBracket] Byes needed:', byesNeeded, 'Players in first round:', playersInFirstRound, 'Matches with players:', matchesWithPlayers);
  
//   // Populate first round matches
//   for (let i = 0; i < matches.length; i++) {
//     if (i < matchesWithPlayers) {
//       // Match with two players
//       const player1 = shuffledPlayers[i * 2];
//       const player2 = shuffledPlayers[i * 2 + 1];
      
//       await supabase
//         .from('match')
//         .update({
//           player1_id: player1?.playerId || null,
//           player2_id: player2?.playerId || null
//         })
//         .eq('id', matches[i].id);
        
//       console.log('[populateTournamentBracket] Match', i + 1, ':', player1?.playerName, 'vs', player2?.playerName);
//     } else {
//       // Empty match (will be filled by winners from previous matches or byes)
//       await supabase
//         .from('match')
//         .update({
//           player1_id: null,
//           player2_id: null
//         })
//         .eq('id', matches[i].id);
//     }
//   }
  
//   // Handle players who get byes to second round
//   if (byesNeeded > 0) {
//     const playersWithByes = shuffledPlayers.slice(playersInFirstRound);
//     console.log('[populateTournamentBracket] Players with byes:', playersWithByes.map(p => p.playerName));
    
//     // Get second round and populate with bye players
//     const secondRound = rounds.find(r => r.level === 2);
//     if (secondRound) {
//       const { data: secondRoundMatches, error: secondMatchesError } = await supabase
//         .from('match')
//         .select('*')
//         .eq('round_id', secondRound.id)
//         .order('id');

//       if (!secondMatchesError && secondRoundMatches) {
//         // Place bye players in second round matches
//         for (let i = 0; i < Math.min(playersWithByes.length, secondRoundMatches.length); i++) {
//           const byePlayer = playersWithByes[i];
          
//           await supabase
//             .from('match')
//             .update({
//               player1_id: byePlayer.playerId
//             })
//             .eq('id', secondRoundMatches[i].id);
            
//           console.log('[populateTournamentBracket] Bye to second round:', byePlayer.playerName);
//         }
//       }
//     }
//   }
// };

const TournamentAutoStarter: React.FC<TournamentAutoStarterProps> = ({
  tournament,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialStartTime] = useState(tournament.start_date); // Store initial time

  useEffect(() => {
    // Only show countdown for upcoming tournaments
    if (tournament.status !== 'upcoming') {
      return;
    }

    // Stop countdown if there's an error, tournament is starting, or already started
    if (error || isStarting || hasStarted) {
      console.log('[TournamentAutoStarter] Stopping countdown due to:', { error, isStarting, hasStarted });
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, new Date(initialStartTime).getTime() - now); // Use stored initial time
      console.log('[TournamentAutoStarter] Time left:', diff / 1000, 'seconds');
  
      setTimeLeft(diff);
      // Auto-start tournament when countdown reaches zero
      // Only auto-start if no error occurred and not already started/starting
      if (diff === 0 && !isStarting && !hasStarted && !error) {
        startTournament();
      }
    };

    updateCountdown();
    // Update every second for countdown, no need to refetch data
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [error, isStarting, hasStarted, tournament.status]); // Add dependencies to re-run when these states change

  const startTournament = async () => {
    try {
      setIsStarting(true);
      setError(null);
      
      const res = await tournamentService.startTournament(tournament.id);
      if(res.success) {
        console.log('[TournamentAutoStarter] Tournament auto-started successfully');
        setHasStarted(true);
        setError(null);
      } else {
        setError('Failed to start tournament');
      }
    } catch (err: any) {
      console.error('[TournamentAutoStarter] Error auto-starting tournament:', err);
      setError(err.message || 'Failed to start tournament');
    } finally {
      setIsStarting(false);
    }
  };

  const formatTimeLeft = (ms: number): string => {
    if (ms <= 0) return 'Starting Tournament...';

    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const parts: string[] = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && days === 0) parts.push(`${seconds}s`);

    return parts.join(' ') || 'Starting...';
  };

  // Don't show anything for non-upcoming tournaments
  if (tournament.status !== 'upcoming') {
    return null;
  }

  const isStartingSoon = timeLeft > 0 && timeLeft <= 300000; // 5 minutes
  const isReadyToStart = timeLeft <= 0;

  return (
    <div className={`rounded-lg p-4 mb-4 ${
      error ? 'bg-red-50 border border-red-200' :
      hasStarted ? 'bg-green-50 border border-green-200' :
      isReadyToStart ? 'bg-red-50 border border-red-200' : 
      isStartingSoon ? 'bg-yellow-50 border border-yellow-200' : 
      'bg-blue-50 border border-blue-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {error ? (
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          ) : hasStarted ? (
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          ) : isStarting ? (
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Timer className={`w-5 h-5 mr-2 ${
              isReadyToStart ? 'text-red-600 animate-pulse' : 
              isStartingSoon ? 'text-yellow-600' : 
              'text-blue-600'
            }`} />
          )}
          
          <div>
            <h4 className={`font-medium ${
              error ? 'text-red-800' :
              hasStarted ? 'text-green-800' :
              isReadyToStart ? 'text-red-800' : 
              isStartingSoon ? 'text-yellow-800' : 
              'text-blue-800'
            }`}>
              {error ? 'Auto-Start Failed!' :
               hasStarted ? 'Tournament Started!' :
               isStarting ? 'Starting Tournament...' :
               isReadyToStart ? 'Auto-Starting Tournament' :
               'Tournament Auto-Start'}
            </h4>
            <p className={`text-sm ${
              error ? 'text-red-600' :
              hasStarted ? 'text-green-600' :
              isReadyToStart ? 'text-red-600' : 
              isStartingSoon ? 'text-yellow-600' : 
              'text-blue-600'
            }`}>
              {error ? `Error: ${error}` :
               hasStarted ? 'Tournament has been automatically started and is now ongoing' :
               isStarting ? 'Please wait while the tournament is being started...' :
               isReadyToStart ? 'Tournament start time reached - starting automatically' :
               'Tournament will start automatically when the countdown reaches zero'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${
            error ? 'text-red-700' :
            hasStarted ? 'text-green-700' :
            isReadyToStart ? 'text-red-700' : 
            isStartingSoon ? 'text-yellow-700' : 
            'text-blue-700'
          }`}>
            {hasStarted ? 'STARTED' : formatTimeLeft(timeLeft)}
          </div>
          {!hasStarted && (
            <div className={`text-xs ${
              error ? 'text-red-600' :
              isReadyToStart ? 'text-red-600' : 
              isStartingSoon ? 'text-yellow-600' : 
              'text-blue-600'
            }`}>
              {isReadyToStart ? 'Starting now...' : 'until tournament starts'}
            </div>
          )}
        </div>
      </div>

      {/* Error Reset Button */}
      {error && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <button
            onClick={() => setError(null)}
            className="flex items-center px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset Error
          </button>
        </div>
      )}

      {/* Manual Start Button */}
      {!error && !hasStarted && !isStarting && timeLeft <= 60000 && ( // Show button in last minute
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={startTournament}
            disabled={isStarting}
            className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm"
          >
            <Play className="w-4 h-4 mr-1" />
            Start Now (Manual)
          </button>
        </div>
      )}

      {/* Manual Start Button */}
      {timeLeft <= 0 && !hasStarted && ( // Show button in last minute
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={startTournament}
            disabled={isStarting}
            className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm"
          >
            <Play className="w-4 h-4 mr-1" />
            Start Now (Manual)
          </button>
        </div>
      )}
    </div>
  );
};

export default TournamentAutoStarter; 