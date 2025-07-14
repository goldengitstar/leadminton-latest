import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { supabase } from '../../lib/supabase';
import { X, AlertTriangle} from 'lucide-react';
import TournamentForm from '../../components/admin/TournamentForm';
import { Tournament } from '../../types/tournament';
import { toast } from 'sonner';
import { Player} from '../../types/game';
import { PlayerService } from '../../services/database/playerService';
const playerService = new PlayerService(supabase);

interface CpuTeam {
  id: string;
  name: string;
  description: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
  playerCount: number;
  genderBalance: 'mixed' | 'male' | 'female';
  players: Player[];
  isActive: boolean;
  createdAt: string;
}

import {
  InterclubTier
} from '../../types/interclub';

interface DashboardStats {
  totalUsers: number;
  activeTournaments: number;
  activeSeasons: number;
  cpuTeams: number;
  recentActivities: any[];
}

const AdminDashboard: React.FC = () => {
  const { adminUser, logActivity } = useAdmin();
  const [showCreateTournamentForm, setShowCreateTournamentForm] = useState(false);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [generateData, setGenerateData] = useState<{
    teamId: string;
    teamName: string;
    skillLevel: string;
    playerCount: number;
    genderBalance: string;
  } | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeTournaments: 0,
    activeSeasons: 0,
    cpuTeams: 0,
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
    logActivity('dashboard_viewed');
  }, []); // Empty dependency array since logActivity is now memoized

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    skillLevel: 'intermediate' as CpuTeam['skillLevel'],
    playerCount: 6,
    genderBalance: 'mixed' as CpuTeam['genderBalance'],
    isActive: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Create new team
    try{
      const { data, error } = await supabase
        .from('cpu_teams')
        .insert({
          name: formData.name,
          description: formData.description,
          skill_level: formData.skillLevel,
          player_count: formData.playerCount,
          gender_balance: formData.genderBalance,
          is_active: formData.isActive
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating CPU team:', error);
        return;
      }

      await logActivity('cpu_team_created', 'cpu_team', data.id);

      setShowCreateForm(false);
    } catch (error) {
      console.error('Error saving CPU team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = () => {
    setFormData({
      name: '',
      description: '',
      skillLevel: 'intermediate',
      playerCount: 6,
      genderBalance: 'mixed',
      isActive: true
    });
    setShowCreateForm(true);
  };

  const generateCpuPlayers = async () => {
    if (!generateData) return;

    try {
      setLoading(true);
      console.log('[AdminCpuTeams] Generating CPU players using PlayerService...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      const cpuUserId = user.id;
      console.log('[AdminCpuTeams] Using current admin user ID for CPU players:', cpuUserId);

      const result = await playerService.generateCpuPlayersForTeam(
        cpuUserId,
        generateData.teamId,
        generateData.teamName,
        generateData.skillLevel as 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master',
        generateData.playerCount,
        generateData.genderBalance as 'mixed' | 'male' | 'female'
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate CPU players');
      }

      console.log(`[AdminCpuTeams] Successfully generated ${result.players?.length} CPU players`);
      await logActivity('cpu_players_generated', 'cpu_team', generateData.teamId, { playerCount: generateData.playerCount });
      setShowGenerateConfirm(false);
      setGenerateData(null);
      toast.success(`Successfully generated ${result.players?.length} CPU players!`);
    } catch (error) {
      console.error('[AdminCpuTeams] Error generating CPU players:', error);
      toast.error('Failed to create CPU players. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancelGenerate = () => {
    setShowGenerateConfirm(false);
    setGenerateData(null);
  };

  const [seasonForm, setSeasonForm] = useState({
    name: '',
    tier: 'departmental' as InterclubTier,
    start_date: '',
    end_date: '',
    registration_deadline: '',
    max_teams_per_group: 8,
    status: 'draft' as 'draft' | 'registration_open' | 'registration_closed' | 'active' | 'completed'
  });

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      
      const [statsResult, activitiesResult] = await Promise.all([
        supabase.rpc('get_admin_dashboard_stats'),
        supabase.from('admin_activity_logs')
          .select('id, action_type, target_type, target_id, details, created_at, admin_user_id')
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      if (statsResult.error || activitiesResult.error) {
        console.error('Error loading dashboard data:', statsResult.error || activitiesResult.error);
        return;
      }

      const dashboardStats = statsResult.data;
      setStats({
        totalUsers: dashboardStats?.total_users || 0,
        activeTournaments: dashboardStats?.active_tournaments || 0,
        activeSeasons: dashboardStats?.active_seasons || 0,
        cpuTeams: dashboardStats?.total_cpu_teams || 0,
        recentActivities: activitiesResult.data || []
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = () => {
    setShowCreateTournamentForm(true);
  };

  const handleCreateSeason = () => {
    setSeasonForm({
      name: '',
      tier: 'departmental',
      start_date: '',
      end_date: '',
      registration_deadline: '',
      max_teams_per_group: 8,
      status: 'draft'
    });
    setShowSeasonForm(true);
  };

  const handleSubmitSeason = async (e: React.FormEvent) => {
      e.preventDefault();
      
      try {
        setLoading(true);
        
        const seasonData = {
          name: seasonForm.name,
          tier: seasonForm.tier,
          start_date: new Date(seasonForm.start_date).toISOString(),
          end_date: new Date(seasonForm.end_date).toISOString(),
          registration_deadline: new Date(seasonForm.registration_deadline).toISOString(),
          max_teams_per_group: seasonForm.max_teams_per_group,
          status: seasonForm.status,
          groups: JSON.stringify([]),
          week_schedule: JSON.stringify([])
        };
  
        const { error } = await supabase
          .from('interclub_seasons')
          .insert(seasonData);
        
        if (error) throw error;
        
        logActivity('interclub_season_created_enhanced');
        setShowSeasonForm(false);
      } catch (error) {
        console.error('Error creating season:', error);
      } finally {
        setLoading(false);
      }
    };
  


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome to Admin Dashboard
        </h1>
        <div className="text-sm text-gray-500">
          Last login: {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl">🏆</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Tournaments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeTournaments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">🏟️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Seasons</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeSeasons}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-2xl">🤖</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">CPU Teams & Players</p>
              <p className="text-2xl font-bold text-gray-900">{stats.cpuTeams}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={handleCreateTournament}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="flex items-center">
              <span className="text-xl mr-3">🏆</span>
              <div>
                <p className="font-medium text-gray-900">Create Tournament</p>
                <p className="text-sm text-gray-500">Set up a new tournament</p>
              </div>
            </div>
          </button>

          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            onClick={handleCreateSeason}>
            <div className="flex items-center">
              <span className="text-xl mr-3">🏟️</span>
              <div>
                <p className="font-medium text-gray-900">Launch Season</p>
                <p className="text-sm text-gray-500">Start interclub season</p>
              </div>
            </div>
          </button>

          <button onClick={handleCreateTeam} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
            <div className="flex items-center">
              <span className="text-xl mr-3">🤖</span>
              <div>
                <p className="font-medium text-gray-900">Add CPU Team</p>
                <p className="text-sm text-gray-500">Create AI opponents</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Admin Activity</h2>
        {stats.recentActivities.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {stats.recentActivities.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {activity.action_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </p>
                    {activity.target_type && (
                      <p className="text-xs text-gray-500">
                        Target: {activity.target_type}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(activity.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {showCreateTournamentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create New Tournament</h2>
              <button
                onClick={() => setShowCreateTournamentForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              <TournamentForm
                tournament={null}
                onSave={(tournament: Tournament) => {
                  console.log('Tournament saved from dashboard:', tournament);
                  setShowCreateTournamentForm(false);
                  toast.success('Tournament created successfully!');
                }}
                onCancel={() => setShowCreateTournamentForm(false)}
              />
            </div>
          </div>
        </div>
      )}
      {/* Enhanced Season Creation Modal */}
      {showSeasonForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 h-[500px]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">New Interclub Season</h2>
            
            <form onSubmit={handleSubmitSeason} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Season name</label>
                <input
                  type="text"
                  value={seasonForm.name}
                  onChange={(e) => setSeasonForm({...seasonForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Tier</label>
                <select
                  value={seasonForm.tier}
                  onChange={(e) => setSeasonForm({...seasonForm, tier: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="departmental">Departmental</option>
                  <option value="regional">Regional</option>
                  <option value="national">National</option>
                  <option value="top12">TOP 12</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Start date</label>
                <input
                  type="datetime-local"
                  value={seasonForm.start_date}
                  onChange={(e) => setSeasonForm({...seasonForm, start_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">End date</label>
                <input
                  type="datetime-local"
                  value={seasonForm.end_date}
                  onChange={(e) => setSeasonForm({...seasonForm, end_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Registration deadline</label>
                <input
                  type="datetime-local"
                  value={seasonForm.registration_deadline}
                  onChange={(e) => setSeasonForm({...seasonForm, registration_deadline: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Max teams per group</label>
                <input
                  type="number"
                  min="5"
                  max="8"
                  value={seasonForm.max_teams_per_group}
                  onChange={(e) => setSeasonForm({...seasonForm, max_teams_per_group: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Initial status</label>
                <select
                  value={seasonForm.status}
                  onChange={(e) => setSeasonForm({...seasonForm, status: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="registration_open">Registration Open</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSeasonForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Season'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Create New CPU Team
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="px-6 py-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter team name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter team description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Skill Level
                    </label>
                    <select
                      value={formData.skillLevel}
                      onChange={(e) => setFormData(prev => ({ ...prev, skillLevel: e.target.value as CpuTeam['skillLevel'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                      <option value="master">Master</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Player Count
                    </label>
                    <input
                      type="number"
                      value={formData.playerCount}
                      onChange={(e) => setFormData(prev => ({ ...prev, playerCount: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender Balance
                    </label>
                    <select
                      value={formData.genderBalance}
                      onChange={(e) => setFormData(prev => ({ ...prev, genderBalance: e.target.value as CpuTeam['genderBalance'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="mixed">Mixed</option>
                      <option value="male">Male Only</option>
                      <option value="female">Female Only</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                      Active team
                    </label>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
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
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate CPU Players Confirmation Modal */}
      {showGenerateConfirm && generateData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-yellow-100 rounded-full mr-4">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Generate CPU Players</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Team:</span>
                    <span className="font-medium text-gray-900">{generateData.teamName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Skill Level:</span>
                    <span className="font-medium text-gray-900 capitalize">{generateData.skillLevel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Players to Generate:</span>
                    <span className="font-medium text-gray-900">{generateData.playerCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Gender Balance:</span>
                    <span className="font-medium text-gray-900 capitalize">{generateData.genderBalance}</span>
                  </div>
                </div>
                
                <p className="mt-4 text-sm text-gray-600">
                  Are you sure you want to generate <strong>{generateData.playerCount} CPU players</strong> for the <strong>{generateData.teamName}</strong> team?
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={cancelGenerate}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={generateCpuPlayers}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Generating...
                    </div>
                  ) : (
                    'Generate Players'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 