import { useEffect, useState, useCallback, memo } from 'react';
import { useGame } from '../contexts/GameContext';
import { supabase } from '../lib/supabase';
import { Tournament } from '../types/tournament';
import { Player } from '../types/game';
import { Trophy, Users, Clock, Coins, CheckCircle, AlertCircle, Calendar, ArrowLeft, Timer } from 'lucide-react';
import { TournamentService } from '../services/database/tournamentService';
import PlayerSelectionModal from '../components/tournaments/PlayerSelectionModal';
import TournamentResults from '../components/tournaments/TournamentResults';
import SimpleTournamentBracket from '../components/tournaments/SimpleTournamentBracket';

const tournamentService = new TournamentService(supabase);

interface Notification {
  type: 'success' | 'error';
  message: string;
}

interface Match {
  player1Id: string;
  player2Id: string;
  players?: Player[];
}

interface Round {
  matches: Match[];
}


// Separate countdown timer component to isolate timer state updates
const CountdownTimer = memo(({ 
  tournament, 
  className 
}: { 
  tournament: Tournament; 
  className?: string 
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
   const updateCountdown = () => {
      const now = Date.now();

      const rawTarget = 
        tournament.status === 'ongoing' && tournament.next_round_start_time
          ? tournament.next_round_start_time
          : tournament.start_date;

      // Convert the ISO string (or Date object) to a millisecond timestamp:
      const targetTime = new Date(rawTarget).getTime();

      if (Number.isNaN(targetTime)) {
        console.error("Invalid tournament date:", rawTarget);
        return;
      }

      const diff = Math.max(0, targetTime - now);
      setTimeLeft(diff);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [tournament.start_date, tournament.next_round_start_time, tournament.status]);

  const formatTimeLeft = (ms: number): string => {
    if (ms <= 0) return 'Tournament Started!';

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

  const hasStarted = timeLeft <= 0;
  console.log("has started", hasStarted)
  const isStartingSoon = timeLeft > 0 && timeLeft <= 300000; // Less than 5 minutes
  console.log("Starting soon", isStartingSoon)

  return (
    <div className={`flex items-center space-x-2 px-6 py-3 rounded-full ${
      hasStarted ? 'bg-red-100' : 
      isStartingSoon ? 'bg-yellow-100' : 
      'bg-blue-100'
    } ${className || ''}`}>
      <Timer className={`w-6 h-6 ${
        hasStarted ? 'text-red-600' : 
        isStartingSoon ? 'text-yellow-600' : 
        'text-blue-600'
      } animate-pulse`} />
      <div className="text-center">
        <div className={`text-lg font-mono font-bold ${
          hasStarted ? 'text-red-700' : 
          isStartingSoon ? 'text-yellow-700' : 
          'text-blue-700'
        }`}>
          {formatTimeLeft(timeLeft)}
        </div>
        <div className={`text-xs ${
          hasStarted ? 'text-red-600' : 
          isStartingSoon ? 'text-yellow-600' : 
          'text-blue-600'
        }`}>
          {hasStarted ? 
            (tournament.status === 'ongoing' && tournament.next_round_start_time ? 'Round Ready!' : 'Tournament Started!') : 
            (tournament.status === 'ongoing' && tournament.next_round_start_time ? 'Until Next Round' : 'Until Tournament Starts')
          }
        </div>
      </div>
    </div>
  );
});

export default function TournamentsPage() {
  const { gameState, resources } = useGame();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeredTournaments, setRegisteredTournaments] = useState<string[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [eligiblePlayers, setEligiblePlayers] = useState<Player[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [completedTournament, setCompletedTournament] = useState<Tournament | null>(null);
  const [detailViewTournament, setDetailViewTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    loadTournamentsData();
  }, [gameState.players]);

  const loadTournamentsData = useCallback(async () => {
    try {
      setLoading(true);
      const loadedTournaments = await tournamentService.getTournaments();
      

      const { data: players, error } = await supabase
        .from('players')
        .select('id, name, is_cpu');
      if (error) throw error;

      const playerMap = new Map(players.map(p => [p.id, p]));

      loadedTournaments?.forEach(tournament =>
        tournament.rounds.forEach((round:Round) =>
          round.matches.forEach((match:Match) => {
            match.players = [playerMap.get(String(match.player1Id)), playerMap.get((match.player2Id))].filter(Boolean);
          })
        )
      );

      setTournaments(loadedTournaments);

      console.log('loadedTournaments', loadedTournaments);
      console.log('gameState.players', gameState.players);

      const registeredTournamentIds = loadedTournaments.filter((tournament: any) => 
        {
          const isIncluded = tournament.registered_players.some((player: any) => gameState.players.some((userPlayer: any) => userPlayer.id === player.player_id));
          return isIncluded;
        }).map((tournament: any) => tournament.id);
      console.log('registeredTournamentIds', registeredTournamentIds);
      setRegisteredTournaments(registeredTournamentIds);

      
      // Update detail view tournament if it exists
      if (detailViewTournament) {
        const updatedTournament = loadedTournaments.find(t => t.id === detailViewTournament.id);
        if (updatedTournament) {
          setDetailViewTournament(updatedTournament);
        }
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  }, [gameState.players, detailViewTournament]);


  // Memoize expensive calculations
  const canRegisterForTournament = useCallback((tournament: Tournament): boolean => {
    // Check if tournament has already started
    if (tournament.status !== 'upcoming') {
      return false;
    }

    // Check if tournament start time has passed
    if (tournament.start_date <= Date.now()) {
      return false;
    }

    // Check if tournament is full
    if (tournament.current_participants >= tournament.max_participants) {
      return false;
    }

    const eligiblePlayers = gameState.players.filter(
      player => player.level >= tournament.min_player_level && !player.injuries?.length
    );

    if (eligiblePlayers.length === 0) return false;

    const entryFee = tournament.entry_fee || {};

    return (
      (entryFee.coins || 0) <= (resources.coins || 0) &&
      (entryFee.shuttlecocks || 0) <= (resources.shuttlecocks || 0) &&
      (entryFee.meals || 0) <= (resources.meals || 0) &&
      (entryFee.diamonds || 0) <= (resources.diamonds || 0)
    );
  }, [gameState.players, resources]);

  const getRegistrationButtonText = useCallback((tournament: Tournament): string => {
    if (tournament.status !== 'upcoming') {
      return tournament.status === 'ongoing' ? 'Tournament In Progress' : 'Tournament Ended';
    }

    if (tournament.start_date <= Date.now()) {
      return 'Registration Closed';
    }

    if (tournament.current_participants >= tournament.max_participants) {
      return 'Tournament Full';
    }
    console.log("Min player level", tournament.min_player_level)
    
    const eligiblePlayers = gameState.players.filter(
      player => player.level >= tournament.min_player_level && !player.injuries?.length
    );

    if (eligiblePlayers.length === 0) {
      return 'No Eligible Players';
    }

    const entryFee = tournament.entry_fee || {};
    const canAfford = (
      (entryFee.coins || 0) <= (resources.coins || 0) &&
      (entryFee.shuttlecocks || 0) <= (resources.shuttlecocks || 0) &&
      (entryFee.meals || 0) <= (resources.meals || 0) &&
      (entryFee.diamonds || 0) <= (resources.diamonds || 0)
    );

    if (!canAfford) {
      return 'Insufficient Resources';
    }

    return 'Register for Tournament';
  }, [gameState.players, resources]);

  const handleRegisterClick = useCallback((tournament: Tournament) => {
    console.log('handleRegisterClick called with tournament:', tournament);
    console.log('Current showPlayerSelection state:', showPlayerSelection);
    console.log('gameState.players:', gameState.players);
    
    const eligiblePlayers = gameState.players.filter(
      player => player.level >= tournament.min_player_level && !player.injuries?.length
    );

    console.log('eligiblePlayers found:', eligiblePlayers);

    if (eligiblePlayers.length === 0) {
      console.log('No eligible players, showing notification');
      setNotification({ type: 'error', message: 'No eligible players for this tournament' });
      return;
    }

    console.log('Setting tournament and players, opening modal');
    setSelectedTournament(tournament);
    setEligiblePlayers(eligiblePlayers);
    setShowPlayerSelection(true);
    console.log('Modal should now be open, showPlayerSelection set to true');
  }, [gameState.players, showPlayerSelection]);

  const handlePlayerSelection = async (players: Player[]) => {
    if (!selectedTournament) return;

    try {
      if (selectedTournament.status !== 'upcoming') {
        throw new Error('Tournament is no longer accepting registrations');
      }

      if (selectedTournament.start_date <= Date.now()) {
        throw new Error('Tournament registration period has ended');
      }

      if (selectedTournament.current_participants >= selectedTournament.max_participants) {
        throw new Error('Tournament is full');
      }

      for (const player of players) {
        const res = await tournamentService.registerPlayerForTournament(
          selectedTournament.id,
          player.id
        );

        if (res.error) {
          throw new Error(res.error);
        }

        setNotification({
          type: 'success',
          message: `Successfully registered ${player.name} for ${selectedTournament.name}!`
        });
      }

      setRegisteredTournaments(prev => [...prev, selectedTournament.id]);
      loadTournamentsData();
      setShowPlayerSelection(false);

      setTimeout(() => setNotification(null), 3000);

    } catch (error) {
      console.log('Error registering for tournament:', error);

      let errorMessage = 'Failed to register for tournament';

      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('already started')) {
          errorMessage = 'Tournament has already started';
        } else if (message.includes('registration is closed') || message.includes('registration period has ended')) {
          errorMessage = 'Registration period has ended';
        } else if (message.includes('full') || message.includes('no more spots')) {
          errorMessage = 'Tournament is full';
        } else if (message.includes('already registered')) {
          errorMessage = 'One or more players are already registered';
        } else if (message.includes('level') && message.includes('too low')) {
          errorMessage = `Player level is too low (minimum: ${selectedTournament.min_player_level})`;
        } else if (message.includes('not found')) {
          errorMessage = 'Player not found or invalid';
        } else {
          errorMessage = error.message;
        }
      }

      setNotification({
        type: 'error',
        message: errorMessage
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const getTimeUntilStart = useCallback((startDate: number): string => {
    const now = Date.now();
    const diff = new Date(startDate).getTime() - now;
    
    if (diff <= 0) return 'Started';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `Starts in ${days}d ${hours}h`;
    if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
    return `Starts in ${minutes}m`;
  }, []);

  const handleTournamentClick = useCallback((tournament: Tournament) => {
    setDetailViewTournament(tournament);
  }, []);

  const handleBackToList = useCallback(() => {
    setDetailViewTournament(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show tournament detail view
  if (detailViewTournament) {
    const isRegistered = registeredTournaments.includes(detailViewTournament.id);
    const canRegister = canRegisterForTournament(detailViewTournament);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBackToList}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Tournaments
          </button>
        </div>

        {/* Tournament Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Trophy className="w-8 h-8 mr-3 text-yellow-500" />
                {detailViewTournament.name}
              </h1>
              <div className="flex items-center space-x-4 mt-2">
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {detailViewTournament.tier.charAt(0).toUpperCase() + detailViewTournament.tier.slice(1)}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  detailViewTournament.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                  detailViewTournament.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {detailViewTournament.status.charAt(0).toUpperCase() + detailViewTournament.status.slice(1)}
                </span>
              </div>
            </div>

            {/* Countdown Timer */}
            {(detailViewTournament.status === 'upcoming' || 
              (detailViewTournament.status === 'ongoing' && detailViewTournament.next_round_start_time)) && (
              <CountdownTimer tournament={detailViewTournament} />
            )}
          </div>

          {/* Tournament Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-3">
              <div className="flex items-center text-gray-600">
                <Users className="w-5 h-5 mr-3" />
                <span>{detailViewTournament.current_participants}/{detailViewTournament.max_participants} participants</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-3" />
                <span>{new Date(detailViewTournament.start_date).toLocaleDateString()} at {new Date(detailViewTournament.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Trophy className="w-5 h-5 mr-3" />
                <span>Min Level: {detailViewTournament.min_player_level}</span>
              </div>
            </div>

            {/* Entry Fee */}
            {detailViewTournament.entry_fee && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Entry Fee</h3>
                <div className="space-y-1">
                  {detailViewTournament.entry_fee.coins && (
                    <div className="flex items-center">
                      <Coins className="w-4 h-4 text-yellow-500 mr-2" />
                      <span>{detailViewTournament.entry_fee.coins} coins</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prize Pool */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Prize Pool</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  <span>1st: {detailViewTournament.prize_pool?.first?.coins || 0} coins</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                  <span>2nd: {detailViewTournament.prize_pool?.second?.coins || 0} coins</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                  <span>3rd: {detailViewTournament.prize_pool?.third?.coins || 0} coins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Registration Button */}
          {!isRegistered && (
            <button
              onClick={() => handleRegisterClick(detailViewTournament)}
              disabled={!canRegister}
              className={`w-full md:w-auto px-6 py-3 rounded-lg transition-colors ${
                canRegister
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {getRegistrationButtonText(detailViewTournament)}
            </button>
          )}

          {isRegistered && (
            <div className="flex items-center text-green-700 bg-green-100 px-4 py-2 rounded-lg w-full md:w-auto">
              <CheckCircle className="w-5 h-5 mr-2" />
              You are registered for this tournament
            </div>
          )}
        </div>

        {/* User Match Countdown Component */}
        {/* <UserMatchCountdown /> */}

        {/* Tournament Bracket - Only show if user is registered and tournament has started OR tournament is ongoing/completed */}
        {detailViewTournament.rounds && 
         detailViewTournament.rounds.length > 0 && 
         isRegistered && 
         (detailViewTournament.status === 'ongoing' || detailViewTournament.status === 'completed' || detailViewTournament.start_date <= Date.now()) && (
          <SimpleTournamentBracket
            registeredPlayers={gameState.players}
            tournamentName={detailViewTournament.name}
            rounds={detailViewTournament.rounds}
            currentPlayerId={gameState.players[0]?.id || ''}
            status={detailViewTournament.status}
            onBack={handleBackToList}
          />
        )}

        {/* Message when bracket is not visible */}
        {(!isRegistered || (detailViewTournament.start_date > Date.now() && detailViewTournament.status === 'upcoming')) && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <Trophy className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            {!isRegistered ? (
              <div>
                <p className="text-lg font-medium text-gray-600 mb-2">Register to View Tournament Bracket</p>
                <p className="text-gray-500">You must be registered for this tournament to view the bracket and match details.</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-600 mb-2">Tournament Bracket Will Appear When Started</p>
                <p className="text-gray-500">The tournament bracket will be visible once the tournament begins.</p>
              </div>
            )}
          </div>
        )}

        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg flex items-center z-50 ${
            notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            {notification.message}
          </div>
        )}

        {/* Player Selection Modal for Detail View */}
        {selectedTournament && (
          <PlayerSelectionModal
            isOpen={showPlayerSelection}
            onClose={() => setShowPlayerSelection(false)}
            tournament={selectedTournament}
            eligiblePlayers={eligiblePlayers}
            onSelectPlayers={handlePlayerSelection}
          />
        )}
      </div>
    );
  }

  // Show tournament list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Trophy className="w-8 h-8 mr-3 text-yellow-500" />
            Tournaments
          </h1>
          <p className="text-gray-600">Compete in tournaments to win prizes and climb the rankings</p>
        </div>
      </div>

      {/* User Match Countdown Component */}
      {/* <UserMatchCountdown /> */}

      {notification && (
        <div className={`p-4 rounded-lg flex items-center ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-2" />
          )}
          {notification.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-500">No tournaments available</p>
            <p className="text-gray-400">Check back later for new tournaments</p>
          </div>
        ) : (
          tournaments.map(tournament => (
            <div 
              key={tournament.id} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleTournamentClick(tournament)}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{tournament.name}</h3>
              <div className="flex items-center space-x-2 mb-4">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {tournament.tier.charAt(0).toUpperCase() + tournament.tier.slice(1)}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  tournament.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                  tournament.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-2" />
                  {tournament.current_participants}/{tournament.max_participants} participants
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  {new Date(tournament.start_date).toLocaleDateString()} at {new Date(tournament.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {tournament.status === 'upcoming' && (
                  <div className="flex items-center text-sm text-blue-600">
                    <Clock className="w-4 h-4 mr-2" />
                    {getTimeUntilStart(tournament.start_date)}
                  </div>
                )}
              </div>

              {tournament.entry_fee && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Entry Fee</p>
                  <div className="flex items-center space-x-3 text-sm">
                    {tournament.entry_fee.coins && (
                      <div className="flex items-center">
                        <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                        <span>{tournament.entry_fee.coins}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Click to view details</span>
                {registeredTournaments.includes(tournament.id) && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    <span className="text-xs">Registered</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tournament Results Modal */}
      {showResults && completedTournament && (
        <TournamentResults
          tournament={completedTournament}
          onClose={() => setShowResults(false)}
        />
      )}
    </div>
  );
}