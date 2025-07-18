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
  Settings,
  List,
  Award,
  Table,
  Info,
  ChevronDown,
  ChevronUp
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

const InterclubPage: React.FC = () => {
  const { gameState, resources, refreshGameState } = useGame();
  const { user } = useAuth();
  const [interclubService] = useState(() => new InterclubService(supabase));
  
  // State management
  const [loading, setLoading] = useState(true);
  const [meetsGenderReqs, setMeetsGenderReqs] = useState(true);
  const [availableSeasons, setAvailableSeasons] = useState<InterclubSeason[]>([]);
  const [unlockedTiers, setUnlockedTiers] = useState<InterclubTier[]>(['departmental']);
  const [currentSeasonStatus, setCurrentSeasonStatus] = useState<any>(null);
  const [nextEncounter, setNextEncounter] = useState<any>(null);
  const [showLineupBuilder, setShowLineupBuilder] = useState(false);
  const [showFullPlayers, setShowFullPlayers] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [showFullRanking, setShowFullRanking] = useState(false);
  
  // Lineup state
  const [lineup, setLineup] = useState({
    mens_singles: '',
    womens_singles: '',
    mens_doubles: ['', ''] as [string, string],
    womens_doubles: ['', ''] as [string, string],
    mixed_doubles: ['', ''] as [string, string]
  });

  useEffect(() => {
    const maleCount = gameState.players.filter(p => p.gender === 'male').length;
    const femaleCount = gameState.players.filter(p => p.gender === 'female').length;
    const valid = (maleCount >= 4 && femaleCount >= 3);
    setMeetsGenderReqs(valid);
  }, [gameState.players]);

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
      }
      
    } catch (error) {
      console.error('Error loading interclub data:', error);
    } finally {
      setLoading(false);
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

  const canSubmitLineup = () => {
    return lineup.mens_singles && 
           lineup.womens_singles && 
           lineup.mens_doubles[0] && lineup.mens_doubles[1] &&
           lineup.womens_doubles[0] && lineup.womens_doubles[1] &&
           lineup.mixed_doubles[0] && lineup.mixed_doubles[1];
  };

  const malePlayersAvailable = gameState.players.filter(p => p.gender === 'male');
  const femalePlayersAvailable = gameState.players.filter(p => p.gender === 'female');

  // Calculate season end countdown (30 days from now for demo purposes)
  const seasonEndDate = new Date();
  seasonEndDate.setDate(seasonEndDate.getDate() + 30);
  const daysRemaining = Math.floor((seasonEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Sort players by level (descending)
  const sortedPlayers = [...gameState.players].sort((a, b) => b.level - a.level);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center space-x-3 mb-6">
        <Trophy className="w-8 h-8 text-blue-500" />
        <h1 className="text-2xl font-bold">Interclub Dashboard</h1>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Left - Club Players */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-500" />
              Club Players
            </h2>
            <button 
              onClick={() => setShowFullPlayers(!showFullPlayers)}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center"
            >
              {showFullPlayers ? 'Show Less' : 'View All'}
            </button>
          </div>
          
          <div className={`space-y-3 ${showFullPlayers ? 'max-h-[800px]' : 'max-h-[400px]'} overflow-y-auto`}>
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 rounded-lg text-xs font-medium mb-2">
              <div className="col-span-1">Rank</div>
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Level</div>
              <div className="col-span-2">Gender</div>
              <div className="col-span-2">Energy</div>
              <div className="col-span-1">Points</div>
            </div>
            
            {sortedPlayers.map((player, index) => (
              <div key={player.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-lg hover:bg-gray-100">
                <div className="col-span-1 font-medium text-sm">{index + 1}</div>
                <div className="col-span-4 font-medium truncate">{player.name}</div>
                <div className="col-span-2 text-sm">Lvl {player.level}</div>
                <div className="col-span-2 text-sm">{player.gender === 'male' ? 'Male' : 'Female'}</div>
                <div className="col-span-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(player.energy / 100) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs">{player.energy}/100</span>
                </div>
                <div className="col-span-1 text-sm font-bold">{player.points || 0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Right - Next Match & Lineup Builder */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <Target className="w-5 h-5 mr-2 text-blue-500" />
              Next Match
            </h2>
            <button
              onClick={() => setShowFullSchedule(!showFullSchedule)}
              className="flex items-center space-x-1 bg-gray-200 text-gray-800 p-2 rounded-lg hover:bg-gray-300"
              title="View full schedule"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {showFullSchedule ? (
            <div className="space-y-4">
              <h3 className="font-bold">Full Season Schedule</h3>
              {currentSeasonStatus?.schedule?.map((match: any) => (
                <div key={match.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">MD{match.matchday_number}</span>
                    <span className="text-sm text-gray-600">
                      {new Date(match.match_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={match.home_team_id === user?.id ? 'font-bold' : ''}>
                      {match.home_team_id === user?.id ? 'Your Team' : match.home_team_name}
                    </span>
                    <span className="px-2">vs</span>
                    <span className={match.away_team_id === user?.id ? 'font-bold' : ''}>
                      {match.away_team_id === user?.id ? 'Your Team' : match.away_team_name}
                    </span>
                  </div>
                  {match.status !== 'pending' && (
                    <div className="text-center mt-1 text-sm">
                      Result: {match.home_score} - {match.away_score}
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setShowFullSchedule(false)}
                className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 text-sm mt-2"
              >
                Hide Schedule
              </button>
            </div>
          ) : nextEncounter ? (
            <>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium">MD{nextEncounter.matchday_number}</span>
                  <span className="text-sm text-gray-600">
                    {new Date(nextEncounter.match_date).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mb-2">
                  <div className="text-center">
                    <div className="font-bold">
                      {nextEncounter.home_team_id === user?.id ? 'Your Team' : nextEncounter.home_team_name}
                    </div>
                    <div className="text-sm text-gray-600">Home</div>
                  </div>
                  
                  <div className="text-xl font-bold mx-4">vs</div>
                  
                  <div className="text-center">
                    <div className="font-bold">
                      {nextEncounter.away_team_id === user?.id ? 'Your Team' : nextEncounter.away_team_name}
                    </div>
                    <div className="text-sm text-gray-600">Away</div>
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Status:</span>
                  <span className="font-medium">
                    {nextEncounter.status === 'lineup_pending' ? 'Lineup Pending' : 'Scheduled'}
                  </span>
                </div>
              </div>

              {!showLineupBuilder ? (
                <button
                  onClick={() => setShowLineupBuilder(true)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 text-sm"
                >
                  Create Lineup
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Men's Singles */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Men's Singles</label>
                      <select
                        value={lineup.mens_singles}
                        onChange={(e) => setLineup({...lineup, mens_singles: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select player</option>
                        {malePlayersAvailable.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} (Lvl {player.level})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Women's Singles */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Women's Singles</label>
                      <select
                        value={lineup.womens_singles}
                        onChange={(e) => setLineup({...lineup, womens_singles: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select player</option>
                        {femalePlayersAvailable.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} (Lvl {player.level})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Men's Doubles */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Men's Doubles</label>
                      <div className="space-y-2">
                        <select
                          value={lineup.mens_doubles[0]}
                          onChange={(e) => setLineup({...lineup, mens_doubles: [e.target.value, lineup.mens_doubles[1]]})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Player 1</option>
                          {malePlayersAvailable.map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name} (Lvl {player.level})
                            </option>
                          ))}
                        </select>
                        <select
                          value={lineup.mens_doubles[1]}
                          onChange={(e) => setLineup({...lineup, mens_doubles: [lineup.mens_doubles[0], e.target.value]})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Player 2</option>
                          {malePlayersAvailable.map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name} (Lvl {player.level})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Women's Doubles */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Women's Doubles</label>
                      <div className="space-y-2">
                        <select
                          value={lineup.womens_doubles[0]}
                          onChange={(e) => setLineup({...lineup, womens_doubles: [e.target.value, lineup.womens_doubles[1]]})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Player 1</option>
                          {femalePlayersAvailable.map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name} (Lvl {player.level})
                            </option>
                          ))}
                        </select>
                        <select
                          value={lineup.womens_doubles[1]}
                          onChange={(e) => setLineup({...lineup, womens_doubles: [lineup.womens_doubles[0], e.target.value]})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Player 2</option>
                          {femalePlayersAvailable.map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name} (Lvl {player.level})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Mixed Doubles */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Mixed Doubles</label>
                      <div className="grid md:grid-cols-2 gap-2">
                        <select
                          value={lineup.mixed_doubles[0]}
                          onChange={(e) => setLineup({...lineup, mixed_doubles: [e.target.value, lineup.mixed_doubles[1]]})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Male Player</option>
                          {malePlayersAvailable.map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name} (Lvl {player.level})
                            </option>
                          ))}
                        </select>
                        <select
                          value={lineup.mixed_doubles[1]}
                          onChange={(e) => setLineup({...lineup, mixed_doubles: [lineup.mixed_doubles[0], e.target.value]})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Female Player</option>
                          {femalePlayersAvailable.map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name} (Lvl {player.level})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowLineupBuilder(false)}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLineupSubmission}
                      disabled={!canSubmitLineup() || loading}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {loading ? 'Submitting...' : 'Submit Lineup'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No upcoming matches</p>
            </div>
          )}
        </div>

        {/* Bottom Left - Season Rewards */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <Award className="w-5 h-5 mr-2 text-yellow-500" />
              Season Rewards
            </h2>
            <button 
              onClick={() => setShowFullRanking(!showFullRanking)}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
            >
              {showFullRanking ? 'Show Less' : 'View All'}
            </button>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Season ends in:</span>
              <span className="font-bold">{daysRemaining} days</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${100 - (daysRemaining / 30 * 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-yellow-100 to-yellow-50 rounded-lg border border-yellow-200">
              <Crown className="w-6 h-6 text-yellow-500" />
              <div>
                <div className="font-bold">1st Place</div>
                <div className="text-sm text-gray-600">500 coins, 50 shuttlecocks, Trophy</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg border border-gray-200">
              <Medal className="w-6 h-6 text-gray-500" />
              <div>
                <div className="font-bold">2nd Place</div>
                <div className="text-sm text-gray-600">300 coins, 30 shuttlecocks, Medal</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-amber-100 to-amber-50 rounded-lg border border-amber-200">
              <Medal className="w-6 h-6 text-amber-700" />
              <div>
                <div className="font-bold">3rd Place</div>
                <div className="text-sm text-gray-600">200 coins, 20 shuttlecocks</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Right - Group Ranking */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <Table className="w-5 h-5 mr-2 text-blue-500" />
              Group Ranking
            </h2>
            {currentSeasonStatus?.standing && (
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Your position: #{currentSeasonStatus.standing.position}
              </span>
            )}
          </div>

          {currentSeasonStatus?.standings ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Team</th>
                    <th className="px-3 py-2 text-left">Pts</th>
                    <th className="px-3 py-2 text-left">W</th>
                    <th className="px-3 py-2 text-left">L</th>
                    <th className="px-3 py-2 text-left">Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(showFullRanking ? currentSeasonStatus.standings : currentSeasonStatus.standings.slice(0, 5)).map((standing: any) => (
                    <tr 
                      key={standing.team_id}
                      className={standing.team_id === user?.id ? 'bg-blue-50 font-medium' : ''}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <span>{standing.position}</span>
                          {standing.position <= 3 && (
                            <span className="ml-1">
                              {standing.position === 1 && <Crown className="w-4 h-4 text-yellow-500" />}
                              {standing.position === 2 && <Medal className="w-4 h-4 text-gray-500" />}
                              {standing.position === 3 && <Medal className="w-4 h-4 text-amber-700" />}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {standing.team_name}
                        {standing.team_id === user?.id && (
                          <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded">YOU</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold">{standing.points}</td>
                      <td className="px-3 py-2 text-green-600">{standing.encounters_won}</td>
                      <td className="px-3 py-2 text-red-600">{standing.encounters_lost}</td>
                      <td className="px-3 py-2">
                        <div className="flex space-x-1">
                          {standing.form?.slice(-3).map((result: string, idx: number) => (
                            <div
                              key={idx}
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
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
              {!showFullRanking && currentSeasonStatus.standings.length > 5 && (
                <button
                  onClick={() => setShowFullRanking(true)}
                  className="w-full text-center text-blue-600 py-2 text-sm hover:underline"
                >
                  Show more ({currentSeasonStatus.standings.length - 5} hidden)
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
              No standings available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterclubPage;