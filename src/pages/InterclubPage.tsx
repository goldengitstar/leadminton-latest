import React, { useEffect, useState } from 'react';
import { 
  Trophy, 
  Users, 
  Feather, 
  UtensilsCrossed, 
  Coins, 
  Star, 
  Clock, 
  Calendar,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Info,
  Crown,
  Medal,
  Target,
  Play,
  Eye,
  Settings,
  ChevronDown,
  ChevronUp,
  Award,
  Shield,
  BarChart2
} from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { InterclubService } from '../services/database/interclubService';
import { supabase } from '../lib/supabase';
import { Swords } from "lucide-react";
import {
  InterclubSeason,
  InterclubTier,
  InterclubRegistrationRequest,
  LineupSubmission,
  TIER_REQUIREMENTS,
  INTERCLUB_TIERS
} from '../types/interclub';

type PageView = 'selection' | 'registration' | 'dashboard';

const InterclubPage: React.FC = () => {
  const { gameState, resources, refreshGameState } = useGame();
  const { user } = useAuth();
  const [interclubService] = useState(() => new InterclubService(supabase));
  
  // State management
  const [currentView, setCurrentView] = useState<PageView>('selection');
  const [loading, setLoading] = useState(true);
  const [meetsGenderReqs, setMeetsGenderReqs] = useState(true);
  const [availableSeasons, setAvailableSeasons] = useState<InterclubSeason[]>([]);
  const [unlockedTiers, setUnlockedTiers] = useState<InterclubTier[]>(['departmental']);
  const [selectedSeason, setSelectedSeason] = useState<InterclubSeason | null>(null);
  const [currentSeasonStatus, setCurrentSeasonStatus] = useState<any>(null);
  const [nextEncounter, setNextEncounter] = useState<any>(null);
  const [showLineupPopup, setShowLineupPopup] = useState(false);
  const [showFullStandings, setShowFullStandings] = useState(false);
  const [showLineupBuilder, setShowLineupBuilder] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);
  const [seasonMatches, setSeasonMatches] = useState<any[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  
  // Lineup state
  const [lineup, setLineup] = useState({
    mens_singles: '',
    womens_singles: '',
    mens_doubles: ['', ''] as [string, string],
    womens_doubles: ['', ''] as [string, string],
    mixed_doubles: ['', ''] as [string, string]
  });
  
  // Registration state
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [teamName, setTeamName] = useState('');
  const [registrationError, setRegistrationError] = useState<string>('');

  // Calculate time remaining until next match
  useEffect(() => {
    if (!nextEncounter?.match_date) return;

    const updateCountdown = () => {
      const now = new Date();
      const matchDate = new Date(nextEncounter.match_date);
      const diff = matchDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Match started');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextEncounter]);

  useEffect(() => {
    const maleCount = gameState.players.filter(p => p.gender === 'male').length;
    const femaleCount  = gameState.players.filter(p => p.gender === 'female').length;
    const valid = (maleCount >= 4 && femaleCount >= 3);
    setMeetsGenderReqs(valid);
  }, [selectedPlayers, gameState.players]);

  useEffect(() => {
    if (user?.id) {
      loadInterclubData();
    }
  }, [user?.id]);

  const loadInterclubData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Load available seasons and user's unlocked tiers
      const { seasons, unlockedTiers: tiers } = await interclubService.getAvailableSeasons(user.id);
      setAvailableSeasons(seasons);
      setUnlockedTiers(tiers);
      
      // Check current season status
      const currentStatus = await interclubService.getUserCurrentSeasonStatus(user.id);
      setCurrentSeasonStatus(currentStatus);
      
      // Get next encounter if in active season
      if (currentStatus) {
        const nextMatch = await interclubService.getUserNextEncounter(user.id);
        console.log(nextMatch)
        setNextEncounter(nextMatch);
        setCurrentView('dashboard');
      }
      
    } catch (error) {
      console.error('Error loading interclub data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonRegistration = async () => {
    if (!user?.id || !selectedSeason || selectedPlayers.length < 5 || !teamName.trim()) {
      setRegistrationError('Please complete all registration requirements');
      return;
    }

    if (!meetsGenderReqs) {
      setRegistrationError('Team must have at least 4 men and 3 women.');
      return;
    }

    try {
      setLoading(true);
      const request: InterclubRegistrationRequest = {
        season_id: selectedSeason.id,
        team_name: teamName.trim(),
        selected_players: selectedPlayers
      };

      const result = await interclubService.registerForSeason(user.id, request);
      
      if (result.success) {
        await refreshGameState();
        await loadInterclubData();
        setCurrentView('selection');
        setRegistrationError('');
      } else {
        setRegistrationError(result.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setRegistrationError('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasonMatches = async (seasonId: string) => {
    setScheduleLoading(true);
    try {
      const { data, error } = await supabase
        .from('interclub_matches')
        .select('*')
        .eq('season_id', seasonId)
        .order('week_number', { ascending: true })
        .order('match_date', { ascending: true });

      if (error) throw error;
      setSeasonMatches(data || []);
    } catch (error) {
      console.error('Error fetching season matches:', error);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleLineupSubmission = async () => {
    if (!user?.id || !nextEncounter) return;

    const submission: LineupSubmission = {
      encounter_id: nextEncounter.id,
      lineup
    };

    try {
      setLoading(true);
      const result = await interclubService.submitLineup(user.id, submission);
      
      if (result.success) {
        await loadInterclubData();
        setShowLineupBuilder(false);
      }
    } catch (error) {
      console.error('Lineup submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierInfo = (tier: InterclubTier) => {
    const requirements = TIER_REQUIREMENTS[tier];
    const tierNames = {
      departmental: 'Departmental',
      regional: 'Regional', 
      national: 'National',
      top12: 'TOP 12'
    };
    
    const tierDescriptions = {
      departmental: 'Beginner level',
      regional: 'Intermediate level',
      national: 'Advanced level',
      top12: 'Elite level'
    };

    return {
      name: tierNames[tier],
      description: tierDescriptions[tier],
      requirements,
      unlocked: unlockedTiers.includes(tier)
    };
  };

  const canAffordSeason = (season: InterclubSeason) => {
    const requirements = TIER_REQUIREMENTS[season.tier];
    return resources.coins >= requirements.coins &&
           resources.shuttlecocks >= requirements.shuttlecocks &&
           resources.meals >= requirements.meals &&
           gameState.players.length >= 5;
  };

  const canSubmitLineup = () => {
    return lineup.mens_singles && 
           lineup.womens_singles && 
           lineup.mens_doubles[0] && lineup.mens_doubles[1] &&
           lineup.womens_doubles[0] && lineup.womens_doubles[1] &&
           lineup.mixed_doubles[0] && lineup.mixed_doubles[1];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Season Selection View
  if (currentView === 'selection') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <Trophy className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Interclubs</h1>
        </div>

        {/* Tier Progression Display */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Tier Progression</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {INTERCLUB_TIERS.map((tier, index) => {
              const tierInfo = getTierInfo(tier);
              const isUnlocked = tierInfo.unlocked;
              
              return (
                <div
                  key={tier}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    isUnlocked
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {index === 0 && <Trophy className="w-5 h-5 text-bronze" />}
                      {index === 1 && <Trophy className="w-5 h-5 text-gray-500" />}
                      {index === 2 && <Trophy className="w-5 h-5 text-yellow-500" />}
                      {index === 3 && <Crown className="w-5 h-5 text-purple-500" />}
                      <span className="font-bold">{tierInfo.name}</span>
                    </div>
                    {isUnlocked && <CheckCircle className="w-5 h-5 text-green-500" />}
                  </div>
                  <p className="text-sm text-gray-600">{tierInfo.description}</p>
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-20 rounded-lg">
                      <Star className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Available Seasons */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-6">Available Seasons</h2>
          
          {availableSeasons.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No seasons available at the moment</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableSeasons.map((season) => {
                const tierInfo = getTierInfo(season.tier);
                const canAfford = canAffordSeason(season);
                const canRegister = tierInfo.unlocked && canAfford;

                return (
                  <div
                    key={season.id}
                    className={`border rounded-lg p-6 transition-all ${
                      canRegister
                        ? 'border-blue-200 hover:border-blue-400 hover:shadow-md cursor-pointer'
                        : 'border-gray-200 opacity-75'
                    }`}
                    onClick={() => canRegister && (setSelectedSeason(season), setCurrentView('registration'))}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-lg">{season.name}</h3>
                      <div className="flex items-center space-x-1">
                        {season.tier === 'departmental' && <Trophy className="w-4 h-4 text-bronze" />}
                        {season.tier === 'regional' && <Trophy className="w-4 h-4 text-gray-500" />}
                        {season.tier === 'national' && <Trophy className="w-4 h-4 text-yellow-500" />}
                        {season.tier === 'top12' && <Crown className="w-4 h-4 text-purple-500" />}
                        <span className="text-sm font-medium">{tierInfo.name}</span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{tierInfo.description}</p>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>Start:</span>
                        <span>{new Date(season.start_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Registration deadline:</span>
                        <span>{new Date(season.registration_deadline).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Requirements */}
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-medium mb-2">Requirements:</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={`flex items-center space-x-1 ${gameState.players.length >= 5 ? 'text-green-600' : 'text-red-600'}`}>
                          <Users className="w-3 h-3" />
                          <span>5 players</span>
                        </div>
                        <div className={`flex items-center space-x-1 ${resources.coins >= tierInfo.requirements.coins ? 'text-green-600' : 'text-red-600'}`}>
                          <Coins className="w-3 h-3" />
                          <span>{tierInfo.requirements.coins}</span>
                        </div>
                        <div className={`flex items-center space-x-1 ${resources.shuttlecocks >= tierInfo.requirements.shuttlecocks ? 'text-green-600' : 'text-red-600'}`}>
                          <Feather className="w-3 h-3" />
                          <span>{tierInfo.requirements.shuttlecocks}</span>
                        </div>
                        <div className={`flex items-center space-x-1 ${resources.meals >= tierInfo.requirements.meals ? 'text-green-600' : 'text-red-600'}`}>
                          <UtensilsCrossed className="w-3 h-3" />
                          <span>{tierInfo.requirements.meals}</span>
                        </div>
                      </div>
                    </div>

                    {!tierInfo.unlocked && (
                      <div className="mt-3 text-xs bg-yellow-50 text-yellow-700 p-2 rounded">
                        Finish in top 2 to unlock this tier
                      </div>
                    )}

                    {!canAfford && tierInfo.unlocked && (
                      <div className="mt-3 text-xs bg-red-50 text-red-700 p-2 rounded">
                        Insufficient resources
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Registration View
  if (currentView === 'registration' && selectedSeason) {
    const tierInfo = getTierInfo(selectedSeason.tier);

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <button
            onClick={() => setCurrentView('selection')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <Trophy className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Registration - {selectedSeason.name}</h1>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Season Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Season Information</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Tier:</span>
                  <span className="font-medium">{tierInfo.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Start:</span>
                  <span>{new Date(selectedSeason.start_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>End:</span>
                  <span>{new Date(selectedSeason.end_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Registration deadline:</span>
                  <span>{new Date(selectedSeason.registration_deadline).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-3">Registration cost:</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Coins className="w-4 h-4 text-yellow-500" />
                      <span>Coins</span>
                    </div>
                    <span className="font-medium">{tierInfo.requirements.coins}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Feather className="w-4 h-4 text-blue-500" />
                      <span>Shuttlecocks</span>
                    </div>
                    <span className="font-medium">{tierInfo.requirements.shuttlecocks}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <UtensilsCrossed className="w-4 h-4 text-green-500" />
                      <span>Meals</span>
                    </div>
                    <span className="font-medium">{tierInfo.requirements.meals}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Registration Form */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Registration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your team name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select your players ({selectedPlayers.length}/5 minimum)
                  </label>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    {gameState.players.map((player) => (
                      <label key={player.id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPlayers.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (selectedPlayers.length < 10) {
                                setSelectedPlayers([...selectedPlayers, player.id]);
                              }
                            } else {
                              setSelectedPlayers(selectedPlayers.filter(id => id !== player.id));
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-600">
                            Level {player.level} • {player.gender === 'male' ? 'Male' : 'Female'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {registrationError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {registrationError}
                  </div>
                )}

                <button
                  onClick={handleSeasonRegistration}
                  disabled={loading || selectedPlayers.length < 5 || !teamName.trim() || !meetsGenderReqs}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Registering...' : 'Register for Season'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard View (Active Season) - Combined view for all sections
  if (currentView === 'dashboard' && currentSeasonStatus) {
    const malePlayersAvailable = gameState.players.filter(p => p.gender === 'male');
    const femalePlayersAvailable = gameState.players.filter(p => p.gender === 'female');
    const endDate = new Date(currentSeasonStatus.registration.season.end_date);
    console.log("Season details", currentSeasonStatus.registration.season)
    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <Trophy className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Interclub Season - {currentSeasonStatus.registration.season.name}</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Club Players */}
          <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <Users className="w-6 h-6 mr-2 text-blue-500" />
                Club Players
              </h2>
              <button 
                onClick={() => setShowAllPlayers(!showAllPlayers)}
                className="flex items-center text-sm text-white bg-blue-600 hover:text-blue-800 px-4 py-2 rounded-lg flex items-center space-x-2 "
              >
                {showAllPlayers ? (
                  <>
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <span>View All</span>
                  </>
                )}
              </button>
            </div>
            
            <div className={`overflow-y-auto ${showAllPlayers ? 'max-h-[500px]' : 'max-h-60'}`}>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {gameState.players
                    .sort((a, b) => b.level - a.level)
                    .map((player, index) => (
                      <tr key={player.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="font-medium">{player.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-gray-600">Level {player.level}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            player.gender === 'male' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-pink-100 text-pink-800'
                          }`}>
                            {player.gender === 'male' ? 'Male' : 'Female'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium">#{index + 1}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Next Match and Lineup */}
          <div className="space-y-6 h-full flex flex-col">
            {/* Next Match */}
            <div className="bg-white rounded-xl shadow-lg p-6 h-full">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Info className="w-6 h-6 mr-2 text-blue-500"
                onClick={() => {
                  setShowSchedulePopup(true);
                  fetchSeasonMatches(currentSeasonStatus.registration.season.id);
                }}/>
                Next Match
              </h2>
              
              {nextEncounter ? (
                <>
                  <div className="p-4 mb-4">
                    <div className="text-center mb-2 flex justify-center">
                      <div className='justify-center'>
                        <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-blue-500" />
                        </div>
                        <h3 className='text-center font-bold my-2'>{nextEncounter.home_team_name}</h3>
                      </div>
                      <h2 className='mx-4 bold mt-[auto] mb-[auto]'>VS</h2>
                      <div className='justify-center'>
                        <div className="w-12 h-12 bg-pink-200 rounded-full flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-pink-500" />
                        </div>
                        <h3 className='text-center font-bold my-2'>{nextEncounter.away_team_name}</h3>
                      </div>
                    </div>
                    
                    <div className="text-center text-lg font-bold mt-2 mb-2">
                      {timeRemaining}
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => setShowLineupPopup(true)}
                        className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                          showLineupBuilder 
                            ? 'bg-gray-200 text-gray-800' 
                            : 'bg-purple-700 text-white'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Set Lineup</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-gray-600">
                  No upcoming matches scheduled
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 h-full">
          {/* Season Rewards */}
          <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <Award className="w-6 h-6 mr-2 text-yellow-500" />
                Season Rewards
              </h2>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1 text-gray-500" />
                <span className="text-sm text-gray-600">{daysRemaining} days remaining</span>
              </div>
            </div>
            
            <div>
              {/* 1st Place */}
              <div className="bg-[#fefce8] rounded-lg p-4 flex">
                <Crown className="w-8 h-8 text-[#fde047] mr-4" />
                <div>
                  <h3 className="font-bold">1st Place</h3>
                  <p className="text-sm">
                    {currentSeasonStatus.registration.season.prize_pool.first.coins > 0 &&
                      `${currentSeasonStatus.registration.season.prize_pool.first.coins} coins`}
                    {currentSeasonStatus.registration.season.prize_pool.first.shuttlecocks > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.first.shuttlecocks} shuttlecocks`}
                    {currentSeasonStatus.registration.season.prize_pool.first.meals > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.first.meals} meals`}
                    {currentSeasonStatus.registration.season.prize_pool.first.diamonds > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.first.diamonds} diamonds`}
                  </p>
                </div>
              </div>

              {/* 2nd Place */}
              <div className="bg-[#f3f4f6] rounded-lg p-4 mt-2 flex">
                <Medal className="w-8 h-8 text-gray-300 mr-4" />
                <div>
                  <h3 className="font-bold">2nd Place</h3>
                  <p className="text-sm">
                    {currentSeasonStatus.registration.season.prize_pool.second.coins > 0 &&
                      `${currentSeasonStatus.registration.season.prize_pool.second.coins} coins`}
                    {currentSeasonStatus.registration.season.prize_pool.second.shuttlecocks > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.second.shuttlecocks} shuttlecocks`}
                    {currentSeasonStatus.registration.season.prize_pool.second.meals > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.second.meals} meals`}
                    {currentSeasonStatus.registration.season.prize_pool.second.diamonds > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.second.diamonds} diamonds`}
                  </p>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="bg-[#fff7ed] rounded-lg p-4 mt-2 flex">
                <Award className="w-8 h-8 text-orange-200 mr-4" />
                <div>
                  <h3 className="font-bold">3rd Place</h3>
                  <p className="text-sm">
                    {currentSeasonStatus.registration.season.prize_pool.third.coins > 0 &&
                      `${currentSeasonStatus.registration.season.prize_pool.third.coins} coins`}
                    {currentSeasonStatus.registration.season.prize_pool.third.shuttlecocks > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.third.shuttlecocks} shuttlecocks`}
                    {currentSeasonStatus.registration.season.prize_pool.third.meals > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.third.meals} meals`}
                    {currentSeasonStatus.registration.season.prize_pool.third.diamonds > 0 &&
                      ` + ${currentSeasonStatus.registration.season.prize_pool.third.diamonds} diamonds`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Group Standings */}
          <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <BarChart2 className="w-6 h-6 mr-2 text-blue-500" />
                Group Standings
              </h2>
              <button 
                onClick={() => setShowFullStandings(!showFullStandings)}
                className="flex items-center text-sm text-white bg-blue-600 hover:text-blue-800 px-4 py-2 rounded-lg flex items-center space-x-2 "
              >
                {showFullStandings ? (
                  <>
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <span>View All</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pos</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pts</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(showFullStandings 
                    ? currentSeasonStatus.standings 
                    : currentSeasonStatus.standings?.slice(0, 5)
                  )?.map((standing: any) => (
                    <tr 
                      key={standing.team_id}
                      className={standing.team_id === user?.id ? 'bg-blue-50 font-medium' : ''}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`font-bold ${
                            standing.position === 1 ? 'text-yellow-500' :
                            standing.position === 2 ? 'text-gray-500' :
                            standing.position === 3 ? 'text-amber-700' : ''
                          }`}>
                            {standing.position}
                          </span>
                          {standing.position <= 3 && (
                            <span className="ml-1">
                              {standing.position === 1 && <Crown className="w-4 h-4 text-yellow-500" />}
                              {standing.position === 2 && <Medal className="w-4 h-4 text-gray-500" />}
                              {standing.position === 3 && <Award className="w-4 h-4 text-amber-700" />}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <span>{standing.team_name}</span>
                          {standing.team_id === user?.id && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">YOU</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold">
                        {standing.points}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {standing.matches_played}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-green-600">
                        {standing.encounters_won}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-yellow-600">
                        {standing.encounters_drawn || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-red-600">
                        {standing.encounters_lost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Lineup Popup */}
        {showLineupPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Lineup Builder - MD{nextEncounter.matchday_number}</h3>
                <button 
                  onClick={() => setShowLineupPopup(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Match Types */}
                <div className="space-y-4">
                  {/* Men's Singles */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Men's Singles (MS)</label>
                    <select
                      value={lineup.mens_singles}
                      onChange={(e) => setLineup({...lineup, mens_singles: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select player</option>
                      {malePlayersAvailable.map(player => (
                        <option key={player.id} value={player.id}>
                          {player.name} (Level {player.level})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Women's Singles */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Women's Singles (WS)</label>
                    <select
                      value={lineup.womens_singles}
                      onChange={(e) => setLineup({...lineup, womens_singles: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select player</option>
                      {femalePlayersAvailable.map(player => (
                        <option key={player.id} value={player.id}>
                          {player.name} (Level {player.level})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Men's Doubles */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Men's Doubles (MD)</label>
                    <div className="space-y-2">
                      <select
                        value={lineup.mens_doubles[0]}
                        onChange={(e) => setLineup({...lineup, mens_doubles: [e.target.value, lineup.mens_doubles[1]]})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Player 1</option>
                        {malePlayersAvailable.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} (Level {player.level})
                          </option>
                        ))}
                      </select>
                      <select
                        value={lineup.mens_doubles[1]}
                        onChange={(e) => setLineup({...lineup, mens_doubles: [lineup.mens_doubles[0], e.target.value]})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Player 2</option>
                        {malePlayersAvailable.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} (Level {player.level})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Women's Doubles */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Women's Doubles (WD)</label>
                    <div className="space-y-2">
                      <select
                        value={lineup.womens_doubles[0]}
                        onChange={(e) => setLineup({...lineup, womens_doubles: [e.target.value, lineup.womens_doubles[1]]})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Player 1</option>
                        {femalePlayersAvailable.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} (Level {player.level})
                          </option>
                        ))}
                      </select>
                      <select
                        value={lineup.womens_doubles[1]}
                        onChange={(e) => setLineup({...lineup, womens_doubles: [lineup.womens_doubles[0], e.target.value]})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Player 2</option>
                        {femalePlayersAvailable.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} (Level {player.level})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mixed Doubles */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Mixed Doubles (XD)</label>
                    <div className="space-y-2">
                      <select
                        value={lineup.mixed_doubles[0]}
                        onChange={(e) => setLineup({...lineup, mixed_doubles: [e.target.value, lineup.mixed_doubles[1]]})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Male Player</option>
                        {malePlayersAvailable.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} (Level {player.level})
                          </option>
                        ))}
                      </select>
                      <select
                        value={lineup.mixed_doubles[1]}
                        onChange={(e) => setLineup({...lineup, mixed_doubles: [lineup.mixed_doubles[0], e.target.value]})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Female Player</option>
                        {femalePlayersAvailable.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} (Level {player.level})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Lineup Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold mb-3">Lineup Summary</h4>
                  <div className="space-y-3 text-sm">
                    <div className="bg-white p-3 rounded">
                      <span className="font-medium">MS:</span> {lineup.mens_singles ? gameState.players.find(p => p.id === lineup.mens_singles)?.name : 'Not assigned'}
                    </div>
                    <div className="bg-white p-3 rounded">
                      <span className="font-medium">WS:</span> {lineup.womens_singles ? gameState.players.find(p => p.id === lineup.womens_singles)?.name : 'Not assigned'}
                    </div>
                    <div className="bg-white p-3 rounded">
                      <span className="font-medium">MD:</span> {
                        lineup.mens_doubles[0] && lineup.mens_doubles[1] 
                          ? `${gameState.players.find(p => p.id === lineup.mens_doubles[0])?.name} / ${gameState.players.find(p => p.id === lineup.mens_doubles[1])?.name}`
                          : 'Not assigned'
                      }
                    </div>
                    <div className="bg-white p-3 rounded">
                      <span className="font-medium">WD:</span> {
                        lineup.womens_doubles[0] && lineup.womens_doubles[1] 
                          ? `${gameState.players.find(p => p.id === lineup.womens_doubles[0])?.name} / ${gameState.players.find(p => p.id === lineup.womens_doubles[1])?.name}`
                          : 'Not assigned'
                      }
                    </div>
                    <div className="bg-white p-3 rounded">
                      <span className="font-medium">XD:</span> {
                        lineup.mixed_doubles[0] && lineup.mixed_doubles[1] 
                          ? `${gameState.players.find(p => p.id === lineup.mixed_doubles[0])?.name} / ${gameState.players.find(p => p.id === lineup.mixed_doubles[1])?.name}`
                          : 'Not assigned'
                      }
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      handleLineupSubmission();
                      setShowLineupPopup(false);
                    }}
                    disabled={!canSubmitLineup() || loading}
                    className={`w-full mt-4 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 ${
                      canSubmitLineup() 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Submit Lineup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Season Schedule Popup */}
        {showSchedulePopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Season Schedule - {currentSeasonStatus.registration.season.name}</h3>
                <button 
                  onClick={() => setShowSchedulePopup(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {scheduleLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Home Team</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Away Team</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {seasonMatches.map((match) => (
                        <tr 
                          key={match.id}
                          className={match.id === nextEncounter?.id ? 'bg-blue-50' : ''}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">Week {match.week_number}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(match.match_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {match.home_team_type === 'user' 
                              ? match.home_team_id === user?.id 
                                ? 'Your Team' 
                                : match.home_team_name || 'Team ' + match.home_team_id.slice(0, 4)
                              : 'CPU Team'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {match.away_team_type === 'user' 
                              ? match.away_team_id === user?.id 
                                ? 'Your Team' 
                                : match.away_team_name || 'Team ' + match.away_team_id.slice(0, 4)
                              : 'CPU Team'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              match.status === 'completed' ? 'bg-green-100 text-green-800' :
                              match.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {match.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {match.final_score || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default fallback
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Interclub</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
};

export default InterclubPage;