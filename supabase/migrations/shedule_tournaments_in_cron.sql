select cron.schedule(
  'start-tournaments-every-5min',
  '*/1 * * * *', -- every 1 minutes
  $$
    select net.http_post(
      url := 'https://dkgybdenizwuleiaaqpz.supabase.co/functions/v1/auto_tournament_start',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYXlpcWdkZWFlZ3lpY250cnZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTQ1NTE0NywiZXhwIjoyMDY1MDMxMTQ3fQ.bwohA4jcUbIOH6gfBxj0lYca276RtXRbPfP-eqOFQo0',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);