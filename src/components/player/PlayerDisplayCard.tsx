import React from 'react';

interface PlayerDisplayCardProps {
  player: {
    id: string;
    name: string;
    level?: number;
    rank?: number;
    team_name?: string;
  };
  showTeamName?: boolean;
  showLevel?: boolean;
  showRank?: boolean;
  className?: string;
  onClick?: () => void;
}

export const PlayerDisplayCard: React.FC<PlayerDisplayCardProps> = ({
  player,
  showTeamName = true,
  showLevel = true,
  showRank = false,
  className = '',
  onClick
}) => {
  const cardClasses = `
    bg-white rounded-lg p-4 border shadow-sm hover:shadow-md transition-shadow
    ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}
    ${className}
  `;

  return (
    <div className={cardClasses} onClick={onClick}>
      <div className="space-y-2">
        {/* Player Name */}
        <h3 className="font-semibold text-gray-900 text-lg">{player.name}</h3>
        
        {/* Team Name */}
        {showTeamName && player.team_name && (
          <div className="flex items-center text-sm text-blue-600">
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {player.team_name}
          </div>
        )}

        {/* Player Stats */}
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          {showLevel && player.level !== undefined && (
            <div className="flex items-center">
              <span className="font-medium">Level:</span>
              <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {player.level}
              </span>
            </div>
          )}
          
          {showRank && player.rank !== undefined && (
            <div className="flex items-center">
              <span className="font-medium">Rank:</span>
              <span className="ml-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                {Math.round(player.rank)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PlayerListProps {
  players: Array<{
    id: string;
    name: string;
    level?: number;
    rank?: number;
    team_name?: string;
  }>;
  title?: string;
  showTeamName?: boolean;
  showLevel?: boolean;
  showRank?: boolean;
  onPlayerClick?: (player: any) => void;
  className?: string;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  title,
  showTeamName = true,
  showLevel = true,
  showRank = false,
  onPlayerClick,
  className = ''
}) => {
  if (!players.length) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        No players to display
      </div>
    );
  }

  return (
    <div className={className}>
      {title && (
        <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <PlayerDisplayCard
            key={player.id}
            player={player}
            showTeamName={showTeamName}
            showLevel={showLevel}
            showRank={showRank}
            onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
          />
        ))}
      </div>
    </div>
  );
}; 