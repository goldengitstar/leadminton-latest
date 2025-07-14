import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';

// Admin Page Components (we'll create these next)
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminTournaments from '../pages/admin/AdminTournaments';
import AdminInterclub from '../pages/admin/AdminInterclub';
import AdminCpuTeams from '../pages/admin/AdminCpuTeams';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminLogs from '../pages/admin/AdminLogs';

const AdminLayout: React.FC = () => {
  const { adminUser, hasPermission, isAdmin, loading } = useAdmin();
  const { user, logout, isLogin } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Show loading while checking admin status OR while user is logging in
  if (loading || !isLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {!isLogin ? 'Checking authentication...' : 'Verifying admin access...'}
          </p>
        </div>
      </div>
    );
  }

  // Only redirect if user is logged in but not admin (admin check completed)
  if (isLogin && !loading && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const navigationItems = [
    { path: '/admin', name: 'Dashboard', icon: '📊', exact: true },
    { 
      path: '/admin/tournaments', 
      name: 'Tournaments', 
      icon: '🏆', 
      permission: 'tournaments' as const 
    },
    { 
      path: '/admin/interclub', 
      name: 'Interclub', 
      icon: '🏟️', 
      permission: 'interclub' as const 
    },
    { 
      path: '/admin/cpu-teams', 
      name: 'CPU Teams & Players', 
      icon: '🤖', 
      permission: 'cpu_teams' as const 
    },
    { 
      path: '/admin/users', 
      name: 'Users', 
      icon: '👥', 
      permission: 'users' as const 
    },
    { path: '/admin/logs', name: 'Activity Logs', icon: '📝' },
  ];

  const isActivePath = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 bg-blue-600 text-white">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="mt-8">
          {navigationItems.map((item) => {
            // Check permissions for restricted items
            if (item.permission && !hasPermission(item.permission)) {
              return null;
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                  isActivePath(item.path, item.exact)
                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
                    : ''
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Admin user info */}
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Admin</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-gray-600"
              title="Logout"
            >
              🚪
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <span className="text-2xl">☰</span>
            </button>
            
            <h2 className="text-xl font-semibold text-gray-800">
              Leadminton Admin
            </h2>

            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                ← Back to Game
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 bg-gray-100">
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/tournaments" element={
              hasPermission('tournaments') ? <AdminTournaments /> : <Navigate to="/admin" replace />
            } />
            <Route path="/interclub" element={
              hasPermission('interclub') ? <AdminInterclub /> : <Navigate to="/admin" replace />
            } />
            <Route path="/cpu-teams" element={
              hasPermission('cpu_teams') ? <AdminCpuTeams /> : <Navigate to="/admin" replace />
            } />
            <Route path="/users" element={
              hasPermission('users') ? <AdminUsers /> : <Navigate to="/admin" replace />
            } />
            <Route path="/logs" element={<AdminLogs />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout; 