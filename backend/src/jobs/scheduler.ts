/**
 * @file scheduler.ts
 * @description Job scheduler for background tasks
 * Currently handles subscription expiry checking and contract event listening
 */

import { runExpiryJob } from './subscription-expiry'
import { ContractEventListener } from '../services/contract-event-listener'

// Global event listener instance
let eventListener: ContractEventListener | null = null

/**
 * Start the contract event listener if not already running
 */
export async function startEventListener(): Promise<void> {
  if (eventListener && eventListener.isRunning()) {
    console.log('[Scheduler] Event listener is already running')
    return
  }

  const contractAddress = process.env.ALPHA_ENGINE_CONTRACT_ADDRESS
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545'

  if (!contractAddress) {
    console.warn('[Scheduler] ALPHA_ENGINE_CONTRACT_ADDRESS not set, skipping event listener')
    return
  }

  try {
    eventListener = new ContractEventListener({
      rpcUrl,
      contractAddress,
      fromBlock: 'latest'
    })

    await eventListener.startListening()
    console.log('[Scheduler] Contract event listener started successfully')
  } catch (error: any) {
    console.error('[Scheduler] Failed to start event listener:', error.message)
  }
}

/**
 * Stop the contract event listener
 */
export async function stopEventListener(): Promise<void> {
  if (eventListener && eventListener.isRunning()) {
    await eventListener.stopListening()
    eventListener = null
    console.log('[Scheduler] Contract event listener stopped')
  }
}

/**
 * Main scheduler function that runs all scheduled jobs
 * Can be called manually or via system cron
 */
export async function runScheduledJobs(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting scheduled jobs...`)

  try {
    // Start event listener if not already running
    await startEventListener()

    // Run subscription expiry check
    await runExpiryJob()

    console.log(`[${new Date().toISOString()}] All scheduled jobs completed successfully`)
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Scheduled jobs failed:`, error.message)
    throw error
  }
}

/**
 * CLI entry point for running scheduled jobs
 * Usage: bun run src/jobs/scheduler.ts
 */
if (require.main === module) {
  runScheduledJobs()
    .then(() => {
      console.log('Scheduled jobs execution completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Scheduled jobs execution failed:', error)
      process.exit(1)
    })
}