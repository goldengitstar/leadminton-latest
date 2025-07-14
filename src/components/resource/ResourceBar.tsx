import { Feather, UtensilsCrossed, Coins, Diamond, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function ResourceBar() {
  const { resources } = useGame();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const getUserDisplayName = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    if (user?.user_metadata?.manager_name) {
      return user.user_metadata.manager_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white shadow-md p-4 z-50">
      <div className="flex items-center justify-between mx-auto">
        {/* Left spacer for balance */}
        <div className="w-48 hidden lg:block"></div>
        
        {/* Resources Section - Centered */}
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2">
            <Feather className="w-5 h-5 text-blue-500" />
            <span className="font-medium">{resources.shuttlecocks}</span>
          </div>
          <div className="flex items-center space-x-2">
            <UtensilsCrossed className="w-5 h-5 text-green-500" />
            <span className="font-medium">{resources.meals}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="font-medium">{resources.coins}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Diamond className="w-5 h-5 text-purple-500" />
            <span className="font-medium">{resources.diamonds}</span>
          </div>
        </div>

        {/* User Avatar Dropdown - Positioned on the right */}
        <div className="relative w-48 flex justify-end">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 px-3 py-2 rounded-full hover:bg-gray-100 transition-all duration-200"
        >
          {/* User Avatar */}
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {getUserDisplayName().charAt(0).toUpperCase()}
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            dropdownOpen ? 'rotate-180' : ''
          }`} />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div 
            className="absolute top-10 right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <div className="py-2">
              {/* User Info */}
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {getUserDisplayName().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                {/* Admin Panel Button - Only show if user is admin */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      navigate('/admin');
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-3" />
                    Admin Panel
                  </button>
                )}

                {/* Logout Button */}
                <button
                  onClick={() => {
                    handleLogout();
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}