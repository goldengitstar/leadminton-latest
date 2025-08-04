import { Layout, RefreshCw } from 'lucide-react';
import { Facility } from '../types/game';
import { calculateProductionRate } from '../utils/facilityUtils';
import { useGame } from '@/contexts/GameContext';
import UserMatchCountdown from '../components/tournaments/UserMatchCountdown';
import { useState } from 'react';

export default function DashboardPage() {
  const {gameState, refreshGameState} = useGame();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getProductionInfo = (facility: Facility) => {
    if (facility.type === 'training-center') {
      return {
        current: facility.maxPlayers,
        bonus: 0,
        total: facility.maxPlayers
      };
    }

    const activeManagers = gameState.managers.filter(m => m.active);
    const baseRate = calculateProductionRate(facility, facility.level, []);
    const totalRate = calculateProductionRate(facility, facility.level, activeManagers);
    const bonus = totalRate - baseRate;
    console.log(facility.name, " production base rate : ", baseRate, "total rate : ", totalRate, "bonus : ", bonus)
    
    return {
      current: baseRate,
      bonus,
      total: totalRate
    };
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshGameState();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Layout className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            isRefreshing 
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* User Match Countdown - Show at top for visibility */}
      {/* <UserMatchCountdown /> */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">Vue d'ensemble du club</h2>
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Statistiques</h3>
            <div className="space-y-2">
              <p>Joueurs totaux: {gameState.players.length}/{gameState.facilities.find(f => f.type === 'training-center')?.maxPlayers || 1}</p>
              <p>Installations totales: {gameState.facilities.length}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">Production</h2>
          {gameState.facilities.map((facility) => {
            const production = getProductionInfo(facility);
            const manager = gameState.managers.find(m => m.facilityType === facility.type && m.active);

            return (
              <div key={facility.id} className="bg-white rounded-xl shadow-md p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{facility.name}</h3>
                  <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    Niveau {facility.level}
                  </div>
                </div>

                {facility.type === 'training-center' ? (
                  <p className="text-gray-600">
                    Capacité maximale: {facility.maxPlayers} joueurs
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Production de base:</span>
                      <span>{production.current} {facility.resourceType}/min</span>
                    </div>
                    
                    {manager && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600">Bonus ({manager.name}):</span>
                        <span className="text-green-600">+{production.bonus} {facility.resourceType}/min</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between font-medium pt-2 border-t">
                      <span>Production totale:</span>
                      <span>{production.total} {facility.resourceType}/min</span>
                    </div>

                    {facility.upgrading && (
                      <div className="mt-2 py-2 px-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                        Amélioration en cours...
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}