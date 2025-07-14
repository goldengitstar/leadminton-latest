import React from 'react';
import { X, Trophy, Medal, Coins, Diamond, Star } from 'lucide-react';
import { Tournament } from '../../types/tournament';

interface TournamentResultsProps {
  tournament: Tournament;
  onClose: () => void;
  userPosition?: number;
  userRewards?: {
    coins?: number;
    diamonds?: number;
    shuttlecocks?: number;
    meals?: number;
  };
}

const TournamentResults: React.FC<TournamentResultsProps> = ({
  tournament,
  onClose,
  userPosition,
  userRewards
}) => {
  const getRankingData = () => {
    // In a real implementation, this would come from the tournament results
    // For now, we'll show mock data based on registered players
    const rankings = tournament.registeredPlayers?.slice(0, 8).map((player, index) => ({
      position: index + 1,
      playerName: player.playerName,
      clubName: player.clubName,
      isUser: false // This would be determined by checking if player belongs to current user
    })) || [];

    return rankings;
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <Star className="w-6 h-6 text-gray-300" />;
    }
  };

  const getPositionRewards = (position: number) => {
    switch (position) {
      case 1:
        return tournament.prizePool.first;
      case 2:
        return tournament.prizePool.second;
      case 3:
        return tournament.prizePool.third;
      default:
        return {};
    }
  };

  const rankings = getRankingData();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Trophy className="w-6 h-6 mr-2 text-yellow-500" />
            {tournament.name} - Results
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Tournament Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Tournament Complete!</h3>
              <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <Trophy className="w-4 h-4 mr-1 text-yellow-500" />
                  {tournament.tier.charAt(0).toUpperCase() + tournament.tier.slice(1)} Tournament
                </div>
                <div>
                  Participants: {tournament.currentParticipants}
                </div>
                <div>
                  Date: {new Date(tournament.startDate).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* User Performance (if user participated) */}
          {userPosition && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-green-900">Your Performance</h4>
                  <p className="text-green-800">
                    You finished in position {userPosition} out of {tournament.currentParticipants} players!
                  </p>
                </div>
                <div className="text-right">
                  {userRewards && (
                    <div className="text-sm">
                      <p className="font-medium text-green-900 mb-1">Rewards Earned:</p>
                      <div className="space-y-1">
                        {userRewards.coins && (
                          <div className="flex items-center justify-end">
                            <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                            <span>{userRewards.coins}</span>
                          </div>
                        )}
                        {userRewards.diamonds && (
                          <div className="flex items-center justify-end">
                            <Diamond className="w-4 h-4 text-purple-500 mr-1" />
                            <span>{userRewards.diamonds}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Final Rankings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Final Rankings</h3>
            <div className="space-y-3">
              {rankings.map((player) => {
                const rewards = getPositionRewards(player.position);
                
                return (
                  <div
                    key={`${player.position}-${player.playerName}`}
                    className={`border rounded-lg p-4 ${
                      player.isUser ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-10 h-10">
                          {getPositionIcon(player.position)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{player.playerName}</h4>
                          <p className="text-sm text-gray-600">{player.clubName}</p>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          #{player.position}
                        </div>
                      </div>

                      {/* Rewards */}
                      {(rewards.coins || rewards.diamonds) && (
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-600 mb-1">Rewards</p>
                          <div className="flex items-center space-x-3">
                            {rewards.coins && (
                              <div className="flex items-center">
                                <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                                <span className="text-sm font-medium">{rewards.coins}</span>
                              </div>
                            )}
                            {rewards.diamonds && (
                              <div className="flex items-center">
                                <Diamond className="w-4 h-4 text-purple-500 mr-1" />
                                <span className="text-sm font-medium">{rewards.diamonds}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {rankings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p>No ranking data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Prize Pool Summary */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Prize Pool</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <h4 className="font-semibold text-yellow-900">1st Place</h4>
                <div className="text-sm space-y-1 mt-2">
                  {tournament.prizePool.first.coins && (
                    <div className="flex items-center justify-center">
                      <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                      <span>{tournament.prizePool.first.coins}</span>
                    </div>
                  )}
                  {tournament.prizePool.first.diamonds && (
                    <div className="flex items-center justify-center">
                      <Diamond className="w-4 h-4 text-purple-500 mr-1" />
                      <span>{tournament.prizePool.first.diamonds}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <Medal className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <h4 className="font-semibold text-gray-700">2nd Place</h4>
                <div className="text-sm space-y-1 mt-2">
                  {tournament.prizePool.second.coins && (
                    <div className="flex items-center justify-center">
                      <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                      <span>{tournament.prizePool.second.coins}</span>
                    </div>
                  )}
                  {tournament.prizePool.second.diamonds && (
                    <div className="flex items-center justify-center">
                      <Diamond className="w-4 h-4 text-purple-500 mr-1" />
                      <span>{tournament.prizePool.second.diamonds}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <Medal className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <h4 className="font-semibold text-amber-800">3rd Place</h4>
                <div className="text-sm space-y-1 mt-2">
                  {tournament.prizePool.third.coins && (
                    <div className="flex items-center justify-center">
                      <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                      <span>{tournament.prizePool.third.coins}</span>
                    </div>
                  )}
                  {tournament.prizePool.third.diamonds && (
                    <div className="flex items-center justify-center">
                      <Diamond className="w-4 h-4 text-purple-500 mr-1" />
                      <span>{tournament.prizePool.third.diamonds}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-center mt-8">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close Results
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentResults; 