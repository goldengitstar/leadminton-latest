import React from 'react';
import { Bracket, Seed, SeedItem, SeedTeam, RoundProps } from 'react-brackets';
import { TournamentRound } from '../../types/tournament';
import { Trophy, Crown, Star } from 'lucide-react';

interface SimpleTournamentBracketProps {
  registeredPlayers: any[];
  tournamentName: string;
  rounds: TournamentRound[];
  currentPlayerId: string;
  status: any;
  onBack: () => void;
}



function getReadableRoundTitle(indexFromEnd: number): string {
  switch (indexFromEnd) {
    case 0: return 'Final';
    case 1: return 'Semi-Final';
    case 2: return 'Quarter-Final';
    default: return `Round ${indexFromEnd + 1}`;
  }
}

const customTheme = {
  textColor: {
    main: '#111827',
    highlighted: '#f59e0b',
    dark: '#4b5563',
  },
  matchBackground: {
    default: '#f9fafb',
    won: '#d1fae5',
    lost: '#fee2e2',
  },
  matchBorderColor: '#e5e7eb',
  connectorColor: '#9ca3af',
  borderRadius: 12,
  fonts: {
    family: 'Inter, sans-serif',
    size: 10,
    weight: 500,
  },
};

// Custom round title
const ThemedRoundTitle = (title: string, roundIndex: number) => (
  <div
    style={{
      fontFamily: customTheme.fonts.family,
      fontSize: customTheme.fonts.size + 2,
      fontWeight: customTheme.fonts.weight,
      color: customTheme.textColor.highlighted,
      textAlign: 'center',
      marginBottom: 8,
    }}
  >
    {title}
  </div>
);

// Custom seed rendering
// Modify to accept scaleFactor
const ThemedSeed = ({ seed, breakpoint, scaleFactor }: any) => {
  const winnerId = seed.winnerId;

  const fontSize = customTheme.fonts.size * scaleFactor;
  const padding = `${4 * scaleFactor}px ${6 * scaleFactor}px`;

  return (
    <Seed mobileBreakpoint={breakpoint}>
      <SeedItem
        style={{
          backgroundColor: customTheme.matchBackground.default,
          border: `1px solid ${customTheme.matchBorderColor}`,
          fontFamily: customTheme.fonts.family,
          fontSize,
          fontWeight: customTheme.fonts.weight,
          color: customTheme.textColor.main,
        }}
      >
        {seed.teams?.map((team: any, i: number) => {
          const isWinner = team.name === seed.winnerName;
          return (
            <SeedTeam
              key={i}
              style={{
                backgroundColor: isWinner
                  ? customTheme.matchBackground.won
                  : winnerId
                  ? customTheme.matchBackground.lost
                  : customTheme.matchBackground.default,
                padding,
              }}
            >
              {team.name}
            </SeedTeam>
          );
        })}
      </SeedItem>
    </Seed>
  );
};


const SimpleTournamentBracket: React.FC<SimpleTournamentBracketProps> = ({
  registeredPlayers,
  tournamentName,
  rounds,
  currentPlayerId,
  status,
  onBack,
}) => {
  const playerMap = Object.fromEntries(registeredPlayers.map((p) => [p.id, p]));

  const sortedRounds = [...rounds].sort((a, b) => a.level - b.level);

  const formattedRounds: RoundProps[] = sortedRounds.map((round, index, arr) => ({
    title: getReadableRoundTitle(arr.length - index - 1),
    seeds: round.matches.map((match) => ({
      id: parseInt(match.id.slice(0, 8), 16),
      date: match.actualStart,
      winnerId: match.winnerId,
      winnerName: match.players?.find((p) => p.id === match.winnerId)?.name || 'Unknown',
      teams: [
        { name: match.players?.[0]?.name || 'CPU' },
        { name: match.players?.[1]?.name || 'CPU' },
      ],
    })),
  }));


  // 👇 Add this line inside the component, near the top of SimpleTournamentBracket
  const scaleFactor =
    formattedRounds.length >= 7 ? 0.6 :
    formattedRounds.length >= 6 ? 0.75 :
    formattedRounds.length >= 5 ? 0.9 :
    1.0;


  if (!formattedRounds.length) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Tournament Bracket Available</h3>
        <p className="text-gray-500">The tournament bracket will appear once the tournament starts.</p>
      </div>
    );
  }

  const finalRoundOriginal = sortedRounds[sortedRounds.length - 1];
  const finalMatch = finalRoundOriginal.matches.find((m) => m.winnerId);
  const winnerName = finalMatch
    ? finalMatch.players?.find((p) => p.id === finalMatch.winnerId)?.name || 'Unknown'
    : null;

  const tournamentCompleted = status === 'completed';

  const finalRound = formattedRounds[formattedRounds.length - 1];
  const earlyRounds = formattedRounds.slice(0, -1);

  const leftRounds: RoundProps[] = earlyRounds.map((round) => {
    const split = Math.ceil(round.seeds.length / 2);
    return { title: round.title, seeds: round.seeds.slice(split) };
  });

  const rightRounds: RoundProps[] = earlyRounds.map((round) => {
    const split = Math.ceil(round.seeds.length / 2);
    return { title: round.title, seeds: round.seeds.slice(0, split) };
  });

  return (
    <div className="w-full bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900">{tournamentName}</h2>
          {tournamentCompleted && (
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full">
              <Crown className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Completed</span>
            </div>
          )}
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
        >
          Back
        </button>
      </div>

      {tournamentCompleted && winnerName && (
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Crown className="w-12 h-12 text-yellow-500 mr-3" />
              <Trophy className="w-16 h-16 text-yellow-500" />
              <Crown className="w-12 h-12 text-yellow-500 ml-3" />
            </div>
            <h3 className="text-3xl font-bold text-yellow-800 mb-2">
              🎉 Tournament Champion! 🎉
            </h3>
            <div className="bg-white bg-opacity-70 rounded-lg p-4 inline-block">
              <div className="flex items-center justify-center space-x-2">
                <Star className="w-6 h-6 text-yellow-500" />
                <span className="text-2xl font-bold text-gray-900">{winnerName}</span>
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
              {winnerName === playerMap[currentPlayerId]?.name && (
                <div className="mt-2 text-green-700 font-semibold">
                  Congratulations! You won the tournament! 🏆
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full overflow-y-[auto]">
        <div className="flex justify-center items-start p-[10px]">
          <div>
            <Bracket
              rounds={rightRounds}
              rtl={false}
              renderSeedComponent={(props) => <ThemedSeed {...props} scaleFactor={scaleFactor} />}
              roundTitleComponent={ThemedRoundTitle}
            />
          </div>
          <div>
            <Bracket
              rounds={[finalRound]}
              rtl={false}
              renderSeedComponent={(props) => <ThemedSeed {...props} scaleFactor={scaleFactor} />}
              roundTitleComponent={ThemedRoundTitle}
            />
          </div>
          <div>
            <Bracket
              rounds={leftRounds.map((r) => ({
                ...r,
                seeds: [...r.seeds].reverse(),
              }))}
              rtl={true}
              renderSeedComponent={(props) => <ThemedSeed {...props} scaleFactor={scaleFactor} />}
              roundTitleComponent={ThemedRoundTitle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleTournamentBracket;