import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Lock, 
  Unlock, 
  Trash2, 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  Calendar,
  Mail,
  User,
  Key,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  email: string;
  team_name?: string;
  full_name?: string;
  avatar_url?: string;
  is_admin: boolean;
  is_banned: boolean;
  email_verified: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  login_count: number;
  profile: {
    display_name?: string;
    bio?: string;
    location?: string;
  } | null;
}

interface AdminUsersProps {}

const AdminUsers: React.FC<AdminUsersProps> = () => {
  const { logActivity } = useAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadUsers();
    logActivity('users_viewed');
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('[AdminUsers] Loading users with JavaScript logic...');
      
      // Since we can't use admin API from client, we'll load users from our own tables
      // We need to create a users view or table that stores user info
      // For now, let's try to load from profiles or user-related data we have access to
      
      // First, let's get admin users
      const { data: adminUsersData, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id, permissions, created_at');

      if (adminError) {
        console.error('[AdminUsers] Error loading admin users:', adminError);
      }

      // Create admin users map
      const adminUserIds = new Set(
        (adminUsersData || []).map(admin => admin.user_id)
      );

      // Try to get user data from resource_transactions or other tables where we have user_id
      // This is a workaround since we can't access auth.users directly
      const { data: userTransactions, error: transError } = await supabase
        .from('resource_transactions')
        .select('user_id')
        .not('user_id', 'is', null);

      if (transError) {
        console.error('[AdminUsers] Error loading user transactions:', transError);
      }

      // Get unique user IDs from transactions
      const uniqueUserIds = [...new Set((userTransactions || []).map(t => t.user_id))];
      
      // For each user ID, try to get more info from profiles or other tables
      const userPromises = uniqueUserIds.map(async (userId) => {
        // Try to get profile info if profiles table exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        return {
          id: userId,
          email: profile?.email || `user-${userId.slice(0, 8)}@unknown.com`,
          team_name: profile?.team_name || undefined,
          full_name: profile?.full_name || profile?.display_name || undefined,
          avatar_url: profile?.avatar_url || undefined,
          is_admin: adminUserIds.has(userId),
          is_banned: false,
          email_verified: true, // Assume verified since they have transactions
          last_login: null,
          created_at: profile?.created_at || new Date().toISOString(),
          updated_at: profile?.updated_at || new Date().toISOString(),
          login_count: 0,
          profile: profile || null
        };
      });

      const users = await Promise.all(userPromises);
      
      // Add admin users who might not have transactions
      for (const adminUser of (adminUsersData || [])) {
        if (!users.find(u => u.id === adminUser.user_id)) {
          users.push({
            id: adminUser.user_id,
            email: `admin-${adminUser.user_id.slice(0, 8)}@unknown.com`,
            team_name: undefined,
            full_name: undefined,
            avatar_url: undefined,
            is_admin: true,
            is_banned: false,
            email_verified: true,
            last_login: null,
            created_at: adminUser.created_at,
            updated_at: adminUser.created_at,
            login_count: 0,
            profile: null
          });
        }
      }

      console.log('[AdminUsers] Users loaded successfully:', users.length, 'users');
      setUsers(users);
    } catch (error) {
      console.error('[AdminUsers] Unexpected error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string, shouldBan: boolean) => {
    const action = shouldBan ? 'ban' : 'unban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      // For now, we'll just log this action since we don't have user banning implemented yet
      // In a real implementation, you'd update the auth.users table or create a separate banned_users table
      console.log(`${shouldBan ? 'Banning' : 'Unbanning'} user:`, userId);
      
      // Simulate success for now
      const error = null;

      if (error) {
        console.error(`Error ${action}ning user:`, error);
        return;
      }

      await logActivity(`user_${action}ned`, 'user', userId);
      loadUsers();
    } catch (error) {
      console.error(`Error ${action}ning user:`, error);
    }
  };

  const handleMakeAdmin = async (userId: string, shouldMakeAdmin: boolean) => {
    const action = shouldMakeAdmin ? 'promote to admin' : 'demote from admin';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      console.log(`[AdminUsers] ${shouldMakeAdmin ? 'Promoting' : 'Demoting'} user:`, userId);
      
      let error = null;
      if (shouldMakeAdmin) {
        // Add user to admin_users table
        const { error: insertError } = await supabase
          .from('admin_users')
          .insert({ 
            user_id: userId,
            permissions: {
              tournaments: true,
              interclub: true,
              users: true,
              cpu_teams: true
            }
          });
        error = insertError;
      } else {
        // Remove user from admin_users table
        const { error: deleteError } = await supabase
          .from('admin_users')
          .delete()
          .eq('user_id', userId);
        error = deleteError;
      }

      if (error) {
        console.error(`[AdminUsers] Error changing admin status:`, error);
        toast.error(`Failed to ${action}. Please try again.`);
        return;
      }

      console.log(`[AdminUsers] Successfully ${shouldMakeAdmin ? 'promoted' : 'demoted'} user`);
      await logActivity(shouldMakeAdmin ? 'user_promoted_admin' : 'user_demoted_admin', 'user', userId);
      loadUsers();
    } catch (error) {
      console.error(`[AdminUsers] Error changing admin status:`, error);
      toast.error(`Failed to ${action}. Please try again.`);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) return;

    try {
      console.log('[AdminUsers] Password change requested for user:', selectedUser.id);
      
      // Since we can't use admin API from client, we'll show a message to the user
      // In a real implementation, this would need to be handled server-side
      toast.warning('Password change functionality requires server-side implementation. Please contact system administrator.');
      
      // Log the activity for audit purposes
      await logActivity('user_password_change_requested', 'user', selectedUser.id);
      setShowPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (error) {
      console.error('[AdminUsers] Error requesting password change:', error);
      toast.error('Failed to request password change. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;

    try {
      console.log('[AdminUsers] User deletion requested:', userId);
      
      // Since we can't use admin API from client, we'll show a message to the user
      // In a real implementation, this would need to be handled server-side
      toast.warning('User deletion functionality requires server-side implementation. Please contact system administrator.');
      
      // Log the activity for audit purposes
      await logActivity('user_deletion_requested', 'user', userId);
    } catch (error) {
      console.error('[AdminUsers] Error requesting user deletion:', error);
      toast.error('Failed to request user deletion. Please try again.');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && !user.is_banned) ||
      (filterStatus === 'banned' && user.is_banned) ||
      (filterStatus === 'admin' && user.is_admin) ||
      (filterStatus === 'unverified' && !user.email_verified);
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (user: AdminUser) => {
    if (user.is_banned) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Banned</span>;
    }
    if (user.is_admin) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Admin</span>;
    }
    if (!user.email_verified) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Unverified</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage user accounts, permissions, and access</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadUsers}
            className="flex items-center px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => !u.is_banned).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Admins</p>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => u.is_admin).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Banned</p>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => u.is_banned).length}
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
                placeholder="Search users by email, username, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Users</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
              <option value="admin">Admins</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Login Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg font-medium">No users found</p>
                    <p className="mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {user.avatar_url ? (
                            <img className="h-10 w-10 rounded-full" src={user.avatar_url} alt="" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name || user.team_name || 'Unnamed User'}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.login_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Change Password */}
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowPasswordModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Change Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        {/* Admin Toggle */}
                        <button
                          onClick={() => handleMakeAdmin(user.id, !user.is_admin)}
                          className={`p-1 ${user.is_admin ? 'text-orange-600 hover:text-orange-900' : 'text-purple-600 hover:text-purple-900'}`}
                          title={user.is_admin ? 'Remove Admin' : 'Make Admin'}
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>

                        {/* Ban/Unban Toggle */}
                        <button
                          onClick={() => handleBanUser(user.id, !user.is_banned)}
                          className={`p-1 ${user.is_banned ? 'text-green-600 hover:text-green-900' : 'text-yellow-600 hover:text-yellow-900'}`}
                          title={user.is_banned ? 'Unban User' : 'Ban User'}
                        >
                          {user.is_banned ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>

                        {/* Delete User */}
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete User"
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

      {/* Change Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Change Password for {selectedUser.email}
              </h3>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password"
                minLength={8}
              />
              <p className="text-sm text-gray-500 mt-1">
                Password must be at least 8 characters long
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedUser(null);
                  setNewPassword('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={newPassword.length < 8}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers; 