import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, Trophy, User, AlertCircle } from 'lucide-react';

interface NextMatch {
  hasUpcomingMatch: boolean;
  tournamentId?: string;
  tournamentName?: string;
  matchId?: string;
  roundName?: string;
  roundLevel?: number;
  scheduledStartTime?: string;
  opponentId?: string;
  roundIntervalMinutes?: number;
}

export default function UserMatchCountdown() {
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [initialMatchTime, setInitialMatchTime] = useState<number | null>(null);

  // Load match data once on component mount
  useEffect(() => {
    loadNextMatch();
    // No periodic refresh - load once only
  }, []);

  // Independent countdown timer using stored initial time
  useEffect(() => {
    if (initialMatchTime && nextMatch?.hasUpcomingMatch) {
      const updateCountdown = () => {
        const now = Date.now();
        const diff = Math.max(0, initialMatchTime - now);
        setTimeLeft(diff);
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [initialMatchTime, nextMatch?.hasUpcomingMatch]);

  const loadNextMatch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_user_next_match', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error loading next match:', error);
        return;
      }

      setNextMatch(data);
      
      // Store initial match time for countdown
      if (data?.hasUpcomingMatch && data.scheduledStartTime) {
        const matchTime = new Date(data.scheduledStartTime).getTime();
        setInitialMatchTime(matchTime);
        setTimeLeft(Math.max(0, matchTime - Date.now()));
      }

      console.log('[UserMatchCountdown] Match loaded once, using local countdown');
    } catch (error) {
      console.error('Error loading next match:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeLeft = (ms: number): string => {
    if (ms <= 0) return 'Match Ready!';

    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const parts: string[] = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && days === 0) parts.push(`${seconds}s`);

    return parts.join(' ') || 'Starting...';
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!nextMatch?.hasUpcomingMatch) {
    return null; // Don't show if no upcoming matches
  }

  const isMatchReady = timeLeft <= 0;
  const isStartingSoon = timeLeft > 0 && timeLeft <= 300000;

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 p-4 ${
      isMatchReady ? 'border-red-500 bg-red-50' : 
      isStartingSoon ? 'border-yellow-500 bg-yellow-50' : 
      'border-blue-500 bg-blue-50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${
            isMatchReady ? 'bg-red-100' : 
            isStartingSoon ? 'bg-yellow-100' : 
            'bg-blue-100'
          }`}>
            <Clock className={`w-5 h-5 ${
              isMatchReady ? 'text-red-600' : 
              isStartingSoon ? 'text-yellow-600' : 
              'text-blue-600'
            }`} />
          </div>
          <div>
            <h3 className={`font-semibold ${
              isMatchReady ? 'text-red-800' : 
              isStartingSoon ? 'text-yellow-800' : 
              'text-blue-800'
            }`}>
              {isMatchReady ? 'Your Match is Ready!' : 'Upcoming Match'}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Trophy className="w-4 h-4 mr-1" />
                <span>{nextMatch.tournamentName}</span>
              </div>
              <div className="flex items-center">
                <User className="w-4 h-4 mr-1" />
                <span>{nextMatch.roundName}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-lg font-mono font-bold ${
            isMatchReady ? 'text-red-700' : 
            isStartingSoon ? 'text-yellow-700' : 
            'text-blue-700'
          }`}>
            {formatTimeLeft(timeLeft)}
          </div>
          <div className={`text-xs ${
            isMatchReady ? 'text-red-600' : 
            isStartingSoon ? 'text-yellow-600' : 
            'text-blue-600'
          }`}>
            {isMatchReady ? 'Match Available' : 'Until Match Starts'}
          </div>
        </div>
      </div>

      {isMatchReady && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <div className="flex items-center text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span>Your match is ready to start! Check the tournament bracket.</span>
          </div>
        </div>
      )}
    </div>
  );
} 