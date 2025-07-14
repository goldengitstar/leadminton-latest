-- Admin User Setup Script
-- Run this in Supabase SQL Editor to create your first admin user
-- Replace 'your-email@example.com' with your actual email address

-- First, create a regular user account through the Supabase Auth interface
-- Then run this script to grant admin privileges

-- Step 1: Find your user ID (replace email with your actual email)
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Step 2: Create admin user entry (replace the user_id with your actual user ID from step 1)
INSERT INTO admin_users (user_id, permissions) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'nzukiegan6@gmail.com'),
  '{"tournaments": true, "interclub": true, "users": true, "cpu_teams": true}'::jsonb
);

-- Step 3: Verify admin user was created
SELECT 
  au.id as admin_id,
  au.user_id,
  u.email,
  au.permissions,
  au.created_at
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id;

-- Optional: Create sample CPU team for testing
INSERT INTO cpu_teams (name, skill_level, players) VALUES (
  'Lightning Bolts',
  6,
  '[
    {
      "id": "cpu_1",
      "name": "Alex Thunder", 
      "gender": "male",
      "position": "singles",
      "skill_level": 7,
      "stats": {"attack": 75, "defense": 70, "speed": 80, "stamina": 65, "technique": 85}
    },
    {
      "id": "cpu_2", 
      "name": "Sarah Lightning",
      "gender": "female", 
      "position": "singles",
      "skill_level": 6,
      "stats": {"attack": 70, "defense": 80, "speed": 85, "stamina": 75, "technique": 70}
    },
    {
      "id": "cpu_3",
      "name": "Mike Power",
      "gender": "male",
      "position": "doubles", 
      "skill_level": 6,
      "stats": {"attack": 80, "defense": 65, "speed": 70, "stamina": 80, "technique": 75}
    },
    {
      "id": "cpu_4",
      "name": "Emma Swift", 
      "gender": "female",
      "position": "doubles",
      "skill_level": 7, 
      "stats": {"attack": 65, "defense": 85, "speed": 90, "stamina": 70, "technique": 80}
    },
    {
      "id": "cpu_5",
      "name": "David Storm",
      "gender": "male",
      "position": "mixed",
      "skill_level": 8,
      "stats": {"attack": 85, "defense": 75, "speed": 75, "stamina": 85, "technique": 90}
    }
  ]'::jsonb
);

-- Optional: Create sample interclub season
INSERT INTO interclub_seasons (name, start_date, end_date, registration_deadline, status, groups, max_teams_per_group) 
VALUES (
  'Spring Championship 2025',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '37 days',
  NOW() + INTERVAL '5 days',
  'registration_open',
  '[]'::jsonb,
  8
); 