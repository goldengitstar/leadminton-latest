import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { supabase } from '../../lib/supabase';
import { Player, PlayerGender, Resources, PlayerStats} from '../../types/game';
import { Plus, Search, Filter, Edit, Trash2, Bot, Users, Zap, ShieldCheck, Target, User, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
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

interface CpuPlayer extends Player, Resources, PlayerStats{

}

interface AdminCpuTeamsProps {}

const AdminCpuTeams: React.FC<AdminCpuTeamsProps> = () => {
  const { logActivity } = useAdmin();
  const [cpuTeams, setCpuTeams] = useState<CpuTeam[]>([]);
  const [cpuPlayers, setCpuPlayers] = useState<CpuPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSkillLevel, setFilterSkillLevel] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<CpuTeam | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<CpuPlayer | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [generateData, setGenerateData] = useState<{
    teamId: string;
    teamName: string;
    skillLevel: string;
    playerCount: number;
    genderBalance: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    skillLevel: 'intermediate' as CpuTeam['skillLevel'],
    playerCount: 6,
    genderBalance: 'mixed' as CpuTeam['genderBalance'],
    isActive: true
  });

  type PlayerForm = Omit<Partial<Player>, 'stats'> & {
    is_cpu: boolean;
    stats: PlayerStats;
  };

  const [playerFormData, setPlayerFormData] = useState<PlayerForm>({
    name: '',
    gender: 'male',
    level: 1,
    rank: 1,
    maxLevel: 156,
    is_cpu: true,
    stats: {
      endurance: 0,
      strength: 0,
      agility: 0,
      speed: 0,
      explosiveness: 0,
      injuryPrevention: 0,
      smash: 0,
      defense: 0,
      serve: 0,
      stick: 0,
      slice: 0,
      drop: 0
    },
    equipment: {
      racket: undefined,
      shoes: undefined,
      strings: undefined,
      shirt: undefined,
      shorts: undefined
    },
    injuries: [],
    strategy: {
      physicalCommitment: 0,
      playStyle: 0,
      movementSpeed: 0,
      fatigueManagement: 0,
      rallyConsistency: 0,
      riskTaking: 0,
      attack: 0,
      softAttack: 0,
      serving: 0,
      courtDefense: 0,
      mentalToughness: 0,
      selfConfidence: 0
    },
    best: []
  });

  useEffect(() => {
    loadCpuTeams();
    loadCpuPlayers();
    logActivity('cpu_teams_viewed');
  }, []);

  const loadCpuTeams = async () => {
    try {
      setLoading(true);
      
      // First, load CPU teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('cpu_teams')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (teamsError) {
        console.error('Error loading CPU teams:', teamsError);
        return;
      }

      // Then, load player assignments with player data
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('player_team_assignments')
        .select(`
          team_id,
          player:players(*)
        `);

      console.log("Assignment Data", assignmentsData)
      
      if (assignmentsError) {
        console.error('Error loading player assignments:', assignmentsError);
        return;
      }

      // Group players by team_id
      const playersByTeam = assignmentsData.reduce((acc: any, assignment: any) => {
        if (!acc[assignment.team_id]) {
          acc[assignment.team_id] = [];
        }
        if (assignment.player) {
          acc[assignment.team_id].push(assignment.player);
        }
        return acc;
      }, {});

      // Transform data to match our interface
      const transformedTeams: CpuTeam[] = (teamsData || []).map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        skillLevel: team.skill_level,
        playerCount: team.player_count,
        genderBalance: team.gender_balance,
        players: playersByTeam[team.id] || [],
        isActive: team.is_active,
        createdAt: team.created_at
      }));

      setCpuTeams(transformedTeams);
    } catch (error) {
      console.error('Error loading CPU teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCpuPlayers = async () => {
    try {
      setLoading(true);

      // Step 1: Load CPU players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('is_cpu', true)
        .order('name');

      if (playersError) {
        console.error('Error loading CPU players:', playersError);
        return;
      }

      if (!playersData) {
        setCpuPlayers([]);
        return;
      }

      // Step 2: Map each player with their resource totals + player levels
      const playersWithResources = await Promise.all(playersData.map(async (player) => {
        const resourceTypes = ['diamond', 'coins', 'shuttlecocks', 'meals'];

        const resourceTotals: Resources = {
          diamonds: 0,
          coins: 0,
          shuttlecocks: 0,
          meals: 0
        };

        // Load resource data
        const { data: resourceData } = await supabase
          .from('resource_transactions')
          .select('amount, resource_type')
          .eq('user_id', player.user_id)
          .in('resource_type', resourceTypes);

        if (resourceData) {
          for (const { amount, resource_type } of resourceData) {
            switch (resource_type) {
              case 'diamond':
                resourceTotals.diamonds += amount;
                break;
              case 'coins':
                resourceTotals.coins += amount;
                break;
              case 'shuttlecocks':
                resourceTotals.shuttlecocks += amount;
                break;
              case 'meals':
                resourceTotals.meals += amount;
                break;
            }
          }
        }

        // Load player stats from player_levels table
        const { data: levelStats, error: levelError } = await supabase
          .from('player_levels')
          .select('*')
          .eq('player_id', player.id)
          .single();

        if (levelError) {
          console.warn(`No level data for player ${player.id}:`, levelError.message);
        }

        return {
          ...player,
          ...resourceTotals,
          maxLevel: player.maxLevel || 156,
          stats: levelStats || {}
        };
      }));

      setCpuPlayers(playersWithResources);
    } catch (error) {
      console.error('Error loading CPU players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = () => {
    setEditingTeam(null);
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

  const handleCreatePlayer = () => {
    setEditingPlayer(null);
    setPlayerFormData({
      name: '',
      gender: 'male',
      level: 1,
      rank: 1,
      maxLevel: 156,
      is_cpu: true,
      stats: {
        endurance: 0,
        strength: 0,
        agility: 0,
        speed: 0,
        explosiveness: 0,
        injuryPrevention: 0,
        smash: 0,
        defense: 0,
        serve: 0,
        stick: 0,
        slice: 0,
        drop: 0
      },
      equipment: {
        racket: undefined,
        shoes: undefined,
        strings: undefined,
        shirt: undefined,
        shorts: undefined
      },
      injuries: [],
      strategy: {
        physicalCommitment: 0,
        playStyle: 0,
        movementSpeed: 0,
        fatigueManagement: 0,
        rallyConsistency: 0,
        riskTaking: 0,
        attack: 0,
        softAttack: 0,
        serving: 0,
        courtDefense: 0,
        mentalToughness: 0,
        selfConfidence: 0
      }
    });
    setShowCreateForm(true);
  };

  const handleEditTeam = (team: CpuTeam) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description,
      skillLevel: team.skillLevel,
      playerCount: team.playerCount,
      genderBalance: team.genderBalance,
      isActive: team.isActive
    });
    setShowCreateForm(true);
  };

  const handleEditPlayer = (player: CpuPlayer) => {
    setEditingPlayer(player);
    setPlayerFormData({
      name: player.name,
      gender: player.gender,
      level: player.level,
      rank: player.rank,
      maxLevel: player.maxLevel,
      is_cpu: true,
      stats: player.stats,
      statLevels: player.statLevels,
      equipment: player.equipment,
      injuries: player.injuries,
      strategy: player.strategy,
      best: player.best
    });
    setShowCreateForm(true);
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this CPU team? This will also remove all associated CPU players.')) return;

    try {
      // First get all players in this team to delete them
      const { data: assignments, error: assignmentsError } = await supabase
        .from('player_team_assignments')
        .select('player_id')
        .eq('team_id', teamId);

      if (assignmentsError) {
        console.error('Error getting team assignments:', assignmentsError);
        toast.error('Failed to delete CPU team. Please try again.');
        return;
      }

      // Delete all CPU players associated with this team
      if (assignments && assignments.length > 0) {
        const playerIds = assignments.map(a => a.player_id);
        const { error: playersError } = await supabase
          .from('players')
          .delete()
          .in('id', playerIds);

        if (playersError) {
          console.error('Error deleting CPU players:', playersError);
          toast.error('Failed to delete CPU players. Please try again.');
          return;
        }
      }

      // Delete the team (this should also cascade delete assignments due to foreign key constraints)
      const { error } = await supabase
        .from('cpu_teams')
        .delete()
        .eq('id', teamId);

      if (error) {
        console.error('Error deleting CPU team:', error);
        toast.error('Failed to delete CPU team. Please try again.');
        return;
      }

      await logActivity('cpu_team_deleted', 'cpu_team', teamId);
      loadCpuTeams();
      loadCpuPlayers(); // Refresh the CPU players list as well
    } catch (error) {
      console.error('Error deleting CPU team:', error);
      toast.error('Failed to delete CPU team. Please try again.');
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to delete this CPU player?')) return;

    try {
      // First delete from player_team_assignments
      const { error: assignmentsError } = await supabase
        .from('player_team_assignments')
        .delete()
        .eq('player_id', playerId);

      if (assignmentsError) {
        console.error('Error deleting player assignments:', assignmentsError);
        toast.error('Failed to delete CPU player assignments. Please try again.');
        return;
      }

      // Then delete the player
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) {
        console.error('Error deleting CPU player:', error);
        toast.error('Failed to delete CPU player. Please try again.');
        return;
      }

      await logActivity('cpu_player_deleted', 'player', playerId);
      loadCpuPlayers();
      loadCpuTeams(); // Refresh teams as well since they might reference this player
      toast.success('CPU player deleted successfully');
    } catch (error) {
      console.error('Error deleting CPU player:', error);
      toast.error('Failed to delete CPU player. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingTeam) {
        // Update existing team
        const { error } = await supabase
          .from('cpu_teams')
          .update({
            name: formData.name,
            description: formData.description,
            skill_level: formData.skillLevel,
            player_count: formData.playerCount,
            gender_balance: formData.genderBalance,
            is_active: formData.isActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTeam.id);

        if (error) {
          console.error('Error updating CPU team:', error);
          return;
        }

        await logActivity('cpu_team_updated', 'cpu_team', editingTeam.id);
      } else {
        // Create new team
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
      }

      setShowCreateForm(false);
      loadCpuTeams();
    } catch (error) {
      console.error('Error saving CPU team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { stats, strategy, ...playerData } = playerFormData;

      if (editingPlayer) {
        const { error: playerError } = await supabase
          .from('players')
          .update({
            name: playerData.name,
            gender: playerData.gender,
            level: playerData.level,
            rank: playerData.rank,
            max_level: playerData.maxLevel,
            equipment: playerData.equipment,
            injuries: playerData.injuries,
            best: playerData.best,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPlayer.id);

        if (playerError) throw playerError;

        // Update stats
        await supabase
          .from('player_levels')
          .update({
            endurance: stats.endurance,
            strength: stats.strength,
            agility: stats.agility,
            speed: stats.speed,
            explosiveness: stats.explosiveness,
            injury_prevention: stats.injuryPrevention,
            smash: stats.smash,
            defense: stats.defense,
            serve: stats.serve,
            stick: stats.stick,
            slice: stats.slice,
            drop: stats.drop
          })
          .eq('player_id', editingPlayer.id);


        const strategy = playerFormData.strategy!;
          await supabase
            .from('player_strategy')
            .update({
              physical_commitment: strategy.physicalCommitment,
              play_style: strategy.playStyle,
              movement_speed: strategy.movementSpeed,
              fatigue_management: strategy.fatigueManagement,
              rally_consistency: strategy.rallyConsistency,
              risk_taking: strategy.riskTaking,
              attack: strategy.attack,
              soft_attack: strategy.softAttack,
              serving: strategy.serving,
              court_defense: strategy.courtDefense,
              mental_toughness: strategy.mentalToughness,
              self_confidence: strategy.selfConfidence
            })
            .eq('player_id', editingPlayer.id);

        await logActivity('cpu_player_updated', 'player', editingPlayer.id);
        toast.success('CPU player updated successfully');
      } else {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        // Insert player
        const { data: player, error: playerError } = await supabase
          .from('players')
          .insert({
            name: playerData.name,
            gender: playerData.gender,
            level: playerData.level,
            rank: playerData.rank,
            max_level: playerData.maxLevel,
            injuries: playerData.injuries,
            is_cpu: true,
            user_id: user.id
          })
          .select()
          .single();

        if (playerError || !player) throw playerError;

        // Insert stats
        await supabase
          .from('player_levels')
          .insert({
            player_id : player.id,
            endurance: stats.endurance,
            strength: stats.strength,
            agility: stats.agility,
            speed: stats.speed,
            explosiveness: stats.explosiveness,
            injury_prevention: stats.injuryPrevention,
            smash: stats.smash,
            defense: stats.defense,
            serve: stats.serve,
            stick: stats.stick,
            slice: stats.slice,
            drop: stats.drop
          })


        const strategy = playerFormData.strategy!;
          await supabase
            .from('player_strategy')
            .insert({
              player_id : player.id,
              physical_commitment: strategy.physicalCommitment,
              play_style: strategy.playStyle,
              movement_speed: strategy.movementSpeed,
              fatigue_management: strategy.fatigueManagement,
              rally_consistency: strategy.rallyConsistency,
              risk_taking: strategy.riskTaking,
              attack: strategy.attack,
              soft_attack: strategy.softAttack,
              serving: strategy.serving,
              court_defense: strategy.courtDefense,
              mental_toughness: strategy.mentalToughness,
              self_confidence: strategy.selfConfidence
            })

        await logActivity('cpu_player_created', 'player', player.id);
        toast.success('CPU player created successfully');
      }

      setShowCreateForm(false);
      loadCpuPlayers();
    } catch (error) {
      console.error('Error saving CPU player:', error);
      toast.error('Failed to save CPU player. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateClick = (teamId: string, teamName: string, skillLevel: string, playerCount: number, genderBalance: string) => {
    setGenerateData({ teamId, teamName, skillLevel, playerCount, genderBalance });
    setShowGenerateConfirm(true);
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
      loadCpuTeams();
      loadCpuPlayers();
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

  const filteredTeams = cpuTeams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSkillLevel = filterSkillLevel === 'all' || team.skillLevel === filterSkillLevel;
    return matchesSearch && matchesSkillLevel;
  });

  const filteredPlayers = cpuPlayers.filter(player => {
    return player.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-gray-100 text-gray-800';
      case 'intermediate': return 'bg-blue-100 text-blue-800';
      case 'advanced': return 'bg-green-100 text-green-800';
      case 'expert': return 'bg-yellow-100 text-yellow-800';
      case 'master': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getGenderIcon = (balance: string) => {
    switch (balance) {
      case 'mixed': return '⚤';
      case 'male': return '♂';
      case 'female': return '♀';
      default: return '⚤';
    }
  };

  if (loading && cpuTeams.length === 0 && cpuPlayers.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">CPU Teams and Players Management</h1>
          <p className="text-gray-600">Create and manage CPU teams and players</p>
        </div>
        <button
          onClick={activeTab === 'teams' ? handleCreateTeam : handleCreatePlayer}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          {activeTab === 'teams' ? 'Create CPU Team' : 'Create CPU Player'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Teams</p>
              <p className="text-2xl font-bold text-gray-900">{cpuTeams.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Teams</p>
              <p className="text-2xl font-bold text-gray-900">
                {cpuTeams.filter(t => t.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total CPU Players</p>
              <p className="text-2xl font-bold text-gray-900">{cpuPlayers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Target className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Team Size</p>
              <p className="text-2xl font-bold text-gray-900">
                {cpuTeams.length > 0 ? Math.round(cpuTeams.reduce((sum, team) => sum + team.players.length, 0) / cpuTeams.length) : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'teams' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Teams
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'players' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Players
          </button>
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
                placeholder={activeTab === 'teams' ? 'Search CPU teams...' : 'Search CPU players...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>

          {/* Skill Level Filter - Only show for teams */}
          {activeTab === 'teams' && (
            <div className="w-full sm:w-48">
              <select
                value={filterSkillLevel}
                onChange={(e) => setFilterSkillLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Skill Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
                <option value="master">Master</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Teams List */}
      {activeTab === 'teams' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skill Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Players
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Bot className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-lg font-medium">No CPU teams found</p>
                      <p className="mt-1">Create your first CPU team to get started</p>
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team) => (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {team.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {team.description}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSkillLevelColor(team.skillLevel)}`}>
                          {team.skillLevel.charAt(0).toUpperCase() + team.skillLevel.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 text-gray-400 mr-1" />
                          {team.players.length}/{team.playerCount}
                          {(team.players.length < team.playerCount) && (
                            <button
                              onClick={() => handleGenerateClick(team.id, team.name, team.skillLevel, team.playerCount - team.players.length, team.genderBalance)}
                              className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                            >
                              Generate
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="mr-1">{getGenderIcon(team.genderBalance)}</span>
                          {team.genderBalance.charAt(0).toUpperCase() + team.genderBalance.slice(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          team.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {team.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditTeam(team)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Edit Team"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete Team"
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
      )}

      {/* Players List */}
      {activeTab === 'players' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto max-w-[81vw]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endurance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Strength
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agility
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Speed
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Explosiveness
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Smash
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Defense
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serve
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stick
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slice
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Drop
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <User className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-lg font-medium">No CPU players found</p>
                      <p className="mt-1">Create your first CPU player to get started</p>
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {player.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {player.level}/{player.maxLevel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {player.rank}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="mr-1">{getGenderIcon(player.gender ?? 'male')}</span>
                          {(player.gender ?? 'male').charAt(0).toUpperCase() + (player.gender ?? 'male').slice(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-blue-500 mr-1">🔋</span>
                          {player.stats.endurance}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-blue-500 mr-1">💪</span>
                          {player.stats.strength}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-green-500 mr-1">🏃</span>
                          {player.stats.agility}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-purple-500 mr-1">⚡</span>
                          {player.stats.speed}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-red-500 mr-1">💥</span>
                          {player.stats.explosiveness}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-indigo-500 mr-1">🏸</span>
                          {player.stats.smash}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-1">🛡️</span>
                          {player.stats.defense}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-cyan-500 mr-1">🎯</span>
                          {player.stats.serve}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-orange-500 mr-1">📏</span>
                          {player.stats.stick}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-pink-500 mr-1">🌀</span>
                          {player.stats.slice}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="text-lime-500 mr-1">🫳</span>
                          {player.stats.drop}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditPlayer(player)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Edit Player"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete Player"
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
      )}

      {/* Create/Edit Team Form Modal */}
      {showCreateForm && activeTab === 'teams' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingTeam ? 'Edit CPU Team' : 'Create New CPU Team'}
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
                  {loading ? 'Saving...' : (editingTeam ? 'Update Team' : 'Create Team')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Player Form Modal */}
      {showCreateForm && activeTab === 'players' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handlePlayerSubmit}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingPlayer ? 'Edit CPU Player' : 'Create New CPU Player'}
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
                    Player Name
                  </label>
                  <input
                    type="text"
                    value={playerFormData.name || ''}
                    onChange={(e) => setPlayerFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter player name"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      value={playerFormData.gender || 'male'}
                      onChange={(e) => setPlayerFormData(prev => ({ ...prev, gender: e.target.value as PlayerGender }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Level
                    </label>
                    <input
                      type="number"
                      value={playerFormData.level || 1}
                      onChange={(e) => setPlayerFormData(prev => ({ ...prev, level: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max={playerFormData.maxLevel || 156}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rank
                    </label>
                    <input
                      type="number"
                      value={playerFormData.rank || 1}
                      onChange={(e) => setPlayerFormData(prev => ({ ...prev, rank: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Level
                    </label>
                    <input
                      type="number"
                      value={playerFormData.maxLevel || 156}
                      onChange={(e) => setPlayerFormData(prev => ({ ...prev, maxLevel: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                  </div>
                </div>

                <div className="mb-6 border-t border-gray-200 pt-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Resources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['diamonds', 'shuttlecocks', 'coins', 'meals'] as const).map((resource) => (
                      <div key={resource}>
                        <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                          {resource}
                        </label>
                        <input
                          type="number"
                          value={(playerFormData as any)[resource] || 0}
                          onChange={(e) =>
                            setPlayerFormData((prev) => ({
                              ...prev,
                              [resource]: parseInt(e.target.value),
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Stats</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {([
                      'endurance',
                      'strength',
                      'agility',
                      'speed',
                      'explosiveness',
                      'smash',
                      'defense',
                      'serve',
                      'stick',
                      'slice',
                      'drop',
                    ] as (keyof PlayerStats)[]).map((stat) => (
                      <div key={stat}>
                        <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                          {stat}
                        </label>
                        <input
                          type="number"
                          value={playerFormData.stats?.[stat] ?? 0}
                          onChange={(e) =>
                            setPlayerFormData((prev) => ({
                              ...prev,
                              stats: {
                                ...prev.stats,
                                [stat]: parseInt(e.target.value),
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                    ))}
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
                  {loading ? 'Saving...' : (editingPlayer ? 'Update Player' : 'Create Player')}
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

export default AdminCpuTeams;