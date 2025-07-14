// Monitor service runner script
import { exec } from 'child_process';

// Run the standalone monitor service using tsx
async function startMonitorService() {
  try {
    console.log('[Monitor Script] Starting monitor service...');
    
    // Use tsx to run the standalone TypeScript file
    const child = exec('npx tsx src/services/monitor-standalone.ts', {
      cwd: process.cwd()
    });
    
    child.stdout.on('data', (data) => {
      console.log(data.toString().trim());
    });
    
    child.stderr.on('data', (data) => {
      console.error(data.toString().trim());
    });
    
    child.on('close', (code) => {
      console.log(`[Monitor Script] Process exited with code ${code}`);
    });
    
    // Keep the process alive
    process.on('SIGINT', () => {
      console.log('[Monitor Script] Shutting down monitor service...');
      child.kill('SIGINT');
      process.exit(0);
    });
    
    console.log('[Monitor Script] Monitor service started successfully');
    
  } catch (error) {
    console.error('[Monitor Script] Error starting monitor service:', error);
    process.exit(1);
  }
}

startMonitorService(); 