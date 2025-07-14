import React, { useState, useEffect } from 'react';
import { UserService } from '@/services/database';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const userService = new UserService(supabase);

interface TeamNameEditorProps {
  currentTeamName?: string;
  onTeamNameUpdate?: (newTeamName: string) => void;
}

export const TeamNameEditor: React.FC<TeamNameEditorProps> = ({ 
  currentTeamName = '', 
  onTeamNameUpdate 
}) => {
  const { user } = useAuth();
  const [teamName, setTeamName] = useState(currentTeamName);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTeamName(currentTeamName);
  }, [currentTeamName]);

  const handleSave = async () => {
    if (!user || !teamName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await userService.updateUserTeamName(user.id, teamName.trim());
      
      if (result.success) {
        setIsEditing(false);
        onTeamNameUpdate?.(teamName.trim());
      } else {
        setError(result.error || 'Failed to update team name');
      }
    } catch (error) {
      console.error('Error updating team name:', error);
      setError('Failed to update team name');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setTeamName(currentTeamName);
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Team Name</h3>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-2">
              Enter your team name
            </label>
            <input
              id="teamName"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={50}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {teamName.length}/50 characters
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={isLoading || !teamName.trim()}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-lg font-medium text-gray-900">
            {currentTeamName || 'No team name set'}
          </div>
          <p className="text-sm text-gray-600">
            Your team name will be displayed in tournaments and matches.
          </p>
        </div>
      )}
    </div>
  );
}; 