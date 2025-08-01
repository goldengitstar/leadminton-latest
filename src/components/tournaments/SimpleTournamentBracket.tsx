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

// Custom round title component
const ThemedRoundTitle = (title: string) => (
  <div style={{
    fontFamily: customTheme.fonts.family,
    fontSize: customTheme.fonts.size + 2,
    fontWeight: customTheme.fonts.weight,
    color: customTheme.textColor.highlighted,
    textAlign: 'center',
    marginBottom: 8,
  }}>
    {title}
  </div>
);

// Custom seed rendering
const ThemedSeed = ({ seed, breakpoint, scaleFactor }: any) => {
  const fontSize = customTheme.fonts.size * scaleFactor;
  const padding = `${4 * scaleFactor}px ${6 * scaleFactor}px`;
  return (
    <Seed mobileBreakpoint={breakpoint}>
      <SeedItem style={{
        backgroundColor: customTheme.matchBackground.default,
        border: `1px solid ${customTheme.matchBorderColor}`,
        fontFamily: customTheme.fonts.family,
        fontSize,
        fontWeight: customTheme.fonts.weight,
        color: customTheme.textColor.main,
      }}>
        {seed.teams?.map((team: any, i: number) => {
          const isWinner = team.name === seed.winnerName;
          return (
            <SeedTeam key={i} style={{
              backgroundColor: isWinner
                ? customTheme.matchBackground.won
                : seed.winnerId
                  ? customTheme.matchBackground.lost
                  : customTheme.matchBackground.default,
              padding,
            }}>
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
  // Index players by ID for lookup
  const playerMap = Object.fromEntries(registeredPlayers.map((p) => [p.id, p]));

  // Sort rounds by level ascending
  const sortedRounds = [...rounds].sort((a, b) => a.level - b.level);
  const totalRounds = Math.ceil(Math.log2(max_participants));

  // Build match lookup by round
  const matchesByRound = sortedRounds.reduce((acc, round) => {
    acc[round.level] = round.matches;
    return acc;
  }, {} as Record<number, TournamentRound['matches']>);

  // Find next match in higher round that contains this winner
  function findNextMatch(match: any, level: number) {
    const next = matchesByRound[level + 1] || [];
    return next.find(
      m => m.player1Id === match.winnerId || m.player2Id === match.winnerId
    );
  }

  // Build a branch of matches from final backwards
  function buildBranch(finalMatch: any, level: number) {
    const branch: { match: any; round: number }[] = [];
    let cursor = finalMatch;
    let lvl = level;
    while (cursor) {
      branch.push({ match: cursor, round: lvl });
      cursor = findNextMatch(cursor, lvl - 1) as any;
      lvl -= 1;
      if (lvl < 1) break;
    }
    return branch;
  }

  // Generate branches from final round matches
  const finalLevel = sortedRounds[sortedRounds.length - 1]?.level || 1;
  const finals = matchesByRound[finalLevel] || [];
  const branches = finals.map(m => buildBranch(m, finalLevel));

  // Split branches half-and-half
  const half = Math.ceil(branches.length / 2);
  const rightBranches = branches.slice(0, half);
  const leftBranches = branches.slice(half);

  // Convert branches to RoundProps columns
  function branchesToRounds(branchList: typeof branches) {
    return branchList.map(branch => {
      const roundIndex = branch[0].round;
      return {
        title: getReadableRoundTitle(totalRounds - roundIndex),
        seeds: branch.map(({ match }) => ({
          id: parseInt(match.id.slice(0,8), 16),
          date: match.actualStart,
          winnerId: match.winnerId,
          winnerName: match.players?.find((p:any) => p.id === match.winnerId)?.name || 'TBD',
          teams: [
            { name: match.players?.[0]?.name || '' },
            { name: match.players?.[1]?.name || '' },
          ],
        })),
      } as RoundProps;
    });
  }

  const rightRounds = branchesToRounds(rightBranches);
  const leftRounds = branchesToRounds(leftBranches).map(r => ({
    ...r,
    seeds: [...r.seeds].reverse(),
  }));

  // Scale seeds to fit
  const scaleFactor =
    branches.length >= 7 ? 0.6 :
    branches.length >= 6 ? 0.75 :
    branches.length >= 5 ? 0.9 : 1;

  // No bracket scenario
  if (!finals.length) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Tournament Bracket Available</h3>
        <p className="text-gray-500">The tournament bracket will appear once the tournament starts.</p>
      </div>
    );
  }

  // Champion display
  const winnerMatch = finals.find(m => m.winnerId);
  const champion = winnerMatch
    ? winnerMatch.players?.find((p:any) => p.id === winnerMatch.winnerId)?.name
    : null;

  return (
    <div className="w-full bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900">{tournamentName}</h2>
          {status === 'completed' && (
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full">
              <Crown className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Completed</span>
            </div>
          )}
        </div>
        <button onClick={onBack} className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500">
          Back
        </button>
      </div>

      {status === 'completed' && champion && (
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Crown className="w-12 h-12 text-yellow-500 mr-3" />
              <Trophy className="w-16 h-16 text-yellow-500" />
              <Crown className="w-12 h-12 text-yellow-500 ml-3" />
            </div>
            <h3 className="text-3xl font-bold text-yellow-800 mb-2">🎉 Tournament Champion! 🎉</h3>
            <div className="bg-white bg-opacity-70 rounded-lg p-4 inline-block">
              <div className="flex items-center justify-center space-x-2">
                <Star className="w-6 h-6 text-yellow-500" />
                <span className="text-2xl font-bold text-gray-900">{champion}</span>
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
              {champion === playerMap[currentPlayerId]?.name && (
                <div className="mt-2 text-green-700 font-semibold">Congratulations! You won the tournament! 🏆</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto overflow-y-auto">
        <div className="flex min-w-fit justify-center items-start px-[10px]">
          <div>
            <Bracket rounds={rightRounds} rtl={false}
              renderSeedComponent={(props) => <ThemedSeed {...props} scaleFactor={scaleFactor} />}
              roundTitleComponent={ThemedRoundTitle}
            />
          </div>
          <div>
            <Bracket rounds={[{ title: getReadableRoundTitle(0), seeds: finals.map(m => ({
              id: parseInt(m.id.slice(0,8),16), date: m.actualStart, winnerId: m.winnerId,
              winnerName: m.players?.find((p:any)=>p.id===m.winnerId)?.name||'TBD',
              teams: [
                { name: m.players?.[0]?.name||'' }, { name: m.players?.[1]?.name||'' }
              ]
            })) }]} rtl={false}
              renderSeedComponent={(props) => <ThemedSeed {...props} scaleFactor={scaleFactor} />}
              roundTitleComponent={ThemedRoundTitle}
            />
          </div>
          <div>
            <Bracket rounds={leftRounds} rtl={true}
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
