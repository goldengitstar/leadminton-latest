import React, { useState, useEffect } from 'react';
import { Tournament, TournamentRound } from '../../types/tournament';
import { 
  Play, 
  Trophy, 
  Users, 
  Clock, 
  Calendar,
  Zap,
  AlertCircle,
  Target,
  Crown,
  Star,
  Info,
  Activity
} from 'lucide-react';
import MatchExecutor from './MatchExecutor';
import TournamentAutoStarter from './TournamentAutoStarter';
import { toast } from 'sonner';
import { TournamentService } from '@/services/database/tournamentService';
import { supabase } from '@/lib/supabase';

const tournamentService = new TournamentService(supabase);


interface TournamentManagementProps {
  tournament: any;
  onTournamentUpdate: () => void;
}

const TournamentManagement: React.FC<TournamentManagementProps> = ({ 
  tournament, 
  onTournamentUpdate 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'info'>('matches');
  const [registeredPlayers, setRegisteredPlayers] = useState<any[]>([]);
  const [tournamentWinner, setTournamentWinner] = useState<string>('');

  // Load registered players when needed
  const loadRegisteredPlayers = async () => {
    try {
      const registrations = await tournamentService.getRegisteredPlayers(tournament.id);

      return (registrations || []).map((reg: any) => ({
        id: reg.players.id,
        name: reg.players.name,
        level: reg.players.level,
        is_cpu: reg.players.is_cpu || false
      }));
    } catch (error) {
      console.error('Error loading registered players:', error);
      return [];
    }
  };

  const startTournament = async () => {
    setLoading(true);
    setError(null);
    
    try {
      
      await tournamentService.startTournament(tournament.id);

      console.log('[TournamentManagement] Tournament started successfully', tournament.id);
      onTournamentUpdate();
      toast.success('Tournament started successfully!');
    } catch (err: any) {
      console.error('[TournamentManagement] Error starting tournament:', err);
      setError(err.message || 'Failed to start tournament');
    } finally {
      setLoading(false);
    }
  };

  const canStartTournament = () => {
    return tournament.status === 'upcoming' && new Date(tournament.start_date) <= new Date();
  };

  const getTournamentStats = () => {
    if (!tournament.rounds) return { totalMatches: 0, completedMatches: 0, currentRound: null as TournamentRound | null };
    
    let totalMatches = 0;
    let completedMatches = 0;
    let currentRound: TournamentRound | null = null;
    
    tournament.rounds.forEach((round: any) => {
      totalMatches += round.matches.length;
      const roundCompleted = round.matches.filter((m: any) => m.completed).length;
      completedMatches += roundCompleted;
      
      if (!currentRound && roundCompleted < round.matches.length) {
        currentRound = round;
      }
    });
    
    return { totalMatches, completedMatches, currentRound };
  };

  // Check if tournament is completed and find the winner
  const loadTournamentWinner = async () => {
    if (!tournament.rounds || tournament.rounds.length === 0) {
      setTournamentWinner('');
      return;
    }
    
    // Get the final round (highest level/last round)
    const finalRound = tournament.rounds[tournament.rounds.length - 1];
    
    // Check if all matches in the final round are completed
    const allFinalMatchesCompleted = finalRound.matches.every((match: any) => match.completed);
    
    if (allFinalMatchesCompleted && finalRound.matches.length > 0) {
      // For single elimination, the winner is the winner of the last match in the final round
      const finalMatch = finalRound.matches[finalRound.matches.length - 1];

      let winnerName: string;

      if (finalMatch.winner_id === finalMatch.player1_id) {
        winnerName = finalMatch.player1_name;
      } else if (finalMatch.winner_id === finalMatch.player2_id) {
        winnerName = finalMatch.player2_name;
      } else {
        winnerName = "unknown"
      }
      setTournamentWinner(winnerName)
    }
  };

  // Load winner when tournament is completed
  useEffect(() => {
    if (isTournamentCompleted()) {
      console.log("Tournament completed")
      loadTournamentWinner();
    }else {
      console.log("Tournament not completed")
    }
  }, [tournament.rounds, registeredPlayers]);

  // Check if all tournament matches are completed
  const isTournamentCompleted = () => {
    if (!tournament.rounds || tournament.rounds.length === 0) return false;
    return tournament.rounds.every((round: any) => 
      round.matches.every((match: any) => match.completed)
    );
  };

  const stats = getTournamentStats();
  const tournamentCompleted = isTournamentCompleted();

  return (
    <div>
      {/* Tournament Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Trophy className="w-6 h-6 text-yellow-500 mr-2" />
              {tournament.name}
              {tournamentCompleted && (
                <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full ml-3">
                  <Crown className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Completed</span>
                </div>
              )}
            </h2>
            <div className="flex items-center space-x-4 mt-2">
              <span className={`px-2 py-1 rounded-full text-xs ${
                tournament.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                tournament.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
              </span>
              <span className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-1" />
                {tournament.current_participants}/{tournament.max_participants} participants
              </span>
              <span className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(tournament.start_date).toLocaleDateString()}
              </span>
              {tournament.status === 'ongoing' && (
                <span className="flex items-center text-sm text-gray-600">
                  <Target className="w-4 h-4 mr-1" />
                  {stats.completedMatches}/{stats.totalMatches} matches completed
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {canStartTournament() && (
              <button
                onClick={startTournament}
                disabled={loading}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Play className="w-4 h-4 mr-2" />
                {loading ? 'Starting...' : 'Start Now (Manual)'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tournament Winner Highlight */}
      {tournamentCompleted && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Crown className="w-10 h-10 text-yellow-500 mr-3" />
              <Trophy className="w-12 h-12 text-yellow-500" />
              <Crown className="w-10 h-10 text-yellow-500 ml-3" />
            </div>
            <h3 className="text-xl font-bold text-yellow-800 mb-2">
              🏆 Tournament Champion 🏆
            </h3>
            <div className="bg-white bg-opacity-70 rounded-lg p-4 inline-block">
              <div className="flex items-center justify-center space-x-2">
                <Star className="w-5 h-5 text-yellow-500" />
                                  <span className="text-xl font-bold text-gray-900">
                    {tournamentWinner || 'Loading...'}
                  </span>
                <Star className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Start Countdown */}
      <div className="mb-6">
        <TournamentAutoStarter 
          tournament={tournament}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Current Round Status */}
      {tournament.status === 'ongoing' && stats.currentRound && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">
                Current Round: {stats.currentRound.name}
              </h3>
              <p className="text-blue-700 text-sm">
                {stats.currentRound.matches.filter((m: any) => m.completed).length} of {stats.currentRound.matches.length} matches completed
              </p>
            </div>
            <div className="flex items-center text-blue-700">
              <Clock className="w-5 h-5 mr-2" />
              <span className="text-sm">In Progress</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('matches')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'matches'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Play className="w-4 h-4 inline mr-2" />
              Manual Execution
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Info className="w-4 h-4 inline mr-2" />
              Information
            </button>
          </nav>
        </div>

        <div className="p-6">


          {/* Match Execution Tab */}
          {activeTab === 'matches' && (
            <MatchExecutor
              tournamentId={tournament.id}
              onMatchComplete={onTournamentUpdate}
            />
          )}

          {/* Information Tab */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Info className="w-4 h-4 mr-2" />
                    Tournament Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-mono text-xs">{tournament.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tier:</span>
                      <span className="capitalize">{tournament.tier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min Level:</span>
                      <span>{tournament.min_player_level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max Participants:</span>
                      <span>{tournament.max_participants}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Round Interval:</span>
                      <span>{tournament.round_interval_minutes} minutes</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Activity className="w-4 h-4 mr-2" />
                    Tournament Stats
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Matches:</span>
                      <span className="font-medium">{stats.totalMatches}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completed Matches:</span>
                      <span className="font-medium text-green-600">{stats.completedMatches}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Remaining Matches:</span>
                      <span className="font-medium text-yellow-600">{stats.totalMatches - stats.completedMatches}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Progress:</span>
                      <span className="font-medium">
                        {stats.totalMatches > 0 ? Math.round((stats.completedMatches / stats.totalMatches) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Trophy className="w-4 h-4 mr-2" />
                  Prize Pool Configuration
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <h5 className="font-medium text-yellow-800 mb-2">1st Place</h5>
                    <div className="text-sm text-yellow-700">
                      {tournament.prize_pool.first.coins && <div>Coins: {tournament.prize_pool.first.coins}</div>}
                      {tournament.prize_pool.first.diamonds && <div>Diamonds: {tournament.prize_pool.first.diamonds}</div>}
                      {tournament.prize_pool.first.shuttlecocks && <div>Shuttlecocks: {tournament.prize_pool.first.shuttlecocks}</div>}
                      {tournament.prize_pool.first.meals && <div>Meals: {tournament.prize_pool.first.meals}</div>}
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <h5 className="font-medium text-gray-800 mb-2">2nd Place</h5>
                    <div className="text-sm text-gray-700">
                      {tournament.prize_pool.second.coins && <div>Coins: {tournament.prize_pool.second.coins}</div>}
                      {tournament.prize_pool.second.diamonds && <div>Diamonds: {tournament.prize_pool.second.diamonds}</div>}
                      {tournament.prize_pool.second.shuttlecocks && <div>Shuttlecocks: {tournament.prize_pool.second.shuttlecocks}</div>}
                      {tournament.prize_pool.second.meals && <div>Meals: {tournament.prize_pool.second.meals}</div>}
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <h5 className="font-medium text-amber-800 mb-2">3rd Place</h5>
                    <div className="text-sm text-amber-700">
                      {tournament.prize_pool.third.coins && <div>Coins: {tournament.prize_pool.third.coins}</div>}
                      {tournament.prize_pool.third.diamonds && <div>Diamonds: {tournament.prize_pool.third.diamonds}</div>}
                      {tournament.prize_pool.third.shuttlecocks && <div>Shuttlecocks: {tournament.prize_pool.third.shuttlecocks}</div>}
                      {tournament.prize_pool.third.meals && <div>Meals: {tournament.prize_pool.third.meals}</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentManagement; 