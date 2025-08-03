import React from 'react';
import { Bracket, Seed, SeedItem, SeedTeam, RoundProps } from 'react-brackets';
import { TournamentRound } from '../../types/tournament';
import { Trophy, Crown, Star } from 'lucide-react';

interface SimpleTournamentBracketProps {
  registeredPlayers: any[];
  tournamentName: string;
  rounds: TournamentRound[];
  max_participants: number;
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
    size: 12,
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

const ThemedSeed = ({ seed, breakpoint, scaleFactor }: any) => {
  const winnerId = seed.winnerId;
  const fontSize = customTheme.fonts.size;
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
  max_participants,
  currentPlayerId,
  status,
  onBack,
}) => {
  const playerMap = Object.fromEntries(registeredPlayers.map((p) => [p.id, p]));

  const sortedRounds = [...rounds].sort((a, b) => a.level - b.level);
  const totalRounds = Math.ceil(Math.log2(max_participants));

  // Build and format each round
  const formattedRounds: RoundProps[] = Array.from({ length: totalRounds }, (_, i) => {
    const round = sortedRounds.find((r) => r.level === i + 1);
    const expectedSeedCount = Math.ceil(max_participants / Math.pow(2, i + 1));

    const seeds = round?.matches.map((match) => ({
      id: parseInt(match.id.slice(0, 8), 16),
      date: match.actualStart,
      winnerId: match.winnerId,
      winnerName: match.players?.find((p) => p.id === match.winnerId)?.name || 'Unknown',
      teams: [
        { name: match.players?.[0]?.name || 'CPU' },
        { name: match.players?.[1]?.name || 'CPU' },
      ],
    })) || [];

    // Fill blanks
    while (seeds.length < expectedSeedCount) {
      seeds.push({
        id: Math.floor(Math.random() * 1e8),
        date: null,
        winnerId: null,
        winnerName: '',
        teams: [{ name: '' }, { name: '' }],
      });
    }

    return {
      title: getReadableRoundTitle(totalRounds - i - 1),
      seeds,
    };
  });

  // --- Mirror-order each round based on its next-round winnerIds ---
  for (let r = formattedRounds.length - 2; r >= 0; r--) {
    const thisRound = formattedRounds[r];
    const nextRound = formattedRounds[r + 1];

    // 1) in-order list of winner IDs from next round
    const winnerIds = nextRound.seeds
      .filter((s) => s.winnerId != null)
      .map((s) => s.winnerId!);

    const reordered: typeof thisRound.seeds = [];
    const used = new Set<number>();

    // 2) for each winnerId, find its match and push that and its paired match
    for (const id of winnerIds) {
      const idx = thisRound.seeds.findIndex((seed, i) => !used.has(i) && seed.winnerId === id);
      if (idx === -1) continue;
      const base = idx % 2 === 0 ? idx : idx - 1;
      reordered.push(thisRound.seeds[base], thisRound.seeds[base + 1]);
      used.add(base).add(base + 1);
    }

    // 3) append any leftover slots
    thisRound.seeds.forEach((seed, i) => {
      if (!used.has(i)) reordered.push(seed);
    });

    // 4) overwrite
    thisRound.seeds = reordered;
  }

  // Determine scale factor for layout
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

  // Split early rounds into left/right brackets
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

      <div className="w-full overflow-x-auto overflow-y-auto">
        <div className="flex min-w-fit justify-center items-start px-[10px]">
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