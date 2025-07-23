import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { InterclubService } from '../../services/database/interclubService';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2,
  Coins,
  Diamond,
  Feather, 
  UtensilsCrossed,
  Users, 
  Calendar, 
  Trophy, 
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
  Play,
  Pause,
  Eye,
  Crown,
  Target,
  RotateCcw,
  BarChart3,
  X,
  TableCellsMerge
} from 'lucide-react';
import {
  InterclubSeason,
  InterclubTier,
  TIER_REQUIREMENTS,
  Team, Group
} from '../../types/interclub';

interface AdminRegistration {
  id: string;
  team_name: string;
  user_id: string;
  season_id: string;
  players: any[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  season?: {
    name: string;
    tier: InterclubTier;
    status: string;
  };
}

interface MatchData {
  id: string;
  season_id: string;
  group_id: string;
  matchday_number: number;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  status: string;
  home_score?: number;
  away_score?: number;
}

interface ClubData {
  user_id: string;
  name: string;
  club_name: string;
  resources: {
    diamonds: number;
    meals: number;
    shuttlecocks: number;
    coins: number;
  };
}

const AdminInterclub: React.FC = () => {
  const { logActivity } = useAdmin();
  const [interclubService] = useState(() => new InterclubService(supabase));
  
  // Enhanced state management
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [groupEditForm, setGroupEditForm] = useState({
    name: '',
    teams: [] as Team[]
  });
  const [seasons, setSeasons] = useState<InterclubSeason[]>([]);
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'seasons' | 'registrations' | 'groups' | 'matches' | 'stats' | 'clubs'>('seasons');
  const [searchTerm, setSearchTerm] = useState('');
  const [cpuClubName, setCpuClubName] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<InterclubSeason | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<InterclubSeason | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [groupForm, setGroupForm] = useState({
    name: '',
    seasonId: '',
    availableTeams: [] as Array<{ id: string; name: string; type: 'cpu' | 'player' }>,
    selectedTeams: [] as Array<{ id: string; name: string; type: 'cpu' | 'player' }>
  });
  const [clubs, setClubs] = useState<ClubData[]>([]);
  const [editingClub, setEditingClub] = useState<ClubData | null>(null);
  const [resourceForm, setResourceForm] = useState({
    diamonds: 0,
    meals: 0,
    shuttlecocks: 0,
    coins: 0
  });
  const [showCpuRegistrationPopup, setShowCpuRegistrationPopup] = useState(false);
  const [cpuTeams, setCpuTeams] = useState<any[]>([]);
  const [cpuRegistrationForm, setCpuRegistrationForm] = useState({
    season_id: '',
    team_name: '',
    club_name: '',
    captain_name: '',
    captain_email: '',
    players: [] as string[],
  });

  const [showCpuClubForm, setShowCpuClubForm] = useState(false);
  const [cpuClubForm, setCpuClubForm] = useState({
    name: '',
    club_name: '',
    resources: {
      diamonds: 0,
      meals: 0,
      shuttlecocks: 0,
      coins: 0
    }
  });

  const handleCreateCpuClub = async () => {
    try {
      setLoading(true);
      
      const clubName = cpuClubForm.club_name || `CPU CLUB ${Math.floor(Math.random() * 1000)}`;
      
      const cpuUserId = '00000000-0000-0000-0000-000000000000';
      
      const { error } = await supabase
        .from('club_managers')
        .insert({
          manager_name: cpuClubForm.name || 'CPU Manager',
          name: cpuClubForm.name || 'CPU',
          surname: 'Manager',
          user_id: cpuUserId,
          club_name: clubName
        });
      
      if (error) throw error;
      
      await Promise.all(
        Object.entries(cpuClubForm.resources).map(async ([type, amount]) => {
          if (amount > 0) {
            await supabase
              .from('resource_transactions')
              .insert({
                user_id: cpuUserId,
                source: "initial_resources",
                resource_type: type,
                amount: amount
              });
          }
        })
      );
      
      logActivity('cpu_club_created');
      setShowCpuClubForm(false);
      await loadClubs();
    } catch (error) {
      console.log('Error creating CPU club:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Enhanced form state for tier-based seasons
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    tier: 'departmental' as InterclubTier,
    start_date: '',
    end_date: '',
    registration_deadline: '',
    max_teams_per_group: 8,
    status: 'draft' as 'draft' | 'registration_open' | 'registration_closed' | 'active' | 'completed',
    entry_fee: {
      coins: 0,
      shuttlecocks: 0,
      meals: 0,
      diamonds: 0
    },
    prize_pool: {
      first: {
        coins: 0,
        shuttlecocks: 0,
        meals: 0,
        diamonds: 0
      },
      second: {
        coins: 0,
        shuttlecocks: 0,
        meals: 0,
        diamonds: 0
      },
      third: {
        coins: 0,
        shuttlecocks: 0,
        meals: 0,
        diamonds: 0
      }
    }
  });

  const loadClubs = async () => {
    try {
      setLoading(true);
      
      // Fetch all players who are club managers
      const { data: managers } = await supabase
        .from('club_managers')
        .select('*')
      
      console.log("managers", managers)
      if (!managers) return;
      
      // For each manager, get their resource transactions
      const clubsData = await Promise.all(managers.map(async (manager) => {
        const { data: transactions } = await supabase
          .from('resource_transactions')
          .select('resource_type, amount')
          .eq('user_id', manager.user_id);
        
        // Calculate total resources
        const resources = {
          diamonds: 0,
          meals: 0,
          shuttlecocks: 0,
          coins: 0
        };
        
        transactions?.forEach(t => {
          if (t.resource_type === 'diamonds') resources.diamonds += t.amount;
          if (t.resource_type === 'meals') resources.meals += t.amount;
          if (t.resource_type === 'shuttlecocks') resources.shuttlecocks += t.amount;
          if (t.resource_type === 'coins') resources.coins += t.amount;
        });
        
        return {
          user_id: manager.user_id,
          name: manager.name,
          club_name: manager.club_name,
          resources
        };
      }));
      console.log("clubs data", clubsData)
      setClubs(clubsData);
    } catch (error) {
      console.error('Error loading clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeasons();
    loadPendingRegistrations();
    loadGroups();
    loadMatches();
    loadClubs(); // Add this
    logActivity('admin_interclub_enhanced_viewed');
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      setGroupEditForm({
        name: selectedGroup.name,
        teams: [...selectedGroup.teams]
      });
      fetchAvailableTeams(selectedGroup.id);
    }
  }, [selectedGroup]);

  useEffect(() => {
    loadSeasons();
    loadPendingRegistrations();
    loadGroups();
    loadMatches();
    logActivity('admin_interclub_enhanced_viewed');
  }, []);

  const fetchAvailableTeams = async (groupId: string) => {

    const { data: cpuTeams } = await supabase
      .from('cpu_teams')
      .select('id, name, group_id')
      .or(`group_id.eq.${groupId},group_id.is.null`)

    const { data: playerTeams } = await supabase
      .from('interclub_teams')
      .select('id, team_name, group_id')
      .or(`group_id.eq.${groupId},group_id.is.null`)

    setAvailableTeams([
      ...(cpuTeams?.map(t => ({ id: t.id, type: 'cpu', team_name: t.name })) || []),
      ...(playerTeams?.map(t => ({ id: t.id, type: 'player', team_name: t.team_name })) || [])
    ]);

  };

  const updateClubResources = async () => {
    if (!editingClub) return;

    try {
      setLoading(true);
      console.log(editingClub.user_id)
      await Promise.all(
        Object.entries(resourceForm).map(async ([type, amount]) => {
          console.log(type, amount)
          const { error } = await supabase
            .from('resource_transactions')
            .insert({
              user_id: editingClub.user_id,
              source: "manual_adjustment",
              resource_type: type,
              amount: Number(amount)
            });

          if (error) {
            throw new Error(`Failed to insert ${type}: ${error.message}`);
          }
        })
      );

      await logActivity('club_resources_updated', 'player', editingClub.user_id);
      setEditingClub(null);
      await loadClubs();
    } catch (error) {
      console.error('Error updating club resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamsForSeason = async (seasonId: string) => {
    try {
      setLoading(true);
      
      const { data: cpuTeams } = await supabase
        .from('cpu_teams')
        .select('id, name')
        .is('group_id', null);

      const { data: playerTeams } = await supabase
        .from('interclub_teams')
        .select('id, name')
        .is('group_id', null);

     setGroupForm(prev => ({
      ...prev,
      availableTeams: [
        ...(cpuTeams ? cpuTeams.map(t => ({ id: t.id, name: t.name, type: 'cpu' as const })) : []),
        ...(playerTeams ? playerTeams.map(t => ({ id: t.id, name: t.name, type: 'player' as const })) : [])
      ]
    }));
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamToggle = (team: any) => {
    setGroupEditForm(prev => {
      const exists = prev.teams.some(t => t.id === team.id && t.type === team.type);
      return {
        ...prev,
        teams: exists
          ? prev.teams.filter(t => !(t.id === team.id && t.type === team.type))
          : [...prev.teams, team]
      };
    });
  };

  const handleSaveGroup = async () => {
    try {
      await supabase
        .from('interclub_groups')
        .update({ name: groupEditForm.name })
        .eq('id', selectedGroup?.id);

      const updatePromises = groupEditForm.teams.map(team => {
        console.log(team)
        return supabase
          .from(team.type === 'cpu' ? 'cpu_teams' : 'interclub_registrations')
          .update({ group_id: selectedGroup?.id })
          .eq('id', team.id);
      });

      await Promise.all(updatePromises);
      
      // Refresh data
      await loadSeasons();
      setSelectedGroup(null);
    } catch (error) {
      console.error('Error saving group:', error);
    }
  };

  const loadSeasons = async () => {
    try {
      setLoading(true);
      
      const { data: seasonsData, error } = await supabase
      .from('interclub_seasons')
      .select(`
        *,
        groups:interclub_groups!season_id(
          *,
          cpu_teams:cpu_teams!group_id(
            id,
            name
          ),
          player_teams:interclub_teams!group_id(
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false });

      console.log("Seasons data", seasonsData)
      if (error) throw error;
      if (!seasonsData) return setSeasons([]);

      const transformedSeasons = seasonsData.map(season => ({
        ...season,
        groups: season.groups?.map((group: {
          id: string;
          name: string;
          created_at: string;
          cpu_teams?: Array<{
            id: string;
            name: string;
            cpu_team?: { name?: string };
          }>;
          player_teams?: Array<{
            id: string;
            name: string;
            player_team?: { team_name?: string };
          }>;
        }) => ({
          id: group.id,
          name: group.name,
          created_at: group.created_at,
          teams: [
            ...(group.cpu_teams?.map(t => ({
              id: t.id,
              type: 'cpu' as const,
              team_name: t.name || `CPU Team ${t.id}`
            })) || []),
            ...(group.player_teams?.map(t => ({
              id: t.id,
              type: 'player' as const,
              team_name: t.name || `Team ${t.id}`
            })) || [])
          ]
        })) || [],
        week_schedule: JSON.parse(season.week_schedule || '[]')
      }));

      setSeasons(transformedSeasons);
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('interclub_registrations')
        .select(`
          *,
          season:season_id(name, tier, status)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading registrations:', error);
        return;
      }
      const transformedRegistrations = (data || []).map(reg => {
        let players = reg.players;
        if (typeof players === 'string') {
          try {
            players = JSON.parse(players);
          } catch (e) {
            console.error('Error parsing players JSON', e);
            players = [];
          }
        }
        return {
          ...reg,
          players: players || []
        };
      });
      
      setRegistrations(transformedRegistrations);
    } catch (error) {
      console.error('Error loading registrations:', error);
    }
  };

  const loadGroups = async () => {
    try {
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('interclub_matches')
        .select('*')
        .order('match_date', { ascending: true });
      
      if (error) {
        console.error('Error loading matches:', error);
        return;
      }

      setMatches(data || []);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const handleCreateSeason = () => {
    setSeasonForm({
      name: '',
      tier: 'departmental',
      start_date: '',
      end_date: '',
      registration_deadline: '',
      max_teams_per_group: 8,
      status: 'draft',
      entry_fee: { coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0},
      prize_pool: { first: {coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0}, second: {coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0}, third: {coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0} }
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
        week_schedule: JSON.stringify([]),
        entry_fee: seasonForm.entry_fee,
        prize_pool: seasonForm.prize_pool
      };

      const { error } = await supabase
        .from('interclub_seasons')
        .insert(seasonData);
      
      if (error) throw error;
      
      logActivity('interclub_season_created_enhanced');
      setShowSeasonForm(false);
      await loadSeasons();
    } catch (error) {
      console.error('Error creating season:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationAction = async (registrationId: string, action: 'approved' | 'rejected') => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('interclub_registrations')
        .update({
          status: action,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', registrationId);
      
      if (error) throw error;
      
              logActivity(`interclub_registration_${action}`, 'registration', registrationId);
      await loadPendingRegistrations();
    } catch (error) {
      console.error(`Error ${action} registration:`, error);
    } finally {
      setLoading(false);
    }
  };

async function createInterclubGroups(seasonId: string) {
  const { data: season } = await supabase
    .from('interclub_seasons')
    .select('max_teams_per_group')
    .eq('id', seasonId)
    .single();
  if (!season) throw new Error('Season not found');
  const maxPerGroup = Math.min(season.max_teams_per_group, 8);

  const { data: approvedRegs } = await supabase
    .from('interclub_registrations')
    .select('user_id')
    .eq('season_id', seasonId)
    .eq('status', 'approved')
    .eq('is_cpu', false);
  if (!approvedRegs) throw new Error('Error fetching real team registrations');
  const realTeams = approvedRegs.map(r => r.user_id);

  const { data: cpuRegs } = await supabase
    .from('interclub_registrations')
    .select('user_id')
    .eq('season_id', seasonId)
    .eq('status', 'approved')
    .eq('is_cpu', true);
  const cpuTeams = cpuRegs?.map(r => r.user_id) ?? [];

  if (realTeams.length + cpuTeams.length < 5) {
    throw new Error('Not enough teams to form a group');
  }

  const shuffled = realTeams.sort(() => Math.random() - 0.5);
  const groups: string[][] = [];

  while (shuffled.length > 0) {
    const groupSize = Math.min(maxPerGroup, shuffled.length);
    groups.push(shuffled.splice(0, groupSize));
  }

  for (const group of groups) {
    while (group.length < 5) {
      if (cpuTeams.length === 0) {
        throw new Error('Not enough CPU teams to reach minimum group size');
      }
      group.push(cpuTeams.shift()!);
    }
  }

  const { data: createdGroups } = await supabase
    .from('interclub_groups')
    .insert(groups.map(() => ({ season_id: seasonId })))
    .select('id, group_number');
  if (!createdGroups) throw new Error('Failed to create groups');

  for (let i = 0; i < groups.length; i++) {
    await supabase
      .from('interclub_registrations')
      .update({ group_assignment: createdGroups[i].group_number })
      .eq('season_id', seasonId)
      .in('user_id', groups[i]);
  }

  return { groups, createdGroups };
}

const fetchCpuTeamsAndCpuClubName = async () => {
  try {
    setLoading(true);
    
    // Fetch CPU teams
    const { data: teamsData, error: teamsError } = await supabase
      .from('cpu_teams')
      .select('*');
    
    if (teamsError) throw teamsError;
    setCpuTeams(teamsData || []);

     // Fetch CPU club name
    const { data: clubData, error: clubError } = await supabase
      .from('club_managers')
      .select('name')
      .eq('user_id', '00000000-0000-0000-0000-000000000000')

    if(clubError) throw clubError;
    setCpuClubName(clubData.name)
    
    if (teamsError) throw teamsError;
    setCpuTeams(teamsData || []);

  } catch (error) {
    console.error('Error fetching CPU data:', error);
  } finally {
    setLoading(false);
  }
};

const handleCpuRegistrationSubmit = async () => {
  if (!cpuRegistrationForm.season_id || !cpuRegistrationForm.team_name) {
    setRegistrationError('Please select a season and team');
    return;
  }

  try {
    setLoading(true);
    
    // Get CPU players for the selected team
    const teamName = cpuRegistrationForm.team_name;
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .ilike('name', `${teamName}%`)
      .eq('user_id', '00000000-0000-0000-0000-000000000000');
    
    if (playersError) throw playersError;

    // Prepare registration data
    const registrationData = {
      season_id: cpuRegistrationForm.season_id,
      team_name: teamName,
      club_name: cpuRegistrationForm.club_name,
      captain_name: cpuRegistrationForm.captain_name,
      captain_email: cpuRegistrationForm.captain_email,
      players: playersData || [],
      status: 'pending',
      is_cpu: true
    };

    // Insert registration
    const { error } = await supabase
      .from('interclub_registrations')
      .insert(registrationData);
    
    if (error) throw error;

    // Close popup and reset form
    setShowCpuRegistrationPopup(false);
    setCpuRegistrationForm({
      season_id: '',
      team_name: '',
      club_name: '',
      captain_name: '',
      captain_email: '',
      players: [],
    });

  } catch (error) {
    console.error('CPU registration error:', error);
    setRegistrationError('Failed to register CPU team');
  } finally {
    setLoading(false);
  }
};

async function generateInterclubSchedule(seasonId: string) {
  const { data: season, error: seasonErr } = await supabase
    .from('interclub_seasons')
    .select('start_date')
    .eq('id', seasonId)
    .single();
  if (seasonErr || !season) throw seasonErr || new Error('Season not found');
  const seasonStart = new Date(season.start_date);

  const { data: groups, error: grpErr } = await supabase
    .from('interclub_groups')
    .select('group_number')
    .eq('season_id', seasonId);
  if (grpErr) throw grpErr;
  if (!groups || groups.length === 0) {
    throw new Error('No groups found—run createInterclubGroups first');
  }

  const weekSchedule: { group: number; week: number; date: string }[] = [];
  const service = new InterclubService(supabase);

  for (const { group_number } of groups) {
    const { data: regs, error: regErr } = await supabase
      .from('interclub_registrations')
      .select('user_id')
      .eq('season_id', seasonId)
      .eq('group_assignment', group_number);
    if (regErr) throw regErr;
    const teamIds = regs!.map(r => r.user_id);

    const computeMatchDate = (week: number) =>
      new Date(seasonStart.getTime() + (week - 1) * 7 * 86400_000).toISOString();

    const result = await service.generateAndPersistMatchSchedule(
      seasonId,
      teamIds,
      group_number
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to persist match schedule');
    }

    // double round robin → (n−1)*2 weeks
    const totalWeeks = (teamIds.length - 1) * 2;
    for (let w = 1; w <= totalWeeks; w++) {
      weekSchedule.push({
        group: group_number,
        week: w,
        date: computeMatchDate(w),
      });
    }
  }

  // 2.4) Persist the aggregate week_schedule JSON on the season
  const { error: updErr } = await supabase
    .from('interclub_seasons')
    .update({
      week_schedule: JSON.stringify(weekSchedule),
      updated_at: new Date().toISOString(),
    })
    .eq('id', seasonId);
  if (updErr) throw updErr;

  logActivity('interclub_schedule_generated', 'season', seasonId);
  await loadSeasons();
}

  const handleResourceChange = (section: 'entry_fee' | 'prize_pool', position: string | null, resource: keyof { coins: number; shuttlecocks: number; meals: number; diamonds: number }, value: number) => {
    setSeasonForm(prev => ({
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

  const addCpuTeam = async (seasonId: string, groupNumber: number) => {
    try {
      setLoading(true);
      
      // Generate a CPU team for the group
      const cpuTeamName = `CPU Team ${Math.floor(Math.random() * 1000)}`;
      
      const { data, error } = await supabase
        .from('interclub_registrations')
        .insert({
          season_id: seasonId,
          user_id: '00000000-0000-0000-0000-000000000000',
          team_name: cpuTeamName,
          players: JSON.stringify([]),
          status: 'approved',
          group_assignment: groupNumber
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating CPU team:', error);
        return;
      }
      
      logActivity('cpu_team_added_interclub', 'season', seasonId, { cpuTeamName, groupNumber });
      await loadSeasons();
      await loadPendingRegistrations();
    } catch (error) {
      console.error('Error adding CPU team:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSeasonConfirm = async (seasonId: string) => {
    if (!confirm('Are you sure you want to delete this season? This action is irreversible.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('interclub_seasons')
        .delete()
        .eq('id', seasonId);
      
      if (error) {
        console.error('Error deleting season:', error);
        return;
      }
      
      logActivity('interclub_season_deleted', 'season', seasonId);
      await loadSeasons();
    } catch (error) {
      console.error('Error deleting season:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSeasonStatus = async (seasonId: string, newStatus: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('interclub_seasons')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', seasonId);
      
      if (error) {
        console.error('Error updating season status:', error);
        return;
      }
      
      logActivity('interclub_season_status_updated', 'season', seasonId, { newStatus });
      await loadSeasons();
    } catch (error) {
      console.error('Error updating season status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierInfo = (tier: string) => {
    const tierNames = {
      departmental: 'Departmental',
      regional: 'Regional',
      national: 'National',
      top12: 'TOP 12'
    };
    return tierNames[tier as keyof typeof tierNames] || tier;
  };

  const getTierIcon = (tier: string) => {
    if (tier === 'departmental') return <Trophy className="w-4 h-4 text-yellow-600" />;
    if (tier === 'regional') return <Trophy className="w-4 h-4 text-gray-500" />;
    if (tier === 'national') return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (tier === 'top12') return <Crown className="w-4 h-4 text-purple-500" />;
    return <Trophy className="w-4 h-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      registration_open: 'bg-green-100 text-green-800',
      registration_closed: 'bg-yellow-100 text-yellow-800',
      active: 'bg-blue-100 text-blue-800',
      completed: 'bg-purple-100 text-purple-800',
      pending: 'bg-orange-100 text-orange-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US');
  };

  if (loading && seasons.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Trophy className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Interclub Administration</h1>
        </div>
        {activeTab === 'clubs' ? (
          <button
            onClick={() => setShowCpuClubForm(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create CPU Club</span>
          </button>
        ) : activeTab === 'registrations' ? (
          <button
            onClick={() => {
            fetchCpuTeamsAndCpuClubName();
            setShowCpuRegistrationPopup(true);
          }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Registration</span>
          </button>
        ) : (
          <button
            onClick={handleCreateSeason}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Season</span>
          </button>
        )}
      </div>

      {/* Enhanced Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'seasons', label: 'Seasons', icon: Calendar },
              { id: 'registrations', label: 'Registrations', icon: Users },
              { id: 'groups', label: 'Groups', icon: Target },
              { id: 'matches', label: 'Matches', icon: Play },
              { id: 'stats', label: 'Statistics', icon: BarChart3 },
              { id: 'clubs', label: 'Clubs', icon: Users },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Enhanced Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                                    placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All statuses</option>
                {activeTab === 'seasons' ? (
                  <>
                    <option value="draft">Draft</option>
                    <option value="registration_open">Registration Open</option>
                    <option value="registration_closed">Registration Closed</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </>
                ) : (
                  <>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </>
                )}
              </select>
            </div>
          </div>
          
          <button
            onClick={() => { loadSeasons(); loadPendingRegistrations(); loadGroups(); loadMatches(); }}
            disabled={loading}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Enhanced Seasons Table */}
      {activeTab === 'seasons' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Season</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teams</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {seasons.filter(season => {
                  const matchesSearch = season.name.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesFilter = filterStatus === 'all' || season.status === filterStatus;
                  return matchesSearch && matchesFilter;
                }).map((season) => (
                  <tr key={season.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{season.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getTierIcon(season.tier)}
                        <span className="text-sm">{getTierInfo(season.tier)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{formatDate(season.start_date)} - {formatDate(season.end_date)}</div>
                      <div className="text-xs text-gray-500">Deadline: {formatDate(season.registration_deadline)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(season.status)}`}>
                        {season.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {registrations.filter(r => r.season_id === season.id && r.status === 'approved').length} / {season.max_teams_per_group * 4}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                                                <button 
                          onClick={() => {
                            setEditingSeason(season);
                            setSeasonForm({
                              name: season.name,
                              tier: season.tier,
                              start_date: season.start_date,
                              end_date: season.end_date,
                              registration_deadline: season.registration_deadline,
                              max_teams_per_group: season.max_teams_per_group,
                              status: season.status,
                              entry_fee: season.entry_fee || { coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0},
                              prize_pool: season.prize_pool || { first: {coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0}, second: {coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0}, third: {coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0} }
                            });
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        {season.status === 'registration_closed' && (
                          <button
                            onClick={() => generateInterclubSchedule(season.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Generate schedule"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        
                        {season.status === 'draft' && (
                          <button
                            onClick={() => updateSeasonStatus(season.id, 'registration_open')}
                            className="text-purple-600 hover:text-purple-900"
                                                         title="Open registrations"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
                        
                        {season.status === 'registration_open' && (
                          <button
                            onClick={() => updateSeasonStatus(season.id, 'registration_closed')}
                            className="text-orange-600 hover:text-orange-900"
                                                         title="Close registrations"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button 
                          onClick={() => setSelectedSeason(season)}
                          className="text-gray-600 hover:text-gray-900"
                                                     title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        <button 
                          onClick={() => deleteSeasonConfirm(season.id)}
                          className="text-red-600 hover:text-red-900"
                                                     title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enhanced Registrations Table */}
      {activeTab === 'registrations' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Season</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {registrations.filter(registration => {
                  const matchesSearch = registration.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                       registration.season?.name?.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesFilter = filterStatus === 'all' || registration.status === filterStatus;
                  return matchesSearch && matchesFilter;
                }).map((registration) => (
                  <tr key={registration.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{registration.team_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {registration.season?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {registration.players.length} players
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(registration.status)}`}>
                        {registration.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(registration.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {registration.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleRegistrationAction(registration.id, 'approved')}
                            className="text-green-600 hover:text-green-900"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRegistrationAction(registration.id, 'rejected')}
                            className="text-red-600 hover:text-red-900"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => alert(`Team: ${registration.team_name}\nPlayers: ${registration.players.map(p => p.name).join(', ')}\nStatus: ${registration.status}\nRegistered: ${formatDate(registration.created_at)}`)}
                        className="text-gray-600 hover:text-gray-900"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enhanced Season Creation Modal */}
      {showSeasonForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-5">
          <div className="bg-white rounded-lg p-6 w-full max-w-[50vw] max-h-[90vh] overflow-y-auto">
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
                      value={seasonForm.entry_fee.coins}
                      onChange={(e) => handleResourceChange('entry_fee', null, 'coins', parseInt(e.target.value) || 0)}
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
                      value={seasonForm.entry_fee.shuttlecocks}
                      onChange={(e) => handleResourceChange('entry_fee', null, 'shuttlecocks', parseInt(e.target.value) || 0)}
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
                      value={seasonForm.entry_fee.meals}
                      onChange={(e) => handleResourceChange('entry_fee', null, 'meals', parseInt(e.target.value) || 0)}
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
                      value={seasonForm.entry_fee.diamonds}
                      onChange={(e) => handleResourceChange('entry_fee', null, 'diamonds', parseInt(e.target.value) || 0)}
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
                        value={seasonForm.prize_pool.first.coins}
                        onChange={(e) => handleResourceChange('prize_pool', 'first', 'coins', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Coins"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.first.shuttlecocks}
                        onChange={(e) => handleResourceChange('prize_pool', 'first', 'shuttlecocks', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Shuttlecocks"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.first.meals}
                        onChange={(e) => handleResourceChange('prize_pool', 'first', 'meals', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Meals"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.first.diamonds}
                        onChange={(e) => handleResourceChange('prize_pool', 'first', 'diamonds', parseInt(e.target.value) || 0)}
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
                        value={seasonForm.prize_pool.second.coins}
                        onChange={(e) => handleResourceChange('prize_pool', 'second', 'coins', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Coins"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.second.shuttlecocks}
                        onChange={(e) => handleResourceChange('prize_pool', 'second', 'shuttlecocks', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Shuttlecocks"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.second.meals}
                        onChange={(e) => handleResourceChange('prize_pool', 'second', 'meals', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Meals"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.second.diamonds}
                        onChange={(e) => handleResourceChange('prize_pool', 'second', 'diamonds', parseInt(e.target.value) || 0)}
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
                        value={seasonForm.prize_pool.third.coins}
                        onChange={(e) => handleResourceChange('prize_pool', 'third', 'coins', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Coins"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.third.shuttlecocks}
                        onChange={(e) => handleResourceChange('prize_pool', 'third', 'shuttlecocks', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Shuttlecocks"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.third.meals}
                        onChange={(e) => handleResourceChange('prize_pool', 'third', 'meals', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Meals"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.third.diamonds}
                        onChange={(e) => handleResourceChange('prize_pool', 'third', 'diamonds', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Diamonds"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
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

      {/* Groups Management */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Group Management</h3>
              <button
                onClick={() => setShowGroupForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Groups</span>
              </button>
            </div>
            
            {seasons.map((season) => (
              <div key={season.id} className="border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getTierIcon(season.tier)}
                    <h4 className="font-medium">{season.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(season.status)}`}>
                      {season.status}
                    </span>
                  </div>
                                     <div className="text-sm text-gray-500">
                     {registrations.filter(r => r.season_id === season.id && r.status === 'approved').length} approved teams
                   </div>
                </div>
                
                {season.groups && season.groups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {season.groups.map((group, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 relative">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-medium">Groupe {index + 1}</h5>
                        </div>
                        <div className="space-y-1">
                          {group.teams?.map((team, teamIndex) => (
                            <div key={`${team.id}-${teamIndex}`} className="text-sm text-gray-600 flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              {team.team_name || `Team ${teamIndex + 1}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ): (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                         <p>No groups created for this season</p>
                     {season.status === 'registration_closed' && (
                       <button
                         onClick={() => createInterclubGroups(season.id)}
                         className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                       >
                         Generate Groups
                       </button>
                     )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matches Management */}
      {activeTab === 'matches' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Match Management</h3>
            <p className="text-sm text-gray-600 mt-1">Track interclub encounters</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Season</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Encounter</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Play className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                             <p>No matches scheduled</p>
                       <p className="text-sm">Matches will appear after group generation</p>
                    </td>
                  </tr>
                ) : (
                  matches.map((match) => (
                    <tr key={match.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {seasons.find(s => s.id === match.season_id)?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        Groupe {match.group_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        J{match.matchday_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(match.match_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(match.status)}`}>
                          {match.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {match.home_score !== undefined && match.away_score !== undefined 
                          ? `${match.home_score}-${match.away_score}` 
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          <Eye className="w-4 h-4" />
                        </button>
                        {match.status === 'scheduled' && (
                          <button className="text-green-600 hover:text-green-900">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statistics Dashboard */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active seasons</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {seasons.filter(s => s.status === 'active').length}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-full p-3">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending registrations</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {registrations.filter(r => r.status === 'pending').length}
                  </p>
                </div>
                <div className="bg-yellow-50 rounded-full p-3">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Registered teams</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {registrations.filter(r => r.status === 'approved').length}
                  </p>
                </div>
                <div className="bg-green-50 rounded-full p-3">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Matches played</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {matches.filter(m => m.status === 'completed').length}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-full p-3">
                  <Trophy className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Distribution by tier</h3>
              <div className="space-y-3">
                {Object.entries(
                  seasons.reduce((acc: Record<string, number>, season) => {
                    acc[season.tier] = (acc[season.tier] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getTierIcon(tier)}
                      <span className="text-sm font-medium">{getTierInfo(tier)}</span>
                    </div>
                    <span className="text-sm text-gray-600">{count} seasons</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Recent activity</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 rounded-full p-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Approved registrations</p>
                    <p className="text-xs text-gray-500">
                      {registrations.filter(r => r.status === 'approved').length} teams
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 rounded-full p-2">
                    <Play className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Matches in progress</p>
                    <p className="text-xs text-gray-500">
                      {matches.filter(m => m.status === 'in_progress').length} encounters
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 rounded-full p-2">
                    <Trophy className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Completed matches</p>
                    <p className="text-xs text-gray-500">
                      {matches.filter(m => m.status === 'completed').length} encounters
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCpuClubForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Create CPU Club</h2>
              <button
                onClick={() => setShowCpuClubForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Manager Name (Optional)</label>
                <input
                  type="text"
                  value={cpuClubForm.name}
                  onChange={(e) => setCpuClubForm({...cpuClubForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="CPU Manager"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Club Name (Optional)</label>
                <input
                  type="text"
                  value={cpuClubForm.club_name}
                  onChange={(e) => setCpuClubForm({...cpuClubForm, club_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Will generate if empty"
                />
              </div>
              
              <div className="pt-2">
                <h3 className="text-sm font-medium mb-3">Initial Resources</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 flex items-center">
                      <Diamond className="w-4 h-4 mr-1 text-purple-500" />
                      Diamonds
                    </label>
                    <input
                      type="number"
                      value={cpuClubForm.resources.diamonds}
                      onChange={(e) => setCpuClubForm({
                        ...cpuClubForm,
                        resources: {
                          ...cpuClubForm.resources,
                          diamonds: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1 flex items-center">
                      <UtensilsCrossed className="w-4 h-4 mr-1 text-green-500" />
                      Meals
                    </label>
                    <input
                      type="number"
                      value={cpuClubForm.resources.meals}
                      onChange={(e) => setCpuClubForm({
                        ...cpuClubForm,
                        resources: {
                          ...cpuClubForm.resources,
                          meals: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1 flex items-center">
                      <Feather className="w-4 h-4 mr-1 text-blue-500" />
                      Shuttlecocks
                    </label>
                    <input
                      type="number"
                      value={cpuClubForm.resources.shuttlecocks}
                      onChange={(e) => setCpuClubForm({
                        ...cpuClubForm,
                        resources: {
                          ...cpuClubForm.resources,
                          shuttlecocks: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1 flex items-center">
                      <Coins className="w-4 h-4 mr-1 text-yellow-500" />
                      Coins
                    </label>
                    <input
                      type="number"
                      value={cpuClubForm.resources.coins}
                      onChange={(e) => setCpuClubForm({
                        ...cpuClubForm,
                        resources: {
                          ...cpuClubForm.resources,
                          coins: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCpuClubForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCpuClub}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Club'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'clubs' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Id</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Diamond className="w-4 h-4 inline mr-1 text-purple-500" />
                    Diamonds
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <UtensilsCrossed className="w-4 h-4 inline mr-1 text-green-500" />
                    Meals
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Feather className="w-4 h-4 inline mr-1 text-blue-500" />
                    Shuttlecocks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Coins className="w-4 h-4 inline mr-1 text-yellow-500" />
                    Coins
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clubs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No clubs found</p>
                    </td>
                  </tr>
                ) : (
                  clubs.map((club) => (
                    <tr key={club.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{club.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{club.user_id}</div>
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{club.club_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {club.resources.diamonds}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {club.resources.meals}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {club.resources.shuttlecocks}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {club.resources.coins}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingClub(club);
                            setResourceForm(club.resources);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Club Resources Modal */}
      {editingClub && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit Club Resources</h2>
              <button
                onClick={() => setEditingClub(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">{editingClub.name}</h3>
              <p className="text-sm text-gray-600">Manager ID: {editingClub.user_id}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center">
                  <Diamond className="w-4 h-4 mr-2 text-purple-500" />
                  Diamonds
                </label>
                <input
                  type="number"
                  value={resourceForm.diamonds}
                  onChange={(e) => setResourceForm({...resourceForm, diamonds: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center">
                  <UtensilsCrossed className="w-4 h-4 mr-2 text-green-500" />
                  Meals
                </label>
                <input
                  type="number"
                  value={resourceForm.meals}
                  onChange={(e) => setResourceForm({...resourceForm, meals: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center">
                  <Feather className="w-4 h-4 mr-2 text-blue-500" />
                  Shuttlecocks
                </label>
                <input
                  type="number"
                  value={resourceForm.shuttlecocks}
                  onChange={(e) => setResourceForm({...resourceForm, shuttlecocks: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center">
                  <Coins className="w-4 h-4 mr-2 text-yellow-500" />
                  Coins
                </label>
                <input
                  type="number"
                  value={resourceForm.coins}
                  onChange={(e) => setResourceForm({...resourceForm, coins: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingClub(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={updateClubResources}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Season Modal */}
      {editingSeason && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-[50vw] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit Season</h2>
              <button
                onClick={() => setEditingSeason(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const { error } = await supabase
                  .from('interclub_seasons')
                  .update({
                    name: seasonForm.name,
                    tier: seasonForm.tier,
                    start_date: seasonForm.start_date,
                    end_date: seasonForm.end_date,
                    registration_deadline: seasonForm.registration_deadline,
                    status: seasonForm.status,
                    max_teams_per_group: seasonForm.max_teams_per_group,
                    entry_fee: seasonForm.entry_fee,
                    prize_pool: seasonForm.prize_pool,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', editingSeason.id);
                
                if (error) throw error;
                
                logActivity('interclub_season_updated', 'season', editingSeason.id);
                await loadSeasons();
                setEditingSeason(null);
                setSeasonForm({
                  name: '',
                  tier: 'departmental',
                  start_date: '',
                  end_date: '',
                  registration_deadline: '',
                  max_teams_per_group: 8,
                  status: 'draft',
                  entry_fee: { coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0},
                  prize_pool: {
                    first: { coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0},
                    second: { coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0},
                    third: { coins: 0, shuttlecocks: 0, meals: 0, diamonds: 0}
                  }
                });
              } catch (error) {
                console.error('Error updating season:', error);
              } finally {
                setLoading(false);
              }
            }} className="space-y-4">
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
                  value={new Date(seasonForm.start_date).toISOString().slice(0, 16)}
                  onChange={(e) => setSeasonForm({...seasonForm, start_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">End date</label>
                <input
                  type="datetime-local"
                  value={new Date(seasonForm.end_date).toISOString().slice(0, 16)}
                  onChange={(e) => setSeasonForm({...seasonForm, end_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Registration deadline</label>
                <input
                  type="datetime-local"
                  value={new Date(seasonForm.registration_deadline).toISOString().slice(0, 16)}
                  onChange={(e) => setSeasonForm({...seasonForm, registration_deadline: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Max teams per group</label>
                <input
                  type="number"
                  min="4"
                  max="12"
                  value={seasonForm.max_teams_per_group}
                  onChange={(e) => setSeasonForm({...seasonForm, max_teams_per_group: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={seasonForm.status}
                  onChange={(e) => setSeasonForm({...seasonForm, status: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="registration_open">Registration Open</option>
                  <option value="registration_closed">Registration Closed</option>
                  <option value="active">Active</option>
                </select>
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
                      value={seasonForm.entry_fee.coins}
                      onChange={(e) => handleResourceChange('entry_fee', null, 'coins', parseInt(e.target.value) || 0)}
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
                      value={seasonForm.entry_fee.shuttlecocks}
                      onChange={(e) => handleResourceChange('entry_fee', null, 'shuttlecocks', parseInt(e.target.value) || 0)}
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
                      value={seasonForm.entry_fee.meals}
                      onChange={(e) => handleResourceChange('entry_fee', null, 'meals', parseInt(e.target.value) || 0)}
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
                      value={seasonForm.entry_fee.diamonds}
                      onChange={(e) => handleResourceChange('entry_fee', null, 'diamonds', parseInt(e.target.value) || 0)}
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
                        value={seasonForm.prize_pool.first.coins}
                        onChange={(e) => handleResourceChange('prize_pool', 'first', 'coins', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Coins"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.first.shuttlecocks}
                        onChange={(e) => handleResourceChange('prize_pool', 'first', 'shuttlecocks', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Shuttlecocks"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.first.meals}
                        onChange={(e) => handleResourceChange('prize_pool', 'first', 'meals', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Meals"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.first.diamonds}
                        onChange={(e) => handleResourceChange('prize_pool', 'first', 'diamonds', parseInt(e.target.value) || 0)}
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
                        value={seasonForm.prize_pool.second.coins}
                        onChange={(e) => handleResourceChange('prize_pool', 'second', 'coins', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Coins"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.second.shuttlecocks}
                        onChange={(e) => handleResourceChange('prize_pool', 'second', 'shuttlecocks', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Shuttlecocks"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.second.meals}
                        onChange={(e) => handleResourceChange('prize_pool', 'second', 'meals', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Meals"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.second.diamonds}
                        onChange={(e) => handleResourceChange('prize_pool', 'second', 'diamonds', parseInt(e.target.value) || 0)}
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
                        value={seasonForm.prize_pool.third.coins}
                        onChange={(e) => handleResourceChange('prize_pool', 'third', 'coins', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Coins"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.third.shuttlecocks}
                        onChange={(e) => handleResourceChange('prize_pool', 'third', 'shuttlecocks', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Shuttlecocks"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.third.meals}
                        onChange={(e) => handleResourceChange('prize_pool', 'third', 'meals', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Meals"
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={seasonForm.prize_pool.third.diamonds}
                        onChange={(e) => handleResourceChange('prize_pool', 'third', 'diamonds', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Diamonds"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Season'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSeason(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CPU Registration Popup */}
      {showCpuRegistrationPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Register CPU Team</h3>
              <button 
                onClick={() => setShowCpuRegistrationPopup(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Season</label>
                <select
                  value={cpuRegistrationForm.season_id}
                  onChange={(e) => setCpuRegistrationForm({...cpuRegistrationForm, season_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select season</option>
                  {seasons.map(season => (
                    <option key={season.id} value={season.id}>
                      {season.name} ({new Date(season.start_date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">CPU Team</label>
                <select
                  value={cpuRegistrationForm.team_name}
                  onChange={(e) => {
                    setCpuRegistrationForm({
                      ...cpuRegistrationForm,
                      team_name: e.target.value,
                      club_name: cpuClubName || ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select team</option>
                  {cpuTeams.map(team => (
                    <option key={team.id} value={team.name}>
                      {team.name} ({team.skill_level})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Club Name</label>
                <input
                  type="text"
                  value={cpuRegistrationForm.club_name}
                  onChange={(e) => setCpuRegistrationForm({...cpuRegistrationForm, club_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {registrationError && (
                <div className="text-red-500 text-sm">{registrationError}</div>
              )}

              <button
                onClick={handleCpuRegistrationSubmit}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register CPU Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Season Details Modal */}
      {selectedSeason && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                {getTierIcon(selectedSeason.tier)}
                <h2 className="text-2xl font-bold">{selectedSeason.name}</h2>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedSeason.status)}`}>
                  {selectedSeason.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedSeason(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Season Information */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Season Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tier:</span>
                      <span className="font-medium">{getTierInfo(selectedSeason.tier)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Start Date:</span>
                      <span>{formatDate(selectedSeason.start_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">End Date:</span>
                      <span>{formatDate(selectedSeason.end_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Registration Deadline:</span>
                      <span>{formatDate(selectedSeason.registration_deadline)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max Teams per Group:</span>
                      <span>{selectedSeason.max_teams_per_group}</span>
                    </div>
                  </div>
                </div>
                
                                 {/* Tier Requirements */}
                 <div className="bg-gray-50 rounded-lg p-4">
                   <h3 className="font-semibold mb-3">Tier Requirements</h3>
                   <div className="space-y-2">
                     <div className="flex justify-between">
                       <span className="text-gray-600">Coins:</span>
                       <span>{TIER_REQUIREMENTS[selectedSeason.tier].coins}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Shuttlecocks:</span>
                       <span>{TIER_REQUIREMENTS[selectedSeason.tier].shuttlecocks}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Meals:</span>
                       <span>{TIER_REQUIREMENTS[selectedSeason.tier].meals}</span>
                     </div>
                   </div>
                 </div>
              </div>
              
              {/* Registrations */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Registration Statistics</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Registrations:</span>
                      <span>{registrations.filter(r => r.season_id === selectedSeason.id).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approved:</span>
                      <span className="text-green-600 font-medium">
                        {registrations.filter(r => r.season_id === selectedSeason.id && r.status === 'approved').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pending:</span>
                      <span className="text-yellow-600 font-medium">
                        {registrations.filter(r => r.season_id === selectedSeason.id && r.status === 'pending').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rejected:</span>
                      <span className="text-red-600 font-medium">
                        {registrations.filter(r => r.season_id === selectedSeason.id && r.status === 'rejected').length}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Groups */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Groups</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Groups Created:</span>
                      <span>{groups.filter(g => g.season_id === selectedSeason.id).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Matches Scheduled:</span>
                      <span>{matches.filter(m => m.season_id === selectedSeason.id).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Matches Completed:</span>
                      <span>{matches.filter(m => m.season_id === selectedSeason.id && m.status === 'completed').length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Registered Teams */}
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Registered Teams</h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                {registrations.filter(r => r.season_id === selectedSeason.id).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No teams registered yet</p>
                ) : (
                  <div className="space-y-2">
                    {registrations.filter(r => r.season_id === selectedSeason.id).map((registration) => (
                      <div key={registration.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div>
                          <div className="font-medium">{registration.team_name}</div>
                          <div className="text-sm text-gray-600">{registration.players.length} players</div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(registration.status)}`}>
                          {registration.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedSeason(null)}
                className="bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showGroupForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Create New Group</h2>
              <button
                onClick={() => setShowGroupForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                
                // First create the group
                const { data: groupData, error: groupError } = await supabase
                  .from('interclub_groups')
                  .insert({
                    name: groupForm.name,
                    season_id: groupForm.seasonId
                  })
                  .select()
                  .single();

                if (groupError) throw groupError;

                // Update all selected teams with the new group_id
                const updates = groupForm.selectedTeams.map(async (team) => {
                  const table = team.type === 'cpu' ? 'cpu_teams' : 'interclub_teams';
                  const { error } = await supabase
                    .from(table)
                    .update({ group_id: groupData.id })
                    .eq('id', team.id);

                  if (error) throw error;
                });

                await Promise.all(updates);

                logActivity('interclub_group_created_with_teams', 'group', groupData.id);
                setShowGroupForm(false);
                await loadGroups();
              } catch (error) {
                console.error('Error creating group:', error);
              } finally {
                setLoading(false);
              }
            }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Group Name</label>
                    <input
                      type="text"
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      placeholder="Group A, Group B, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Season</label>
                    <select
                      value={groupForm.seasonId}
                      onChange={(e) => {
                        setGroupForm({...groupForm, seasonId: e.target.value});
                        loadTeamsForSeason(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a season</option>
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name} ({getTierInfo(season.tier)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Available Teams</h3>
                  <div className="border rounded-lg p-3 max-h-60 overflow-y-auto mt-[2px]">
                    {groupForm.availableTeams.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        {groupForm.seasonId ? 'No teams available' : 'Select a season first'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {groupForm.availableTeams.map((team) => (
                          <div 
                            key={`${team.type}-${team.id}`} 
                            className={`p-2 rounded cursor-pointer ${groupForm.selectedTeams.some(t => t.id === team.id && t.type === team.type) 
                              ? 'bg-blue-100' 
                              : 'hover:bg-gray-100'}`}
                            onClick={() => {
                              const isSelected = groupForm.selectedTeams.some(t => t.id === team.id && t.type === team.type);
                              setGroupForm(prev => ({
                                ...prev,
                                selectedTeams: isSelected
                                  ? prev.selectedTeams.filter(t => !(t.id === team.id && t.type === team.type))
                                  : [...prev.selectedTeams, team]
                              }));
                            }}
                          >
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={groupForm.selectedTeams.some(t => t.id === team.id && t.type === team.type)}
                                className="mr-2"
                                readOnly
                              />
                              <span>{team.name}</span>
                              <span className="ml-2 text-xs text-gray-500">
                                ({team.type === 'cpu' ? 'CPU Team' : 'Player Team'})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-sm font-medium mb-2">Selected Teams ({groupForm.selectedTeams.length})</h3>
                {groupForm.selectedTeams.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {groupForm.selectedTeams.map((team) => (
                      <span 
                        key={`selected-${team.type}-${team.id}`}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {team.name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGroupForm(prev => ({
                              ...prev,
                              selectedTeams: prev.selectedTeams.filter(t => !(t.id === team.id && t.type === team.type))
                            }));
                          }}
                          className="ml-2 text-blue-600 hover:text-blue-900"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No teams selected yet</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGroupForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !groupForm.seasonId || groupForm.selectedTeams.length === 0}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        {/* Group Management Modal */}
        {selectedGroup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Manage Group</h3>
                <button onClick={() => setSelectedGroup(null)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupEditForm.name}
                  onChange={(e) => setGroupEditForm({...groupEditForm, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Teams</label>
                <div className="max-h-60 overflow-y-auto border rounded p-2">
                  {availableTeams.map(team => (
                    <div key={team.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={groupEditForm.teams.some(t => t.id === team.id && t.type === team.type)}
                          onChange={() => handleTeamToggle(team)}
                          className="mr-2"
                        />
                        <span>{team.team_name}</span>
                        <span className="ml-2 text-xs text-gray-500">({team.type})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGroup}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default AdminInterclub; 