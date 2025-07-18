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
  Crown,
  Medal,
  Target,
  Play,
  Eye,
  Settings
} from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { InterclubService } from '../services/database/interclubService';
import { supabase } from '../lib/supabase';
import {
  InterclubSeason,
  InterclubTier,
  InterclubRegistrationRequest,
  LineupSubmission,
  TIER_REQUIREMENTS,
  INTERCLUB_TIERS
} from '../types/interclub';

type PageView = 'selection' | 'registration' | 'dashboard' | 'lineup' | 'standings';

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
  
  // Registration state
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [teamName, setTeamName] = useState('');
  const [registrationError, setRegistrationError] = useState<string>('');
  
  // Lineup state
  const [lineupSubmission, setLineupSubmission] = useState<LineupSubmission | null>(null);
  
  useEffect(() => {
    const maleCount    = gameState.players.filter(p => p.gender === 'male').length;
    const femaleCount  = gameState.players.filter(p => p.gender === 'female').length;
    console.log("Male count ", maleCount, "Female count ", femaleCount)
    setMeetsGenderReqs(maleCount >= 4 && femaleCount >= 3);
    console.log(meetsGenderReqs)
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
        // Show success message
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

  const handleLineupSubmission = async () => {
    if (!user?.id || !lineupSubmission) return;

    try {
      setLoading(true);
      const result = await interclubService.submitLineup(user.id, lineupSubmission);
      
      if (result.success) {
        await loadInterclubData();
        setCurrentView('dashboard');
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
                              if (selectedPlayers.length < 10) { // Max 10 players
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

  // Dashboard View (Active Season)
  if (currentView === 'dashboard' && currentSeasonStatus) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <Trophy className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Interclub Season - {currentSeasonStatus.registration.season.name}</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Next Match Card */}
          <div className="lg:col-span-2">
            {nextEncounter ? (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <Target className="w-6 h-6 mr-2 text-blue-500" />
                  Next Match
                </h2>
                
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">MD{nextEncounter.matchday_number}</span>
                    <span className="text-sm text-gray-600">
                      {new Date(nextEncounter.match_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-center">
                    {nextEncounter.home_team_id === user?.id ? 'HOME' : 'AWAY'}
                  </div>
                </div>

                <div className="flex justify-center space-x-4">
                  {nextEncounter.status === 'lineup_pending' && (
                    <button
                      onClick={() => setCurrentView('lineup')}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Create Lineup</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => setCurrentView('standings')}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Standings</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Active Season</h2>
                <p className="text-gray-600">All matches are completed or pending scheduling.</p>
              </div>
            )}
          </div>

          {/* Current Standing */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <Medal className="w-6 h-6 mr-2 text-yellow-500" />
              Your Position
            </h2>
            
            {currentSeasonStatus.standing ? (
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  #{currentSeasonStatus.standing.position}
                </div>
                <div className="text-gray-600 mb-4">
                  {currentSeasonStatus.standing.points} points
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Matches played:</span>
                    <span>{currentSeasonStatus.standing.matches_played}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wins:</span>
                    <span className="text-green-600">{currentSeasonStatus.standing.encounters_won}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Losses:</span>
                    <span className="text-red-600">{currentSeasonStatus.standing.encounters_lost}</span>
                  </div>
                </div>

                {/* Form */}
                {currentSeasonStatus.standing.form && currentSeasonStatus.standing.form.length > 0 && (
                  <div className="mt-4">
                    <span className="text-sm text-gray-600">Recent form:</span>
                    <div className="flex justify-center space-x-1 mt-1">
                      {currentSeasonStatus.standing.form.slice(-5).map((result: string, index: number) => (
                        <div
                          key={index}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            result === 'W' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        >
                          {result}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-center">Position not available</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Lineup Builder View
  if (currentView === 'lineup' && nextEncounter) {
    const [lineup, setLineup] = useState({
      mens_singles: '',
      womens_singles: '',
      mens_doubles: ['', ''] as [string, string],
      womens_doubles: ['', ''] as [string, string],
      mixed_doubles: ['', ''] as [string, string]
    });

    const malePlayersAvailable = gameState.players.filter(p => p.gender === 'male');
    const femalePlayersAvailable = gameState.players.filter(p => p.gender === 'female');

    const canSubmitLineup = () => {
      return lineup.mens_singles && 
             lineup.womens_singles && 
             lineup.mens_doubles[0] && lineup.mens_doubles[1] &&
             lineup.womens_doubles[0] && lineup.womens_doubles[1] &&
             lineup.mixed_doubles[0] && lineup.mixed_doubles[1];
    };

    const handleSubmitLineup = async () => {
      if (!canSubmitLineup()) return;

      const submission: LineupSubmission = {
        encounter_id: nextEncounter.id,
        lineup
      };

      try {
        setLoading(true);
        const result = await interclubService.submitLineup(user!.id, submission);
        
        if (result.success) {
          await loadInterclubData();
          setCurrentView('dashboard');
        }
      } catch (error) {
        console.error('Lineup submission error:', error);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <Settings className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Lineup - MD{nextEncounter.matchday_number}</h1>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Match Types */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Match Lineups</h2>

              {/* Men's Singles */}
              <div>
                <label className="block text-sm font-medium mb-2">Men's Singles (MS)</label>
                <select
                  value={lineup.mens_singles}
                  onChange={(e) => setLineup({...lineup, mens_singles: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a player</option>
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
                  <option value="">Select a player</option>
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
              <h3 className="font-bold mb-4">Lineup Summary</h3>
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

              <div className="mt-6">
                <button
                  onClick={handleSubmitLineup}
                  disabled={!canSubmitLineup() || loading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Lineup'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standings View
  if (currentView === 'standings' && currentSeasonStatus) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <Trophy className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Group Standings</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">+/-</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentSeasonStatus.standings?.map((standing: any, index: number) => (
                  <tr 
                    key={standing.team_id}
                    className={standing.team_id === user?.id ? 'bg-blue-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg font-bold">{standing.position}</span>
                        {standing.position <= 2 && <Crown className="w-4 h-4 ml-1 text-yellow-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="font-medium">{standing.team_name}</span>
                        {standing.team_id === user?.id && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">YOU</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-blue-600">
                      {standing.points}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{standing.matches_played}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-green-600">{standing.encounters_won}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-red-600">{standing.encounters_lost}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {standing.individual_matches_won - standing.individual_matches_lost > 0 ? '+' : ''}
                      {standing.individual_matches_won - standing.individual_matches_lost}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-1">
                        {standing.form?.slice(-5).map((result: string, idx: number) => (
                          <div
                            key={idx}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                              result === 'W' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          >
                            {result}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
