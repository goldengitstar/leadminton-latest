import React, { useState, useEffect } from 'react';
import { Tournament, TournamentTier, TournamentStatus } from '../../types/tournament';
import { Player } from '../../types/game';
import { supabase } from '../../lib/supabase';
import { useAdmin } from '../../contexts/AdminContext';
import { X, Calendar, Coins, Diamond, Feather, UtensilsCrossed, Bot, Trophy, UserPlus } from 'lucide-react';
import PlayerRegistrationModal from './PlayerRegistrationModal';
import { toast } from 'sonner';
import { TournamentService } from '@/services/database/tournamentService';

const tournamentService = new TournamentService(supabase);


interface TournamentFormProps {
  tournament?: Tournament | null;
  onSave: (tournament: Tournament) => void;
  onCancel: () => void;
}

const TournamentForm: React.FC<TournamentFormProps> = ({
  tournament,
  onSave,
  onCancel
}) => {
  const { logActivity } = useAdmin();
  const [loading, setLoading] = useState(false);
  const [cpuPlayers, setCpuPlayers] = useState<Player[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: tournament?.name || '',
    tier: tournament?.tier || 'local' as TournamentTier,
    status: tournament?.status || 'upcoming' as TournamentStatus,
    startDate: tournament ? new Date(tournament.start_date).toISOString().slice(0, 16) : '',
    endDate: tournament ? new Date(tournament.end_date).toISOString().slice(0, 16) : '',
    minPlayerLevel: tournament?.min_player_level || 1,
    maxParticipants: tournament?.max_participants || 8,
    roundIntervalMinutes: tournament?.round_interval_minutes || 10,
    entryFee: {
      coins: tournament?.entry_fee?.coins || 0,
      shuttlecocks: tournament?.entry_fee?.shuttlecocks || 0,
      meals: tournament?.entry_fee?.meals || 0,
      diamonds: tournament?.entry_fee?.diamonds || 0
    },
    prizePool: {
      first: {
        coins: tournament?.prize_pool?.first?.coins || 0,
        shuttlecocks: tournament?.prize_pool?.first?.shuttlecocks || 0,
        meals: tournament?.prize_pool?.first?.meals || 0,
        diamonds: tournament?.prize_pool?.first?.diamonds || 0
      },
      second: {
        coins: tournament?.prize_pool?.second?.coins || 0,
        shuttlecocks: tournament?.prize_pool?.second?.shuttlecocks || 0,
        meals: tournament?.prize_pool?.second?.meals || 0,
        diamonds: tournament?.prize_pool?.second?.diamonds || 0
      },
      third: {
        coins: tournament?.prize_pool?.third?.coins || 0,
        shuttlecocks: tournament?.prize_pool?.third?.shuttlecocks || 0,
        meals: tournament?.prize_pool?.third?.meals || 0,
        diamonds: tournament?.prize_pool?.third?.diamonds || 0
      }
    },
    registeredPlayers: tournament?.registered_players || []
  });

  const [selectedCpuPlayers, setSelectedCpuPlayers] = useState<string[]>([]);
  const [showPlayerRegistration, setShowPlayerRegistration] = useState(false);

  useEffect(() => {
    if (tournament) {
      setFormData({
        name: tournament.name,
        tier: tournament.tier,
        status: tournament.status,
        startDate: new Date(tournament.start_date).toISOString().slice(0, 16),
        endDate: new Date(tournament.end_date).toISOString().slice(0, 16),
        minPlayerLevel: tournament.min_player_level,
        maxParticipants: tournament.max_participants,
        roundIntervalMinutes: tournament.round_interval_minutes || 10,
        entryFee: {
          coins: tournament.entry_fee?.coins || 0,
          shuttlecocks: tournament.entry_fee?.shuttlecocks || 0,
          meals: tournament.entry_fee?.meals || 0,
          diamonds: tournament.entry_fee?.diamonds || 0
        },
        prizePool: {
          first: {
            coins: tournament.prize_pool?.first?.coins || 0,
            shuttlecocks: tournament.prize_pool?.first?.shuttlecocks || 0,
            meals: tournament.prize_pool?.first?.meals || 0,
            diamonds: tournament.prize_pool?.first?.diamonds || 0
          },
          second: {
            coins: tournament.prize_pool?.second?.coins || 0,
            shuttlecocks: tournament.prize_pool?.second?.shuttlecocks || 0,
            meals: tournament.prize_pool?.second?.meals || 0,
            diamonds: tournament.prize_pool?.second?.diamonds || 0
          },
          third: {
            coins: tournament.prize_pool?.third?.coins || 0,
            shuttlecocks: tournament.prize_pool?.third?.shuttlecocks || 0,
            meals: tournament.prize_pool?.third?.meals || 0,
            diamonds: tournament.prize_pool?.third?.diamonds || 0
          }
        },
        registeredPlayers: tournament.registered_players || []
      });

      setSelectedCpuPlayers(tournament.registered_players?.map(player => player.player_id) || []);
    }

    const loadCpuPlayers = async () => {
      try {
        const data = await tournamentService.getCPUPlayers();
  
        setCpuPlayers(data || []);
      } catch (error) {
        console.error('Error loading CPU players:', error);
      }
    };

    loadCpuPlayers();

  }, [tournament]);

 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if(new Date(formData.endDate).getTime() < new Date(formData.startDate).getTime()) {
      toast.error('End date cannot be before start date');
      setLoading(false);
      return;
    }
    console.log("Form data status", formData.status)
    console.log("Index", ['upcoming', 'ongoing', 'completed'].indexOf(formData.status))
    try {
      const tournamentData = {
        name: formData.name,
        tier: ['local', 'regional', 'national', 'international', 'premier'].indexOf(formData.tier),
        status: ['upcoming', 'ongoing', 'completed'].indexOf(formData.status),
        start_date: new Date(formData.startDate).toISOString(),
        end_date: new Date(formData.endDate).toISOString(),
        min_player_level: formData.minPlayerLevel,
        max_participants: formData.maxParticipants,
        current_participants: tournament?.current_participants || 0,
        round_interval_minutes: formData.roundIntervalMinutes || 10,
        entry_fee: formData.entryFee,
        prize_pool: formData.prizePool,
        registered_players: tournament?.registered_players || []
      };

      if (tournament) {
        // Update existing tournament
        await tournamentService.updateTournament(tournament.id, tournamentData, selectedCpuPlayers);

        await logActivity('tournament_updated', 'tournament', tournament.id);
      } else {
        // // Create new tournament
        // const { data, error } = await supabase
        //   .from('tournament_list')
        //   .insert([tournamentData])
        //   .select()
        //   .single();

        // if (error) {
        //   console.error('Error creating tournament:', error);
        //   throw new Error('Failed to create tournament');
        // }

        // // Create tournament rounds based on max participants
        // const rounds = generateTournamentRounds(formData.maxParticipants);
        // for (const round of rounds) {
        //   const { data: roundData, error: roundError } = await supabase
        //     .from('round')
        //     .insert({
        //       tournament_id: data.id,
        //       name: round.name,
        //       level: round.level
        //     })
        //     .select()
        //     .single();

        //   if (roundError) {
        //     console.error('Error creating round:', roundError);
        //     continue;
        //   }

        //   // Create matches for this round
        //   for (const match of round.matches) {
        //     await supabase
        //       .from('match')
        //       .insert({
        //         round_id: roundData.id,
        //         player1_id: null,
        //         player2_id: null,
        //         completed: false
        //       });
        //   }
        // }

        // // Assign selected CPU players to tournament using JavaScript logic
        // if (selectedCpuPlayers.length > 0) {
        //   console.log('[TournamentForm] Assigning CPU players to tournament:', selectedCpuPlayers);
          
        //   // Get CPU player details
        //   const { data: cpuPlayersData, error: cpuPlayersError } = await supabase
        //     .from('players')
        //     .select('*')
        //     .in('id', selectedCpuPlayers);

        //   if (cpuPlayersError) {
        //     console.error('[TournamentForm] Error loading CPU players:', cpuPlayersError);
        //   } else {
        //     // Add CPU players to tournament's registered_players array
        //     const cpuRegistrations = (cpuPlayersData || []).map(player => ({
        //       playerId: player.id,
        //       playerName: player.name,
        //       clubId: 'cpu-club',
        //       clubName: 'CPU Club',
        //       registered: Date.now(),
        //       is_cpu: true
        //     }));

        //     // Update tournament with CPU players
        //     const { error: updateError } = await supabase
        //       .from('tournament_list')
        //       .update({
        //         registered_players: cpuRegistrations,
        //         current_participants: cpuRegistrations.length
        //       })
        //       .eq('id', data.id);

        //     if (updateError) {
        //       console.error('[TournamentForm] Error updating tournament with CPU players:', updateError);
        //     } else {
        //       console.log('[TournamentForm] Successfully assigned CPU players to tournament');
        //     }
        //   }
        // }

        const data = await tournamentService.createTournament(tournamentData, selectedCpuPlayers);

        await logActivity('tournament_created', 'tournament', data.id);
      }

      onSave({
        id: tournament?.id || 'new',
        name: formData.name,
        tier: formData.tier,
        status: formData.status,
        start_date: new Date(formData.startDate).getTime(),
        end_date: new Date(formData.endDate).getTime(),
        min_player_level: formData.minPlayerLevel,
        max_participants: formData.maxParticipants,
        current_participants: tournament?.current_participants || 0,
        entry_fee: formData.entryFee,
        prize_pool: formData.prizePool, 
        registered_players: tournament?.registered_players || [],
        round_interval_minutes: formData.roundIntervalMinutes,
        current_round_level: tournament?.current_round_level || 0,
      });
    } catch (error) {
      console.error('Error saving tournament:', error);
      toast.error('Failed to save tournament. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResourceChange = (section: 'entryFee' | 'prizePool', position: string | null, resource: keyof { coins: number; shuttlecocks: number; meals: number; diamonds: number }, value: number) => {
    setFormData(prev => ({
      ...prev,
      [section]: position ? {
        ...prev[section],
        [position]: {
          ...(prev[section] as any)[position],
          [resource]: value
        }
      } : {
        ...prev[section],
        [resource]: value
      }
    }));
  };

  const tierOptions = [
    { value: 'local', label: 'Local Tournament', color: 'text-gray-600' },
    { value: 'regional', label: 'Regional Tournament', color: 'text-blue-600' },
    { value: 'national', label: 'National Tournament', color: 'text-green-600' },
    { value: 'international', label: 'International Tournament', color: 'text-yellow-600' },
    { value: 'premier', label: 'Premier Tournament', color: 'text-purple-600' }
  ];

  const statusOptions = [
    { value: 'upcoming', label: 'Upcoming', color: 'text-blue-600' },
    { value: 'ongoing', label: 'Ongoing', color: 'text-green-600' },
    { value: 'completed', label: 'Completed', color: 'text-gray-600' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {tournament ? 'Edit Tournament' : 'Create New Tournament'}
            </h2>
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 py-6 space-y-8">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tournament name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tournament Tier
                </label>
                <select
                  value={formData.tier}
                  onChange={(e) => handleInputChange('tier', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tierOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Participants
                </label>
                <select
                  value={formData.maxParticipants}
                  onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[8, 16, 32, 64].map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Participants
                </label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="2"
                  max="64"
                  step="2"
                />
              </div> */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Player Level
                </label>
                <input
                  type="number"
                  value={formData.minPlayerLevel}
                  onChange={(e) => handleInputChange('minPlayerLevel', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Round Interval */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Round Interval (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={formData.roundIntervalMinutes}
                onChange={(e) => handleInputChange('roundIntervalMinutes', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Time between rounds (default: 10 minutes)
              </p>
            </div>

            {/* Entry Fee */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Coins className="w-5 h-5 mr-2" />
                Entry Fee
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Coins className="w-4 h-4 inline mr-1 text-yellow-500" />
                    Coins
                  </label>
                  <input
                    type="number"
                    value={formData.entryFee.coins}
                    onChange={(e) => handleResourceChange('entryFee', null, 'coins', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Feather className="w-4 h-4 inline mr-1 text-blue-500" />
                    Shuttlecocks
                  </label>
                  <input
                    type="number"
                    value={formData.entryFee.shuttlecocks}
                    onChange={(e) => handleResourceChange('entryFee', null, 'shuttlecocks', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <UtensilsCrossed className="w-4 h-4 inline mr-1 text-green-500" />
                    Meals
                  </label>
                  <input
                    type="number"
                    value={formData.entryFee.meals}
                    onChange={(e) => handleResourceChange('entryFee', null, 'meals', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Diamond className="w-4 h-4 inline mr-1 text-purple-500" />
                    Diamonds
                  </label>
                  <input
                    type="number"
                    value={formData.entryFee.diamonds}
                    onChange={(e) => handleResourceChange('entryFee', null, 'diamonds', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Prize Pool */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Trophy className="w-5 h-5 mr-2" />
                Prize Pool
              </h3>
              
              {/* First Place */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-800 mb-3">🥇 First Place</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.first.coins}
                      onChange={(e) => handleResourceChange('prizePool', 'first', 'coins', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Coins"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.first.shuttlecocks}
                      onChange={(e) => handleResourceChange('prizePool', 'first', 'shuttlecocks', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Shuttlecocks"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.first.meals}
                      onChange={(e) => handleResourceChange('prizePool', 'first', 'meals', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Meals"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.first.diamonds}
                      onChange={(e) => handleResourceChange('prizePool', 'first', 'diamonds', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Diamonds"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Second Place */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-800 mb-3">🥈 Second Place</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.second.coins}
                      onChange={(e) => handleResourceChange('prizePool', 'second', 'coins', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Coins"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.second.shuttlecocks}
                      onChange={(e) => handleResourceChange('prizePool', 'second', 'shuttlecocks', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Shuttlecocks"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.second.meals}
                      onChange={(e) => handleResourceChange('prizePool', 'second', 'meals', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Meals"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.second.diamonds}
                      onChange={(e) => handleResourceChange('prizePool', 'second', 'diamonds', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Diamonds"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Third Place */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-800 mb-3">🥉 Third Place</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.third.coins}
                      onChange={(e) => handleResourceChange('prizePool', 'third', 'coins', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Coins"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.third.shuttlecocks}
                      onChange={(e) => handleResourceChange('prizePool', 'third', 'shuttlecocks', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Shuttlecocks"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.third.meals}
                      onChange={(e) => handleResourceChange('prizePool', 'third', 'meals', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Meals"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.prizePool.third.diamonds}
                      onChange={(e) => handleResourceChange('prizePool', 'third', 'diamonds', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Diamonds"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CPU Players Assignment */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Bot className="w-5 h-5 mr-2" />
                CPU Players Assignment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
                {cpuPlayers.map(player => (
                  <label key={player.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCpuPlayers.includes(player.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCpuPlayers(prev => [...prev, player.id]);
                        } else {
                          setSelectedCpuPlayers(prev => prev.filter(id => id !== player.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{player.name}</span>
                    <span className="text-xs text-gray-500">Lv.{player.level}</span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Selected: {selectedCpuPlayers.length} CPU players
              </p>
            </div>

            {/* Player Registration (for existing tournaments) */}
            {tournament && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Player Registration
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-3">
                    Register real players or additional CPU players to this tournament without resource deduction.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPlayerRegistration(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Register Players
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : (tournament ? 'Update Tournament' : 'Create Tournament')}
            </button>
          </div>
        </form>
      </div>

      {/* Player Registration Modal */}
      {tournament && (
        <PlayerRegistrationModal
          tournament={tournament}
          isOpen={showPlayerRegistration}
          onClose={() => setShowPlayerRegistration(false)}
          onSuccess={() => {
            // Refresh tournament data or handle success
            console.log('Player registered successfully');
          }}
        />
      )}
    </div>
  );
};

export default TournamentForm; 