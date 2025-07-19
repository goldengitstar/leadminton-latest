import React from 'react';
import { Trophy, Clock, Crown, Star, CheckCircle } from 'lucide-react';
import { TournamentRound } from '../../types/tournament';

interface SimpleTournamentBracketProps {
  registeredPlayers: any[];
  tournamentName: string;
  rounds: TournamentRound[];
  currentPlayerId: string;
  onBack: () => void;
}

const SimpleTournamentBracket: React.FC<SimpleTournamentBracketProps> = ({
  registeredPlayers,
  tournamentName,
  rounds,
  currentPlayerId,
  onBack
}) => {
  const getPlayerDisplay = (player: any) => {
    if (!player) return 'TBD';
    if (player.is_cpu) return player.name;
    return player.name;
  };

  // Check if tournament is completed and find the winner
  const getTournamentWinner = (): typeof registeredPlayers[0] | null => {
    if (!rounds?.length) return null;

    // 1. Identify the final round (highest level)
    const finalRound = rounds.slice().sort((a, b) => a.level - b.level).pop()!;
    if (!finalRound.matches?.length) return null;

    // 2. Ensure all final‐round matches have completed
    const allCompleted = finalRound.matches.every(m => m.completed);
    if (!allCompleted) return null;

    // 3. Find the last match (or the one with the latest scheduledStart)
    const lastMatch = finalRound.matches
      .slice()
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
      .pop()!;

    console.log('Final match winnerId:', lastMatch.winnerId);

    // 4. Look up that player in registeredPlayers
    return registeredPlayers.find(p => p.id === lastMatch.winner_id) ?? null;
  };

  // Check if all tournament matches are completed
  const isTournamentCompleted = () => {
    if (!rounds || rounds.length === 0) return false;
    return rounds.every(round => 
      round.matches.every(match => match.completed)
    );
  };

  const tournamentWinner = getTournamentWinner();
  const tournamentCompleted = isTournamentCompleted();

  // Add debugging
  console.log('Tournament winner:', tournamentWinner);
  console.log('Tournament completed:', tournamentCompleted);

  // Get winner display name
  const getWinnerDisplayName = () => {
    if (!tournamentWinner) return 'Unknown';
    
    // Try different ways to get the name
    if (tournamentWinner.name) return tournamentWinner.name;
    if (typeof tournamentWinner === 'string') return tournamentWinner;
    
    return getPlayerDisplay(tournamentWinner);
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900">{tournamentName}</h2>
          {tournamentCompleted && (
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full">
              <Crown className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Completed</span>
            </div>
          )}
        </div>
        
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
        >
          Back
        </button>
      </div>

      {/* Tournament Winner Highlight */}
      {tournamentCompleted && tournamentWinner && (
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Crown className="w-12 h-12 text-yellow-500 mr-3" />
              <Trophy className="w-16 h-16 text-yellow-500" />
              <Crown className="w-12 h-12 text-yellow-500 ml-3" />
            </div>
            <h3 className="text-3xl font-bold text-yellow-800 mb-2">
              🎉 Tournament Champion! 🎉
            </h3>
            <div className="bg-white bg-opacity-70 rounded-lg p-4 inline-block">
              <div className="flex items-center justify-center space-x-2">
                <Star className="w-6 h-6 text-yellow-500" />
                <span className="text-2xl font-bold text-gray-900">
                  {getWinnerDisplayName()}
                </span>
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
              {tournamentWinner.id === currentPlayerId && (
                <div className="mt-2 text-green-700 font-semibold">
                  Congratulations! You won the tournament! 🏆
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tournament Bracket */}
      <div className="space-y-6">
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">{round.name}</h4>
              <span className="text-sm text-gray-600">
                {round.matches.filter(m => m.completed).length}/{round.matches.length} matches
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {round.matches.map((match: any) => {
                // Debug logging for each match
                console.log('Match data:', {
                  matchId: match.id,
                  completed: match.completed,
                  winner: match.winner,
                  players: match.players,
                  player0: match.players[0],
                  player1: match.players[1]
                });

                // Helper function to check if player is winner
                const isPlayerWinner = (player: any, winner: any) => {
                  if (!player || !winner || !match.completed) return false;
                  
                  // Try multiple ways to match
                  return (
                    winner.id === player.id ||
                    winner === player.id ||
                    (typeof winner === 'string' && winner === player.id) ||
                    winner === player
                  );
                };

                return (
                  <div key={match.id} className={`border rounded p-3 ${
                    match.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Match {match.id}</span>
                      {match.completed ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className={`p-2 rounded-md ${isPlayerWinner(match.players[0], match.winner) ? 'bg-green-100 border border-green-300 ' : ''}`}>
                        {match.players[0]?.name || 'TBD'}
                        {isPlayerWinner(match.players[0], match.winner) && (
                          <Trophy className="w-3 h-3 text-yellow-500 inline ml-1 float-right" />
                        )}
                        {match.players[0]?.id === currentPlayerId && (
                          <span className="text-xs text-blue-600 font-medium ml-1">(You)</span>
                        )}
                      </div>
                      <div className="text-center text-xs text-gray-500">vs</div>
                      <div className={`p-2 rounded-md ${isPlayerWinner(match.players[1], match.winner) ? 'bg-green-100 border border-green-300' : ''}`}>
                        {match.players[1]?.name || 'TBD'}
                        {isPlayerWinner(match.players[1], match.winner) && (
                          <Trophy className="w-3 h-3 text-yellow-500 inline ml-1 float-right" />
                        )}
                        {match.players[1]?.id === currentPlayerId && (
                          <span className="text-xs text-blue-600 font-medium ml-1">(You)</span>
                        )}
                      </div>
                    </div>
                    
                    {match.score && (
                      <div className="text-xs text-gray-600 mt-4 text-center bg-white p-2">
                        Score: {match.score}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {(!rounds || rounds.length === 0) && (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Tournament Bracket Available</h3>
          <p className="text-gray-500">The tournament bracket will appear once the tournament starts.</p>
        </div>
      )}
    </div>
  );
};

export default SimpleTournamentBracket; 