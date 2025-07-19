import React, { useEffect, useState } from 'react';
import { Trophy, Clock, Crown, Star, CheckCircle } from 'lucide-react';
import { TournamentRound } from '../../types/tournament';
import { supabase } from '@/lib/supabase';

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
  onBack,
}) => {
  const [tournamentWinner, setTournamentWinner] = useState<any | null>(null);

  const getTournamentWinner = async () => {
    if (!rounds?.length) return null;
    const finalRound = [...rounds].sort((a, b) => a.level - b.level).pop();
    if (!finalRound || !finalRound.matches?.length) return null;
    const allCompleted = finalRound.matches.every((m) => m.completed);
    if (!allCompleted) return null;
    const lastMatch = [...finalRound.matches].sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()).pop();
    if (!lastMatch?.winnerId) return null;
    const { data, error } = await supabase.from('players').select('*').eq('id', lastMatch.winnerId).single();
    if (error) return null;
    return data;
  };

  useEffect(() => {
    const fetchWinner = async () => {
      const winner = await getTournamentWinner();
      setTournamentWinner(winner);
    };
    fetchWinner();
  }, [rounds]);

  const getWinnerDisplayName = () => tournamentWinner?.name ?? 'Unknown';

  const isPlayerWinner = (player: any, winner: any, matchCompleted: boolean) => {
    if (!player || !winner || !matchCompleted) return false;
    return winner.id === player.id || winner === player.id || winner === player;
  };

  const getPlayerDisplay = (player: any) => player?.name ?? 'TBD';

  // Group matches by round level
  const roundLevels = Array.from(new Set(rounds.map(r => r.level))).sort((a, b) => a - b);

  const levelMatchMap: Record<number, any[]> = {};
  rounds.forEach(round => {
    if (!levelMatchMap[round.level]) levelMatchMap[round.level] = [];
    levelMatchMap[round.level].push(...(round.matches ?? []));
  });

  return (
    <div className="w-full overflow-x-auto bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900">{tournamentName}</h2>
          {tournamentWinner && (
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

      {tournamentWinner && (
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Crown className="w-12 h-12 text-yellow-500 mr-3" />
              <Trophy className="w-16 h-16 text-yellow-500" />
              <Crown className="w-12 h-12 text-yellow-500 ml-3" />
            </div>
            <h3 className="text-3xl font-bold text-yellow-800 mb-2">🎉 Tournament Champion! 🎉</h3>
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

      <div className="flex flex-row space-x-8 overflow-x-auto">
        {roundLevels.map((level, levelIndex) => (
          <div key={levelIndex} className="min-w-[200px]">
            <h4 className="text-center font-bold text-gray-700 mb-3">Round {level + 1}</h4>
            <div className="space-y-6">
              {levelMatchMap[level]?.map((match, matchIndex) => (
                <div
                  key={match.id || matchIndex}
                  className={`border rounded-lg p-3 text-sm shadow-sm ${
                    match.completed ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Match</span>
                    {match.completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {[0, 1].map(i => (
                      <div
                        key={i}
                        className={`px-2 py-1 rounded ${
                          isPlayerWinner(match.players?.[i], match.winner, match.completed)
                            ? 'bg-green-100 border border-green-300'
                            : ''
                        }`}
                      >
                        {getPlayerDisplay(match.players?.[i])}
                        {match.players?.[i]?.id === currentPlayerId && (
                          <span className="ml-1 text-xs text-blue-600 font-medium">(You)</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {match.score && (
                    <div className="mt-2 text-center text-xs text-gray-600">Score: {match.score}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimpleTournamentBracket;