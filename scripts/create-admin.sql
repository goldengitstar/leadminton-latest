-- Create Admin User Script
-- This script creates the first admin user for the Leadminton admin panel
-- Usage: Replace 'your-email@example.com' with the actual admin email

-- First, make sure the user exists in auth.users (they need to register first)
-- Then run this script to grant admin permissions

-- Replace 'your-email@example.com' with your actual email
INSERT INTO admin_users (user_id, permissions) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'nzukiegan6@gmail.com'),
  '{"tournaments": true, "interclub": true, "users": true, "cpu_teams": true}'::jsonb
)
ON CONFLICT (user_id) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- Verify the admin user was created
SELECT au.id, u.email, au.permissions, au.created_at 
FROM admin_users au 
JOIN auth.users u ON au.user_id = u.id
WHERE u.email = 'your-email@example.com'; 