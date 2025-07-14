import React from 'react';
import { Trophy, Crown, Users, Coins, Feather, UtensilsCrossed } from 'lucide-react';
import { InterclubSeason, InterclubTier, TIER_REQUIREMENTS } from '../../types/interclub';

interface InterclubSeasonCardProps {
  season: InterclubSeason;
  tier: InterclubTier;
  tierInfo: {
    name: string;
    description: string;
    requirements: any;
    unlocked: boolean;
  };
  canRegister: boolean;
  playersCount: number;
  resources: {
    coins: number;
    shuttlecocks: number;
    meals: number;
  };
  onClick: () => void;
}

const InterclubSeasonCard: React.FC<InterclubSeasonCardProps> = ({
  season,
  tier,
  tierInfo,
  canRegister,
  playersCount,
  resources,
  onClick
}) => {
  return (
    <div
      className={`border rounded-lg p-6 transition-all ${
        canRegister
          ? 'border-blue-200 hover:border-blue-400 hover:shadow-md cursor-pointer'
          : 'border-gray-200 opacity-75'
      }`}
      onClick={() => canRegister && onClick()}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">{season.name}</h3>
        <div className="flex items-center space-x-1">
          {tier === 'departmental' && <Trophy className="w-4 h-4 text-yellow-600" />}
          {tier === 'regional' && <Trophy className="w-4 h-4 text-gray-500" />}
          {tier === 'national' && <Trophy className="w-4 h-4 text-yellow-500" />}
          {tier === 'top12' && <Crown className="w-4 h-4 text-purple-500" />}
          <span className="text-sm font-medium">{tierInfo.name}</span>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4">{tierInfo.description}</p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span>Début:</span>
          <span>{new Date(season.start_date).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Limite d'inscription:</span>
          <span>{new Date(season.registration_deadline).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Requirements */}
      <div className="border-t pt-3">
        <h4 className="text-sm font-medium mb-2">Prérequis:</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`flex items-center space-x-1 ${playersCount >= 5 ? 'text-green-600' : 'text-red-600'}`}>
            <Users className="w-3 h-3" />
            <span>5 joueurs</span>
          </div>
          <div className={`flex items-center space-x-1 ${resources.coins >= tierInfo.requirements.coins ? 'text-green-600' : 'text-red-600'}`}>
            <Coins className="w-3 h-3" />
            <span>{tierInfo.requirements.coins}</span>
          </div>
          <div className={`flex items-center space-x-1 ${resources.shuttlecocks >= tierInfo.requirements.shuttlecocks ? 'text-green-600' : 'text-red-600'}`}>
            <Feather className="w-3 h-3" />
            <span>{tierInfo.requirements.shuttlecocks}</span>
          </div>
          <div className={`flex items-center space-x-1 ${resources.meals >= tierInfo.requirements.meals ? 'text-green-600' : 'text-red-600'}`}>
            <UtensilsCrossed className="w-3 h-3" />
            <span>{tierInfo.requirements.meals}</span>
          </div>
        </div>
      </div>

      {!tierInfo.unlocked && (
        <div className="mt-3 text-xs bg-yellow-50 text-yellow-700 p-2 rounded">
          Finissez dans le top 2 pour débloquer ce niveau
        </div>
      )}

      {!canRegister && tierInfo.unlocked && (
        <div className="mt-3 text-xs bg-red-50 text-red-700 p-2 rounded">
          Ressources insuffisantes
        </div>
      )}
    </div>
  );
};

export default InterclubSeasonCard; 