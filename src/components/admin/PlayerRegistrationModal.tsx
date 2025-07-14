import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Player } from '../../types/game';
import { Tournament } from '../../types/tournament';
import { X, Search, Users, Trophy } from 'lucide-react';
import { toast } from 'sonner';

interface PlayerRegistrationModalProps {
  tournament: Tournament;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PlayerRegistrationModal: React.FC<PlayerRegistrationModalProps> = ({
  tournament,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'real' | 'cpu'>('real');

  useEffect(() => {
    if (isOpen) {
      loadPlayers();
    }
  }, [isOpen, selectedTab]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_cpu', selectedTab === 'cpu')
        .order('name');

      if (error) {
        console.error('Error loading players:', error);
        return;
      }

      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPlayer = async (player: Player) => {
    try {
      setRegistering(player.id);

      const { data, error } = await supabase.rpc('admin_register_player_for_tournament', {
        p_tournament_id: tournament.id,
        p_player_id: player.id,
        p_force_registration: false
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('Player registered successfully:', data);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error registering player:', error);
      toast.error(`Failed to register player: ${error.message}`);
    } finally {
      setRegistering(null);
    }
  };

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isPlayerRegistered = (playerId: string) => {
    return tournament.registered_players?.some((rp: any) => rp.playerId === playerId) || false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Register Players</h2>
            <p className="text-sm text-gray-600">
              Add players to <span className="font-medium">{tournament.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tournament Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Trophy className="w-5 h-5 text-blue-600 mr-2" />
              <span className="font-medium text-blue-900">{tournament.name}</span>
            </div>
            <div className="flex items-center text-sm text-blue-700">
              <Users className="w-4 h-4 mr-1" />
              {tournament.current_participants}/{tournament.max_participants} participants
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setSelectedTab('real')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              selectedTab === 'real'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Real Players
          </button>
          <button
            onClick={() => setSelectedTab('cpu')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              selectedTab === 'cpu'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            CPU Players
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={`Search ${selectedTab === 'real' ? 'real' : 'CPU'} players...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Players List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>No {selectedTab === 'real' ? 'real' : 'CPU'} players found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPlayers.map((player) => (
                <div
                  key={player.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{player.name}</h3>
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <span>Level {player.level}</span>
                      {selectedTab === 'real' && (
                        <span>Real Player</span>
                      )}
                    </div>
                  </div>
                  <div>
                    {isPlayerRegistered(player.id) ? (
                      <span className="text-sm text-green-600 font-medium">Registered</span>
                    ) : (
                      <button
                        onClick={() => handleRegisterPlayer(player)}
                        disabled={registering === player.id}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {registering === player.id ? 'Registering...' : 'Register'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerRegistrationModal; 