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

  // Determine champion when final round completes
  useEffect(() => {
    const findWinner = async () => {
      if (!rounds.length) return;
      const final = [...rounds].sort((a,b)=>a.level-b.level).pop();
      if (!final) return;
      if (!final.matches.every(m=>m.completed)) return;
      const last = [...final.matches]
        .sort((a,b)=>new Date(a.scheduledStart).getTime()-new Date(b.scheduledStart).getTime())
        .pop();
      if (!last?.winnerId) return;
      const { data } = await supabase.from('players').select('*').eq('id', last.winnerId).single();
      setTournamentWinner(data);
    };
    findWinner();
  }, [rounds]);

  // Utility
  const getName = (player:any) => player?.name || 'TBD';
  const isWinner = (player:any, winner:any, completed:boolean) => completed && winner?.id===player?.id;

  // Group by rounds
  const levels = Array.from(new Set(rounds.map(r=>r.level))).sort((a,b)=>a-b);
  const byLevel: Record<number, any[]> = {};
  rounds.forEach(r=> byLevel[r.level]=r.matches);

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <Trophy className="w-8 h-8 text-yellow-500"/>
          <h2 className="text-2xl font-bold text-gray-900">{tournamentName}</h2>
          {tournamentWinner &&
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full">
              <Crown className="w-4 h-4 mr-1"/>
              <span className="text-sm font-medium">Completed</span>
            </div>
          }
        </div>
        <button onClick={onBack} className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">Back</button>
      </div>

      {/* Champion Banner */}
      {tournamentWinner && (
        <div className="mb-6 p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-lg text-center">
          <div className="flex justify-center items-center space-x-4 mb-4">
            <Crown className="w-10 h-10 text-yellow-500"/>
            <Trophy className="w-16 h-16 text-yellow-500"/>
            <Crown className="w-10 h-10 text-yellow-500"/>
          </div>
          <h3 className="text-3xl font-bold text-yellow-800 mb-2">🎉 Tournament Champion! 🎉</h3>
          <div className="inline-flex items-center bg-white bg-opacity-70 rounded px-4 py-2">
            <Star className="w-6 h-6 text-yellow-500"/>
            <span className="mx-2 text-2xl font-bold text-gray-900">{tournamentWinner.name}</span>
            <Star className="w-6 h-6 text-yellow-500"/>
          </div>
          {tournamentWinner.id===currentPlayerId && <p className="mt-2 text-green-700 font-semibold">Congratulations, you won! 🏆</p>}
        </div>
      )}

      {/* Bracket Columns */}
      <div className="flex space-x-8">
        {levels.map((lvl, idx) => (
          <div key={lvl} className="min-w-[220px]">
            <h4 className="text-center font-semibold text-gray-700 mb-3">
              {rounds.find(r=>r.level===lvl)?.name || `Round ${lvl+1}`}
            </h4>
            <div className="space-y-4">
              {byLevel[lvl]?.map(match => (
                <div key={match.id} className={`rounded-lg p-3 shadow ${match.completed ? 'bg-green-50 border border-green-300' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-gray-500">Match {match.id.slice(0,4)}</span>
                    {match.completed ? <CheckCircle className="w-4 h-4 text-green-500"/> : <Clock className="w-4 h-4 text-yellow-500"/>}
                  </div>
                  <div className="space-y-1">
                    {[match.player1, match.player2].map((p:any,i)=>(
                      <div key={i} className={`px-2 py-1 rounded ${isWinner(p, tournamentWinner, match.completed) ? 'bg-green-100 border border-green-300' : ''}`}>
                        {getName(p)}
                        {p?.id===currentPlayerId && <span className="ml-1 text-xs text-blue-600">(You)</span>}
                      </div>
                    ))}
                  </div>
                  {match.score && <div className="mt-2 text-xs text-gray-600 text-center">Score: {match.score}</div>}
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