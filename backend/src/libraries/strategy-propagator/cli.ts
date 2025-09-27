#!/usr/bin/env bun

/**
 * @file strategy-propagator/cli.ts
 * @description CLI interface for strategy propagator
 */

import { strategyPropagator } from './index'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  try {
    switch (command) {
      case '--help':
      case '-h':
        console.log(`
Strategy Propagator CLI

Commands:
  broadcast --strategy <id>
    Broadcast a strategy to all active subscribers

  check-delivery --consumer <address> [--json]
    Check delivery status for a consumer

  retry-failed
    Retry all failed deliveries

  health --consumer <address>
    Check delivery health for a consumer

  queue-status
    Show queue statistics

Options:
  --json    Output in JSON format
  --help    Show this help message
`)
        process.exit(0)
        break

      case 'broadcast':
        {
          const strategyIndex = args.indexOf('--strategy')
          if (strategyIndex === -1) {
            console.error('Error: --strategy is required')
            process.exit(1)
          }

          // Validate that --strategy has a value
          const strategyId = args[strategyIndex + 1]
          if (!strategyId || typeof strategyId !== 'string' || strategyId.trim() === '' || strategyId.startsWith('-')) {
            console.error('Error: --strategy requires a valid ID')
            process.exit(1)
          }

          const result = await strategyPropagator.cli.broadcast({ strategyId: strategyId.trim() })

          if (result.exitCode === 0) {
            console.log('✅ Strategy broadcast complete:')
            if (result.deliveryResults) {
              const delivered = result.deliveryResults.filter(r => r.status === 'delivered')
              const queued = result.deliveryResults.filter(r => r.status === 'queued')
              const failed = result.deliveryResults.filter(r => r.status === 'failed')

              console.log(`  Delivered: ${delivered.length}`)
              console.log(`  Queued: ${queued.length}`)
              console.log(`  Failed: ${failed.length}`)

              if (failed.length > 0) {
                console.log('\nFailed deliveries:')
                failed.forEach(f => {
                  console.log(`  - ${f.consumerAddress}: ${f.error}`)
                })
              }
            }
          } else {
            console.error('❌ Error:', result.error)
            process.exit(1)
          }
        }
        break

      case 'check-delivery':
        {
          const consumerIndex = args.indexOf('--consumer')
          if (consumerIndex === -1) {
            console.error('Error: --consumer is required')
            process.exit(1)
          }

          const consumerAddress = args[consumerIndex + 1]
          const jsonFlag = args.includes('--json')

          const result = await strategyPropagator.cli.checkDelivery({
            consumerAddress,
            json: jsonFlag
          })

          if (result.exitCode === 0) {
            if (jsonFlag) {
              console.log(JSON.stringify(result.data, null, 2))
            } else {
              const data = result.data
              console.log('Delivery Health Check:')
              console.log(`  Connected: ${data.connected ? '✅ Yes' : '❌ No'}`)
              console.log(`  Missed Strategies: ${data.missedStrategies}`)
              if (data.lastDelivery) {
                console.log(`  Last Delivery: ${new Date(data.lastDelivery).toLocaleString()}`)
              } else {
                console.log(`  Last Delivery: Never`)
              }
            }
          } else {
            console.error('❌ Error:', result.error)
            process.exit(1)
          }
        }
        break

      case 'retry-failed':
        {
          try {
            const retriedCount = await strategyPropagator.retryFailed()
            console.log(`✅ Retried ${retriedCount} failed deliveries`)
          } catch (error: any) {
            console.error('❌ Error:', error.message)
            process.exit(1)
          }
        }
        break

      case 'health':
        {
          const consumerIndex = args.indexOf('--consumer')
          if (consumerIndex === -1) {
            console.error('Error: --consumer is required')
            process.exit(1)
          }

          const consumerAddress = args[consumerIndex + 1]

          try {
            const health = await strategyPropagator.checkDeliveryHealth(consumerAddress)
            console.log('Delivery Health:')
            console.log(`  Connected: ${health.connected ? '✅' : '❌'}`)
            console.log(`  Missed Strategies: ${health.missedStrategies}`)
            if (health.lastDelivery) {
              console.log(`  Last Delivery: ${health.lastDelivery.toLocaleString()}`)
            }
          } catch (error: any) {
            console.error('❌ Error:', error.message)
            process.exit(1)
          }
        }
        break

      case 'queue-status':
        {
          try {
            const queuedCount = await strategyPropagator.getQueuedCount()
            const failedDeliveries = await strategyPropagator.getFailedDeliveries()
            const connectionCount = strategyPropagator.getConnectionCount()

            console.log('Queue Statistics:')
            console.log(`  Active Connections: ${connectionCount}`)
            console.log(`  Queued Deliveries: ${queuedCount}`)
            console.log(`  Failed Deliveries: ${failedDeliveries.length}`)
          } catch (error: any) {
            console.error('❌ Error:', error.message)
            process.exit(1)
          }
        }
        break

      default:
        console.error(`Unknown command: ${command}`)
        console.log('Use --help to see available commands')
        process.exit(1)
    }

    process.exit(0)
  } catch (error: any) {
    console.error('Unexpected error:', error.message)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})