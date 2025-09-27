#!/usr/bin/env bun

/**
 * @file subscription-manager/cli.ts
 * @description CLI interface for subscription manager
 */

import { subscriptionManager } from './index'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  try {
    switch (command) {
      case '--help':
      case '-h':
        console.log(`
Subscription Manager CLI

Commands:
  subscribe --generator <address> --consumer <address> [--fee <amount>]
    Create a new subscription

  list-active [--consumer <address>] [--generator <address>] [--json]
    List active subscriptions

  check-expiry
    Check and mark expired subscriptions

  get --id <subscription-id>
    Get a specific subscription

  revenue --generator <address>
    Calculate total revenue for a generator

Options:
  --json    Output in JSON format
  --help    Show this help message
`)
        process.exit(0)
        break

      case 'subscribe':
        {
          const generatorIndex = args.indexOf('--generator')
          const consumerIndex = args.indexOf('--consumer')
          const feeIndex = args.indexOf('--fee')

          if (generatorIndex === -1 || consumerIndex === -1) {
            console.error('Error: --generator and --consumer are required')
            process.exit(1)
          }

          const generatorAddress = args[generatorIndex + 1]
          const consumerAddress = args[consumerIndex + 1]
          const fee = feeIndex !== -1 ? args[feeIndex + 1] : '100000000000000000'

          const result = await subscriptionManager.cli.subscribe({
            generatorAddress,
            consumerAddress,
            fee
          })

          if (result.exitCode === 0) {
            console.log('✅ Subscription created successfully:')
            console.log(JSON.stringify(result.data, null, 2))
          } else {
            console.error('❌ Error:', result.error)
            process.exit(1)
          }
        }
        break

      case 'list-active':
        {
          const consumerIndex = args.indexOf('--consumer')
          const generatorIndex = args.indexOf('--generator')
          const jsonFlag = args.includes('--json')

          const consumerAddress = consumerIndex !== -1 ? args[consumerIndex + 1] : undefined
          const generatorAddress = generatorIndex !== -1 ? args[generatorIndex + 1] : undefined

          const result = await subscriptionManager.cli.listActive({
            consumerAddress,
            generatorAddress,
            json: jsonFlag
          })

          if (result.exitCode === 0) {
            if (jsonFlag) {
              console.log(JSON.stringify(result.data, null, 2))
            } else {
              console.log('Active Subscriptions:')
              result.data.forEach((sub: any, index: number) => {
                console.log(`${index + 1}. ${sub.subscriptionId}`)
                console.log(`   Generator: ${sub.alphaGeneratorAddress}`)
                console.log(`   Consumer: ${sub.alphaConsumerAddress}`)
                console.log(`   Expires: ${new Date(sub.expiresAt).toLocaleDateString()}`)
              })
              console.log(`\nTotal: ${result.data.length} active subscriptions`)
            }
          } else {
            console.error('❌ Error:', result.error)
            process.exit(1)
          }
        }
        break

      case 'check-expiry':
        {
          const result = await subscriptionManager.cli.checkExpiry()

          if (result.exitCode === 0) {
            console.log(`✅ Checked expiry: ${result.data.expiredCount} subscriptions expired`)
          } else {
            console.error('❌ Error:', result.error)
            process.exit(1)
          }
        }
        break

      case 'get':
        {
          const idIndex = args.indexOf('--id')
          if (idIndex === -1) {
            console.error('Error: --id is required')
            process.exit(1)
          }

          const subscriptionId = args[idIndex + 1]

          try {
            const subscription = await subscriptionManager.getSubscription(subscriptionId)
            console.log(JSON.stringify(subscription, null, 2))
          } catch (error: any) {
            console.error('❌ Error:', error.message)
            process.exit(1)
          }
        }
        break

      case 'revenue':
        {
          const generatorIndex = args.indexOf('--generator')
          if (generatorIndex === -1) {
            console.error('Error: --generator is required')
            process.exit(1)
          }

          const generatorAddress = args[generatorIndex + 1]

          try {
            const revenue = await subscriptionManager.calculateGeneratorRevenue(generatorAddress)
            const revenueInWei = BigInt(revenue)
            const revenueInEth = Number(revenueInWei) / 1e18
            console.log(`Total Revenue: ${revenue} wei`)
            console.log(`Total Revenue: ${revenueInEth.toFixed(6)} ETH`)
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