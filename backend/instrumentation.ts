/**
 * Next.js Instrumentation file
 * This file is automatically loaded when the Next.js server starts
 * Perfect place to initialize the logging service and event listener
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only initialize logging on the server side
    await import('./src/utils/initializeLogging');
    console.log('🚀 Backend instrumentation loaded - Logging service initialized');

    // Dynamically import scheduler only in nodejs runtime to avoid fs module issues
    const { startEventListener } = await import('./src/jobs/scheduler');

    // Start event listener after a delay to ensure backend is ready
    setTimeout(async () => {
      console.log('📡 Starting contract event listener...');

      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await startEventListener();
          console.log('✅ Contract event listener started successfully');
          break;
        } catch (error: any) {
          console.error(`⚠️ Event listener start attempt ${attempt}/5 failed:`, error.message);
          if (attempt < 5) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            console.error('❌ Failed to start event listener after 5 attempts');
          }
        }
      }
    }, 5000); // 5 second delay for backend initialization
  }
}