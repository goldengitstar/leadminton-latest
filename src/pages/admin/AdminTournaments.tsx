import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { supabase } from '../../lib/supabase';
import { Tournament, TournamentTier, TournamentStatus } from '../../types/tournament';
import { Plus, Search, Edit, Trash2, Users, Play, Trophy, Calendar, Coins, X, Settings, User, UserPlus } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'tournaments' | 'registrations'>('tournaments');
  const [showCpuManagement, setShowCpuManagement] = useState(false);
  const [cpuPlayers, setCpuPlayers] = useState<any[]>([]);
  const [selectedCpuPlayers, setSelectedCpuPlayers] = useState<string[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  // Update the CPU management modal to track selected tournament
  const handleOpenCpuManagement = () => {
    const upcomingTournaments = tournamentList.filter(t => t.status === 'upcoming');
    if (upcomingTournaments.length > 0) {
      setSelectedTournamentId(upcomingTournaments[0].id);
    }
    setShowCpuManagement(true);
  };

  // Update the tournament select handler
  const handleTournamentSelect = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    
    // Find the tournament and pre-select registered CPU players
    const tournament = tournamentList.find(t => t.id === tournamentId);
    if (tournament && tournament.registered_players) {
      const cpuPlayerIds = tournament.registered_players
        .filter((p: any) => cpuPlayers.some(cpu => cpu.id === p.player_id))
        .map((p: any) => p.player_id);
      setSelectedCpuPlayers(cpuPlayerIds);
    } else {
      setSelectedCpuPlayers([]);
    }
  };

  // Update the handleAddCpuPlayers function to handle both additions and removals
  const handleAddCpuPlayers = async () => {
    if (!selectedTournamentId) {
      toast.error('Please select a tournament');
      return;
    }

    try {
      // Get current registered CPU players for this tournament
      const tournament = tournamentList.find(t => t.id === selectedTournamentId);
      const currentCpuPlayers = tournament?.registered_players 
        ? tournament.registered_players
            .filter((p: any) => cpuPlayers.some(cpu => cpu.id === p.player_id))
            .map((p: any) => p.player_id)
        : [];
      
      // Determine players to add and remove
      const playersToAdd = selectedCpuPlayers.filter(id => !currentCpuPlayers.includes(id));
      const playersToRemove = currentCpuPlayers.filter(id => !selectedCpuPlayers.includes(id));
      
      // Process updates
      if (playersToAdd.length > 0) {
        await tournamentService.addCpuPlayersToTournament(selectedTournamentId, playersToAdd);
      }
      if (playersToRemove.length > 0) {
        await tournamentService.removeCpuPlayersFromTournament(selectedTournamentId, playersToRemove);
      }
      
      toast.success('CPU players updated successfully');
      setShowCpuManagement(false);
      setSelectedCpuPlayers([]);
      loadTournaments();
    } catch (error) {
      console.error('Error updating CPU players:', error);
      toast.error('Failed to update CPU players. Please try again.');
    }
  };

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

      // ✅ Automatically select the first upcoming tournament
      const firstUpcoming = tournamentsData.find(t => t.status === 'upcoming');
      if (firstUpcoming) {
        setSelectedTournamentId(firstUpcoming.id);
      }

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
    const loadedTournament = await loadTournamentDetails(tournament.id);
    if (loadedTournament) {
      setManagingTournament(loadedTournament);
    }
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;
    try {
      await tournamentService.deleteTournament(tournamentId);
      setTournamentsList(tournamentList.filter(t => t.id !== tournamentId));
      await logActivity('tournament_deleted', 'tournament', tournamentId);
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast.error('Failed to delete tournament. Please try again.');
    }
  };

  const handleRemoveRegistration = async (tournamentId: string, playerId: string) => {
    if (!confirm('Are you sure you want to remove this registration?')) return;
    try {
      await tournamentService.removePlayerRegistration(tournamentId, playerId);
      toast.success('Registration removed successfully');
      loadTournaments();
    } catch (error) {
      console.error('Error removing registration:', error);
      toast.error('Failed to remove registration. Please try again.');
    }
  };

  const loadCpuPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_cpu', true);
      
      if (error) throw error;
      setCpuPlayers(data || []);
    } catch (error) {
      console.error('Error loading CPU players:', error);
    }
  };
  
  useEffect(() => {
    console.log("loading cpu players")
    loadCpuPlayers()
  }, []);

  const filteredTournaments = tournamentList.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === 'all' || tournament.tier === filterTier;
    const matchesStatus = filterStatus === 'all' || tournament.status === filterStatus;
    return matchesSearch && matchesTier && matchesStatus;
  });

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
          onClick={activeTab === 'tournaments' ? handleCreateTournament : () => setShowCpuManagement(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {activeTab === 'tournaments' ? (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create Tournament
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Manage CPU Players
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tournaments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tournaments
          </button>
          <button
            onClick={() => setActiveTab('registrations')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'registrations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Registrations
          </button>
        </nav>
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
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Search ${activeTab === 'tournaments' ? 'tournaments' : 'registrations'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>

          {activeTab === 'tournaments' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'tournaments' ? (
        <TournamentTableView 
          tournaments={filteredTournaments} 
          onEdit={handleEditTournament}
          onManage={handleManageTournament}
          onDelete={handleDeleteTournament}
        />
      ) : (
        <RegistrationsView 
          tournaments={filteredTournaments} 
          onRemoveRegistration={handleRemoveRegistration}
        />
      )}

      {/* Tournament Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTournament ? 'Edit Tournament' : 'Create New Tournament'}
              </h2>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              <TournamentForm
                tournament={editingTournament}
                onSave={(tournament: Tournament) => {
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
              <button onClick={() => setManagingTournament(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              <TournamentManagement
                tournament={managingTournament}
                onTournamentUpdate={() => {
                  loadTournaments();
                  const updatedTournament = tournamentList.find(t => t.id === managingTournament.id);
                  if (updatedTournament) setManagingTournament(updatedTournament);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* CPU Player Management Modal */}
      {showCpuManagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Manage CPU Players</h2>
              <button onClick={() => setShowCpuManagement(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Select upcoming Tournament</h3>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" 
                  value={selectedTournamentId || ''}
                  onChange={(e) => handleTournamentSelect(e.target.value)}
                  disabled={tournamentList.filter(t => t.status === 'upcoming').length === 0}
                >
                  {tournamentList.filter(t => t.status === 'upcoming').length === 0 ? (
                    <option value="">No upcoming tournaments</option>
                  ) : (
                    tournamentList
                      .filter(t => t.status === 'upcoming')
                      .map(tournament => (
                        <option key={tournament.id} value={tournament.id}>
                          {tournament.name} ({new Date(tournament.start_date).toLocaleDateString()})
                        </option>
                      ))
                  )}
                </select>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Available CPU Players</h3>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {cpuPlayers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No CPU players available</div>
                  ) : (
                    cpuPlayers.map(player => (
                      <label key={player.id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCpuPlayers.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCpuPlayers([...selectedCpuPlayers, player.id]);
                            } else {
                              setSelectedCpuPlayers(selectedCpuPlayers.filter(id => id !== player.id));
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-600">Level {player.level}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCpuManagement(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCpuPlayers}
                  disabled={!selectedTournamentId}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${
                    !selectedTournamentId ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Update Players
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Separate component for tournaments table view
const TournamentTableView = ({ tournaments, onEdit, onManage, onDelete }: {
  tournaments: any[];
  onEdit: (tournament: any) => void;
  onManage: (tournament: any) => void;
  onDelete: (id: string) => void;
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tournament</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Fee</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prize Pool</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tournaments.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                <Trophy className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No tournaments found</p>
                <p className="mt-1">Create your first tournament to get started</p>
              </td>
            </tr>
          ) : (
            tournaments.map((tournament) => (
              <tr key={tournament.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{tournament.name}</div>
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
                      onClick={() => onManage(tournament)}
                      className="text-green-600 hover:text-green-900 p-1"
                      title="Manage Tournament"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEdit(tournament)}
                      className="text-blue-600 hover:text-blue-900 p-1"
                      title="Edit Tournament"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(tournament.id)}
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
);

// Separate component for registrations view
const RegistrationsView = ({ tournaments, onRemoveRegistration }: {
  tournaments: any[];
  onRemoveRegistration: (tournamentId: string, playerId: string) => void;
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tournament</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered At</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tournaments.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No registrations found</p>
              </td>
            </tr>
          ) : (
            tournaments.flatMap(tournament => 
              tournament.registered_players?.map((player: any) => (
                <tr key={`${tournament.id}-${player.player_id}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{tournament.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(tournament.start_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {player.player_name || 'CPU Player'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {player.team_name || 'No Team'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(player.registered_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onRemoveRegistration(tournament.id, player.player_id)}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="Remove Registration"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )) || []
            )
          )}
        </tbody>
      </table>
    </div>
  </div>
);

function getTierBadgeColor(tier: string): string {
  switch (tier) {
    case 'local': return 'bg-gray-100 text-gray-800';
    case 'regional': return 'bg-blue-100 text-blue-800';
    case 'national': return 'bg-green-100 text-green-800';
    case 'international': return 'bg-yellow-100 text-yellow-800';
    case 'premier': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'upcoming': return 'bg-blue-100 text-blue-800';
    case 'ongoing': return 'bg-green-100 text-green-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default AdminTournaments;