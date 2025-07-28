import React, { useEffect, useState } from 'react';
import { Trophy, Clock, Crown, Star, CheckCircle, User } from 'lucide-react';
import { TournamentRound } from '../../types/tournament';
import { supabase } from '@/lib/supabase';

interface SimpleTournamentBracketProps {
  registeredPlayers: any[];
  tournamentName: string;
  rounds: TournamentRound[];
  currentPlayerId: string;
  status:any;
  onBack: () => void;
}

const SimpleTournamentBracket: React.FC<SimpleTournamentBracketProps> = ({
  registeredPlayers,
  tournamentName,
  rounds,
  currentPlayerId,
  status,
  onBack,
}) => {
  console.log('Component mount', { registeredPlayers, tournamentName, rounds, status, currentPlayerId });

  const [tournamentWinner, setTournamentWinner] = useState<any | null>(null);

  const getPlayerDisplay = (player: any) => {
    console.log('getPlayerDisplay called with', player);
    if (!player) return 'TBD';
    return player.name;
  };

  const getTournamentWinner = async () => {
    console.log('getTournamentWinner start', rounds);
    if (!rounds?.length) {
      console.log('No rounds, returning null');
      return null;
    }

    const finalRound = [...rounds].sort((a, b) => a.level - b.level).pop();
    console.log('Identified finalRound', finalRound);
    if (!finalRound || !finalRound.matches?.length) {
      console.log('No finalRound matches, returning null');
      return null;
    }

    const allCompleted = finalRound.matches.every((m) => m.completed);
    console.log('allCompleted for finalRound', allCompleted);
    if (!allCompleted) {
      console.log('Final round not completed, returning null');
      return null;
    }

    const lastMatch = [...finalRound.matches]
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
      .pop();
    console.log('Determined lastMatch', lastMatch);

    if (!lastMatch?.winnerId) {
      console.log('No winnerId on lastMatch, returning null');
      return null;
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', lastMatch.winnerId)
      .single();

    if (error) {
      console.error('Error fetching winner:', error);
      return null;
    }

    console.log('Fetched winner data', data);
    return data;
  };

  const isTournamentCompleted = () => {
    console.log("Status ", status)
    return (status === "completed")
  };

  useEffect(() => {
    console.log('useEffect triggered for rounds change');
    const fetchWinner = async () => {
      console.log('fetchWinner called');
      const winner = await getTournamentWinner();
      console.log('Winner from getTournamentWinner', winner);
      setTournamentWinner(winner);
    };
    fetchWinner();
  }, [rounds]);

  const tournamentCompleted = isTournamentCompleted();
  console.log('tournamentCompleted:', tournamentCompleted);
  console.log('tournamentWinner state:', tournamentWinner);

  const getWinnerDisplayName = () => {
    console.log('getWinnerDisplayName called');
    if (!tournamentWinner) return 'Unknown';
    return tournamentWinner.name || getPlayerDisplay(tournamentWinner);
  };

  const isPlayerWinner = (player: any, winner_id: any, matchCompleted: boolean) => {
    console.log('isPlayerWinner check', { player, winner_id, matchCompleted });
    if (!player || !winner_id || !matchCompleted) return false;
    return winner_id === player.id;
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg p-6">
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
        <button onClick={onBack} className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors">
          Back
        </button>
      </div>

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
                <span className="text-2xl font-bold text-gray-900">{getWinnerDisplayName()}</span>
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
              {tournamentWinner.id === currentPlayerId && (
                <div className="mt-2 text-green-700 font-semibold">Congratulations! You won the tournament! 🏆</div>
              )}
            </div>
          </div>
        </div>
      )}


      <div className="overflow-auto w-full">
  <div className="flex items-start space-x-6 min-w-max">
    {rounds
      .sort((a, b) => a.level - b.level)
      .map((round, roundIndex) => (
        <div key={roundIndex} className="min-w-[220px]">
          <h4 className="font-semibold text-center mb-4 text-gray-800">
            {round.name}
          </h4>
          <div className="flex flex-col space-y-6">
            {round.matches.map((match, matchIndex) => {
              const isPlayer1Winner = isPlayerWinner(match.players?.[0], match.winnerId, match.completed);
              const isPlayer2Winner = isPlayerWinner(match.players?.[1], match.winnerId, match.completed);

              return (
                <div
                  key={match.id}
                  className={`border rounded-lg p-3 text-center ${
                    match.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {match.completed ? 'Completed' : 'Upcoming'}
                  </div>

                  {/* Player 1 */}
                  <div
                    className={`flex justify-between items-center px-2 py-1 rounded ${
                      isPlayer1Winner ? 'bg-green-100 border border-green-300' : ''
                    }`}
                  >
                    <span className="text-sm text-gray-800">{getPlayerDisplay(match.players?.[0])}</span>
                    {match.players?.[0]?.id === currentPlayerId && (
                      <span className="text-xs text-blue-500 ml-1">(You)</span>
                    )}
                    {isPlayer1Winner && <Trophy className="w-4 h-4 text-yellow-500" />}
                  </div>

                  <div className="text-xs my-1 text-gray-500">vs</div>

                  {/* Player 2 */}
                  <div
                    className={`flex justify-between items-center px-2 py-1 rounded ${
                      isPlayer2Winner ? 'bg-green-100 border border-green-300' : ''
                    }`}
                  >
                    <span className="text-sm text-gray-800">{getPlayerDisplay(match.players?.[1])}</span>
                    {match.players?.[1]?.id === currentPlayerId && (
                      <span className="text-xs text-blue-500 ml-1">(You)</span>
                    )}
                    {isPlayer2Winner && <Trophy className="w-4 h-4 text-yellow-500" />}
                  </div>

                  {/* Score */}
                  {match.score && (
                    <div className="text-xs text-gray-700 mt-2">
                      <strong>Score:</strong> {match.score}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
  </div>
</div>


      {!rounds?.length && (
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