import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Shield, Zap, Award } from 'lucide-react';
import { Player } from '../../types/game';
import { Tournament } from '../../types/tournament';

interface PlayerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  eligiblePlayers: Player[];
  onSelectPlayers: (players: Player[]) => void;
}

const PlayerSelectionModal: React.FC<PlayerSelectionModalProps> = ({
  isOpen,
  onClose,
  tournament,
  eligiblePlayers,
  onSelectPlayers
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  if (!isOpen) return null;

  const togglePlayerSelection = (player: Player) => {
    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.id === player.id);

      const next = isSelected
        ? prev.filter(p => p.id !== player.id)
        : prev.length < 2
          ? [...prev, player]
          : prev;  // if already 2 selected, do nothing

      console.log('TOGGLE:', player.name, 'wasSelected=', isSelected, '→', next.map(p=>p.name));
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedPlayers.length > 0) {
      onSelectPlayers(selectedPlayers);
      onClose();
    }
  };

  const getPlayerStats = (player: Player) => {
    const technical = (player.stats.smash + player.stats.defense + player.stats.serve + 
                      player.stats.stick + player.stats.slice + player.stats.drop) / 6;
    const physical = (player.stats.endurance + player.stats.strength + player.stats.agility + 
                      player.stats.speed + player.stats.explosiveness + player.stats.injuryPrevention) / 6;
    return { technical: Math.round(technical), physical: Math.round(physical) };
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] min-h-screen"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Select Players for {tournament.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Tournament Requirements</h3>
            <div className="text-sm text-blue-800">
              <p>Minimum Level: {tournament.min_player_level}</p>
              <p>Tier: {tournament.tier.charAt(0).toUpperCase() + tournament.tier.slice(1)}</p>
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            <h3 className="font-semibold text-gray-900">Eligible Players ({eligiblePlayers.length})</h3>

            {eligiblePlayers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p>No eligible players found</p>
                <p className="text-sm">Players must be level {tournament.min_player_level} or higher and not injured</p>
              </div>
            ) : (
              eligiblePlayers.map((player) => {
                const stats = getPlayerStats(player);
                const isSelected = selectedPlayers.some(p => p.id === player.id);
                console.log("Selected players", selectedPlayers)
                return (
                  <div
                    key={player.id}
                    onClick={() => togglePlayerSelection(player)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isSelected ? 'bg-blue-200' : 'bg-gray-200'
                        }`}>
                          <User className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{player.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Award className="w-4 h-4 mr-1" />
                              Level {player.level}
                            </div>
                            <div className="flex items-center">
                              <Shield className="w-4 h-4 mr-1" />
                              Physical {stats.physical}
                            </div>
                            <div className="flex items-center">
                              <Zap className="w-4 h-4 mr-1" />
                              Technical {stats.technical}
                            </div>
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <h5 className="font-medium text-blue-800 mb-2">Technical Skills</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span>Smash:</span><span>{player.stats.smash}</span></div>
                              <div className="flex justify-between"><span>Defense:</span><span>{player.stats.defense}</span></div>
                              <div className="flex justify-between"><span>Serve:</span><span>{player.stats.serve}</span></div>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-medium text-blue-800 mb-2">Physical Stats</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span>Endurance:</span><span>{player.stats.endurance}</span></div>
                              <div className="flex justify-between"><span>Strength:</span><span>{player.stats.strength}</span></div>
                              <div className="flex justify-between"><span>Agility:</span><span>{player.stats.agility}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedPlayers.length === 0}
              className={`px-6 py-2 rounded-lg transition-colors ${
                selectedPlayers.length > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Register {selectedPlayers.length === 1 ? 'Player' : 'Players'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PlayerSelectionModal;