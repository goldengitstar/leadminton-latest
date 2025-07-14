// Database service modules - JavaScript replacements for database functions
import { ResourceService } from './resourceService';
import { TournamentService } from './tournamentService';
import { PlayerService } from './playerService';
import { AdminService } from './adminService';
import { UserService } from './userService';
import { MatchService } from './matchService';
import { InterclubService } from './interclubService';

export { ResourceService, TournamentService, PlayerService, AdminService, UserService, MatchService, InterclubService };

// Export all services as a single object for convenience
export const DatabaseServices = {
  ResourceService,
  TournamentService,
  PlayerService,
  AdminService,
  UserService,
  MatchService,
  InterclubService
}; 