import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { supabase } from '../../lib/supabase';
import { Tournament, TournamentTier, TournamentStatus } from '../../types/tournament';
import { Plus, Search, Edit, Trash2, Users, Play, Trophy, Calendar, Coins, X, Settings } from 'lucide-react';
import TournamentForm from '../../components/admin/TournamentForm';
import TournamentManagement from '../../components/admin/TournamentManagement';
import { toast } from 'sonner';
import { TournamentService } from '@/services/database/tournamentService';

const tournamentService = new TournamentService(supabase);

interface AdminTournamentsProps {}

const AdminTournaments: React.FC<AdminTournamentsProps> = () => {
  const { logActivity } = useAdmin();
  const [tournamentList, setTournamentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<TournamentTier | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TournamentStatus | 'all'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState<any | null>(null);
  const [managingTournament, setManagingTournament] = useState<any | null>(null);

  useEffect(() => {
    loadTournaments();
    logActivity('tournaments_viewed');
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const tournamentsData = await tournamentService.getTournaments();

      console.log('[AdminTournaments] Tournament list loaded successfully:', tournamentsData);
      setTournamentsList(tournamentsData);
    } catch (error) {
      console.error('[AdminTournaments] Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTournamentDetails = async (tournamentId: string): Promise<any | null> => {
    try {
      setLoading(true);
      const detailedTournament = await tournamentService.getTournamentWithMatches(tournamentId);
      setManagingTournament(detailedTournament);

      console.log('[AdminTournaments] Tournament details loaded successfully:', detailedTournament);
      return detailedTournament || null;

    } catch (error) {
      console.error('[AdminTournaments] Error loading tournament details:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = () => {
    setEditingTournament(null);
    setShowCreateForm(true);
  };

  const handleEditTournament = async (tournament: any) => {
    setEditingTournament(tournament);
    setShowCreateForm(true);
  };

  const handleManageTournament = async (tournament: any) => {
    // Load tournament details if not already loaded
    let tournamentWithDetails = tournament;
    if (!tournament.rounds || tournament.rounds.length === 0) {
      const loadedTournament = await loadTournamentDetails(tournament.id);
      if (loadedTournament) {
        tournamentWithDetails = loadedTournament;
      }
    }
    setManagingTournament(tournamentWithDetails);
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;

    try {
      // Delete tournament from database
      await tournamentService.deleteTournament(tournamentId);
      setTournamentsList(tournamentList.filter(tournament => tournament.id !== tournamentId));

      await logActivity('tournament_deleted', 'tournament', tournamentId);
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast.error('Failed to delete tournament. Please try again.');
    }
  };

  const filteredTournaments = tournamentList.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === 'all' || tournament.tier === filterTier;
    const matchesStatus = filterStatus === 'all' || tournament.status === filterStatus;
    return matchesSearch && matchesTier && matchesStatus;
  });

  console.log('[filteredTournaments]', filteredTournaments);

  const getTierBadgeColor = (tier: TournamentTier) => {
    switch (tier) {
      case 'local': return 'bg-gray-100 text-gray-800';
      case 'regional': return 'bg-blue-100 text-blue-800';
      case 'national': return 'bg-green-100 text-green-800';
      case 'international': return 'bg-yellow-100 text-yellow-800';
      case 'premier': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: TournamentStatus) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournament Management</h1>
          <p className="text-gray-600">Create, manage, and monitor tournaments</p>
        </div>
        <button
          onClick={handleCreateTournament}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Tournament
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Trophy className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Tournaments</p>
              <p className="text-2xl font-bold text-gray-900">{tournamentList.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {tournamentList.filter(t => t.status === 'ongoing').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900">
                {tournamentList.filter(t => t.status === 'upcoming').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Trophy className="w-6 h-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {tournamentList.filter(t => t.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tournaments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>

          {/* Tier Filter */}
          <div className="w-full sm:w-48">
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value as TournamentTier | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tiers</option>
              <option value="local">Local</option>
              <option value="regional">Regional</option>
              <option value="national">National</option>
              <option value="international">International</option>
              <option value="premier">Premier</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TournamentStatus | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tournament List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tournament
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entry Fee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prize Pool
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTournaments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Trophy className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg font-medium">No tournaments found</p>
                    <p className="mt-1">Create your first tournament to get started</p>
                  </td>
                </tr>
              ) : (
                filteredTournaments.map((tournament) => (
                  <tr key={tournament.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {tournament.name}
                        </div>
                        <div className="flex items-center mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierBadgeColor(tournament.tier)}`}>
                            {tournament.tier.charAt(0).toUpperCase() + tournament.tier.slice(1)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(tournament.status)}`}>
                        {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 text-gray-400 mr-1" />
                        {tournament.current_participants || 0}/{tournament.max_participants}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        {tournament.entry_fee?.coins && (
                          <div className="flex items-center">
                            <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                            <span>{tournament.entry_fee.coins}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        {tournament.prize_pool?.first?.coins && (
                          <div className="flex items-center">
                            <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                            <span>{tournament.prize_pool.first.coins}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{new Date(tournament.start_date).toLocaleDateString()}</div>
                        <div className="text-gray-500 text-xs">
                          to {new Date(tournament.end_date).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleManageTournament(tournament)}
                          className="text-green-600 hover:text-green-900 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={"Manage Tournament"}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditTournament(tournament)}
                          className="text-blue-600 hover:text-blue-900 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={"Edit Tournament"}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTournament(tournament.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete Tournament"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tournament Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTournament ? 'Edit Tournament' : 'Create New Tournament'}
              </h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              <TournamentForm
                tournament={editingTournament}
                onSave={(tournament: Tournament) => {
                  console.log('Tournament saved:', tournament);
                  setShowCreateForm(false);
                  loadTournaments();
                }}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tournament Management Modal */}
      {managingTournament && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 h-full">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Manage Tournament: {managingTournament.name}
              </h2>
              <button
                onClick={() => setManagingTournament(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              <TournamentManagement
                tournament={managingTournament}
                onTournamentUpdate={() => {
                  loadTournaments();
                  // Refresh the managing tournament data
                  const updatedTournament = tournamentList.find(t => t.id === managingTournament.id);
                  if (updatedTournament) {
                    setManagingTournament(updatedTournament);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTournaments; 