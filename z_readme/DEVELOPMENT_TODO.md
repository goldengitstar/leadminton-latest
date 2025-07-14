# Leadminton Development TODO - 1-Week Sprint

## 🚨 CRITICAL PRIORITY (Day 1-2)

### Admin System Foundation

#### Database Setup
- [ ] Create `admin_users` table with permissions
- [ ] Create `cpu_teams` table for AI opponents  
- [ ] Create `interclub_seasons` table for season management
- [ ] Create `interclub_registrations` table for team signups
- [ ] Create `interclub_matches` table for match tracking
- [ ] Write migration scripts for new tables

#### Admin Authentication
- [ ] Create admin middleware (`src/middleware/adminAuth.ts`)
- [ ] Create admin context (`src/contexts/AdminContext.tsx`)
- [ ] Create protected admin route component
- [ ] Update main routes to include `/admin/*` paths

#### Core Admin Interface
- [ ] Create `AdminLayout` with navigation sidebar
- [ ] Create `AdminDashboard` with system overview
- [ ] Add admin authentication flow
- [ ] Create admin user seeding script

## 🔥 HIGH PRIORITY (Day 3-4)

### Core Admin Features (Essential Only)

#### Tournament Management (Admin)
- [ ] `AdminTournaments` page - list/create/edit tournaments
- [ ] `TournamentForm` component with custom fees/prizes
- [ ] CPU player assignment to tournaments
- [ ] Tournament status management (draft/active/completed)

#### CPU Team Management  
- [ ] `CpuTeamManager` page - create/edit CPU teams
- [ ] `CpuTeamForm` with player generation and naming
- [ ] Skill level configuration for CPU teams
- [ ] Gender balance settings for CPU players

#### Interclub Season Management
- [ ] `InterclubSeasonManager` - create/manage seasons
- [ ] `SeasonForm` with dates and registration deadlines
- [ ] `RegistrationManager` - approve/reject team registrations
- [ ] Group assignment interface with CPU team placement

#### User Management
- [ ] `UserManager` page - view all users
- [ ] User password change functionality
- [ ] User ban/unban capabilities
- [ ] User activity overview

## ⚡ CRITICAL FIXES (Day 5-6)

### Interclub System Essential Fixes

#### Registration Improvements
- [ ] **Fix Mixed Doubles validation** - ensure 1 male + 1 female
- [ ] **Prevent duplicate player selection** across positions
- [ ] **Add "Team Waiting for Review" screen** after submission
- [ ] **Implement 48-hour registration deadline** with countdown

#### Team vs Team Match System
- [ ] Create `TeamMatch` component for 5-match format
- [ ] Update match simulation for team scoring (3-2, 4-1, etc.)
- [ ] Create `InterclubMatchResult` with detailed breakdown
- [ ] Add group standings calculation and display

#### Season Management
- [ ] `InterclubSeason` component for active season view
- [ ] `GroupStandings` with points, wins, losses
- [ ] `MatchSchedule` with weekly calendar
- [ ] `LineupManager` for changing players between weeks

#### Player Management Features
- [ ] **Player deletion for 100,000 coins** functionality
- [ ] Lineup change system between match weeks
- [ ] Player availability checking
- [ ] Injury impact on team selection

## 🧪 FINAL PRIORITY (Day 7)

### Testing & Deployment
**Focus: Critical functionality only**

#### Essential Testing
- [ ] **Admin authentication works**
- [ ] **Tournament creation functional**
- [ ] **Interclub registration validation fixed**
- [ ] **Basic CPU team management**
- [ ] **Core admin workflows end-to-end**

#### Critical Mobile Fixes Only
- [ ] **Fix tournament registration form** mobile layout issues (critical)
- [ ] **Interclub page basic mobile functionality**

#### Deployment Preparation
- [ ] Database migration scripts ready
- [ ] Environment variables configured
- [ ] Admin user seeding script tested

## 📊 TECHNICAL IMPLEMENTATION

### Match Simulation Logic
```typescript
// New team match interface needed
interface TeamMatch {
  homeTeam: Team;
  awayTeam: Team;
  matches: {
    mensSingles: IndividualMatch;
    womensSingles: IndividualMatch;
    mensDoubles: IndividualMatch;
    womensDoubles: IndividualMatch;
    mixedDoubles: IndividualMatch;
  };
  winner: Team;
  score: string; // "3-2", "4-1", etc.
}
```

### Group Assignment Algorithm
- [ ] Balance skill levels between groups
- [ ] Ensure 6-8 teams per group
- [ ] Distribute CPU teams evenly
- [ ] Handle odd number of registrations

### Database Relationships
```sql
-- Key relationships to implement
interclub_registrations.season_id -> interclub_seasons.id
interclub_matches.season_id -> interclub_seasons.id
interclub_matches.home_team_id -> interclub_registrations.id OR cpu_teams.id
admin_users.user_id -> auth.users.id
```

## 🧪 TESTING REQUIREMENTS

### Critical Test Cases
- [ ] Admin can create tournament and assign CPU players
- [ ] Admin can launch interclub season with deadline
- [ ] Users can register team with proper validation
- [ ] Team vs team matches simulate correctly
- [ ] Group standings update properly
- [ ] Mobile registration form works without issues

### Integration Tests
- [ ] Admin workflow end-to-end
- [ ] Interclub season lifecycle 
- [ ] User registration to match completion
- [ ] CPU team integration in competitions

## 🚀 DEPLOYMENT CHECKLIST

### Production Setup
- [ ] Admin user creation process
- [ ] Database migration execution
- [ ] Environment variable configuration
- [ ] SSL certificate and domain setup

### Go-Live Requirements
- [ ] All admin functions operational
- [ ] Interclub system fully functional
- [ ] Mobile responsive on all pages
- [ ] No critical bugs or performance issues
- [ ] Client approval on design and functionality

## 📅 DAILY BREAKDOWN (1-Week Sprint)

### Day 1-2: Admin Foundation (CRITICAL)
- Database schema creation and migrations
- Admin authentication middleware and context
- Basic admin dashboard with routing
- Admin user seeding script

### Day 3-4: Core Admin Features (ESSENTIAL)
- Tournament management interface (basic CRUD)
- CPU team basic management
- Interclub season creation
- User management (password changes only)

### Day 5-6: Interclub Critical Fixes (CLIENT PRIORITY)
- Mixed Doubles validation fix (1 male + 1 female)
- "Team waiting for review" screen after submission
- Basic team vs team match simulation (5-match format)
- Registration deadline implementation

### Day 7: Testing & Deployment (FINAL)
- Core admin workflow testing
- Critical mobile fixes (tournament registration form)
- Bug fixes and client review
- Production deployment

**⚠️ SCOPE REDUCTION FOR 1-WEEK:**
- UI/UX improvements postponed to next milestone
- Advanced admin features deferred
- Comprehensive testing reduced to core functions only
- Design overhaul moved to future phase

## 💰 BUDGET TRACKING

- **Admin System (Backend)**: $750
- **Frontend Completion**: $1,250 (on time) / $750 (late)
- **Total Available**: $2,000 / $1,500

## ✅ SUCCESS METRICS

1. Admin can fully control tournaments and interclub seasons
2. Users can register and compete in interclub competitions  
3. Mobile experience works flawlessly
4. Modern, professional UI design
5. No critical bugs or performance issues
6. Client satisfaction and milestone acceptance

---

**Next Action**: Start with database schema creation and admin authentication system. 