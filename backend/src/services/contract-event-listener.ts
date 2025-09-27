/**
 * @file contract-event-listener.ts
 * @description Service to listen for smart contract events and sync with database
 */

import { ethers } from 'ethers'
import { subscriptionManager } from '../libraries/subscription-manager'

// AlphaEngine Subscription Contract ABI (minimal for events)
const ALPHA_ENGINE_ABI = [
  'event SubscriptionCreated(address indexed generator, bytes encryptedSubscriber, uint256 timestamp)',
  'event SubscriptionCancelled(address indexed generator, bytes encryptedSubscriber, uint256 timestamp)',
  'event GeneratorRegistered(address indexed generator, uint256 subscriptionFee, uint256 performanceFee)'
]

export interface ContractEventListenerConfig {
  rpcUrl: string
  contractAddress: string
  fromBlock?: number | 'latest'
}

export class ContractEventListener {
  private provider: ethers.JsonRpcProvider
  private contract: ethers.Contract
  private isListening: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 10
  private connectionCheckInterval: NodeJS.Timeout | null = null

  constructor(private config: ContractEventListenerConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
    this.contract = new ethers.Contract(
      config.contractAddress,
      ALPHA_ENGINE_ABI,
      this.provider
    )
  }

  /**
   * Start listening for contract events
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      console.log('Event listener is already running')
      return
    }

    console.log(`[EventListener] Starting to listen for events on contract: ${this.config.contractAddress}`)

    try {
      // Listen for SubscriptionCreated events
      this.contract.on('SubscriptionCreated', async (generator, encryptedSubscriber, timestamp, event) => {
        await this.handleSubscriptionCreated(generator, encryptedSubscriber, timestamp, event)
      })

      // Listen for SubscriptionCancelled events
      this.contract.on('SubscriptionCancelled', async (generator, encryptedSubscriber, timestamp, event) => {
        await this.handleSubscriptionCancelled(generator, encryptedSubscriber, timestamp, event)
      })

      // Listen for GeneratorRegistered events
      this.contract.on('GeneratorRegistered', async (generator, subscriptionFee, performanceFee, event) => {
        await this.handleGeneratorRegistered(generator, subscriptionFee, performanceFee, event)
      })

      this.isListening = true
      console.log('[EventListener] Successfully started listening for contract events')

      // Start connection monitoring
      this.startConnectionMonitor()

    } catch (error: any) {
      console.error('[EventListener] Failed to start listening:', error.message)
      throw error
    }
  }

  /**
   * Stop listening for contract events
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) {
      console.log('Event listener is not running')
      return
    }

    console.log('[EventListener] Stopping event listener...')

    try {
      // Remove all listeners
      this.contract.removeAllListeners()
      this.isListening = false

      // Stop connection monitor
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval)
        this.connectionCheckInterval = null
      }

      console.log('[EventListener] Successfully stopped listening for contract events')
    } catch (error: any) {
      console.error('[EventListener] Error stopping event listener:', error.message)
      throw error
    }
  }

  /**
   * Handle SubscriptionCreated event
   */
  private async handleSubscriptionCreated(
    generator: string,
    encryptedSubscriber: string,
    timestamp: bigint,
    event: ethers.Log
  ): Promise<void> {
    console.log('[EventListener] SubscriptionCreated event received:', {
      generator,
      encryptedSubscriber: encryptedSubscriber.slice(0, 20) + '...',
      timestamp: timestamp.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    })

    try {
      // Get transaction to find the real sender address and fee amount
      const tx = await this.provider.getTransaction(event.transactionHash)
      const consumerAddress = tx?.from || 'unknown'
      const feeAmount = tx?.value?.toString() || '0' // Extract the ETH value sent with the transaction

      console.log('[EventListener] Transaction details:', {
        sender: consumerAddress,
        feeAmount: feeAmount + ' wei'
      })

      // Save to database via subscription manager
      await subscriptionManager.createFromBlockchainEvent({
        generatorAddress: generator.toLowerCase(),
        consumerAddress: consumerAddress.toLowerCase(),
        subscriptionTxHash: event.transactionHash,
        encryptedConsumerAddress: encryptedSubscriber,
        timestamp: new Date(Number(timestamp) * 1000),
        blockNumber: event.blockNumber,
        feeAmount // Pass the fee amount for revenue calculations
      })

      console.log('[EventListener] ✅ Subscription persisted to database')

      // Still emit event for any other services that might be listening
      subscriptionManager.emit('contract:subscription-created', {
        generatorAddress: generator,
        encryptedConsumerAddress: encryptedSubscriber,
        timestamp: new Date(Number(timestamp) * 1000),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      })

    } catch (error: any) {
      console.error('[EventListener] ❌ Failed to persist subscription:', error.message)
      // Could implement retry queue here in the future
    }
  }

  /**
   * Handle SubscriptionCancelled event
   */
  private async handleSubscriptionCancelled(
    generator: string,
    encryptedSubscriber: string,
    timestamp: bigint,
    event: ethers.Log
  ): Promise<void> {
    console.log('[EventListener] SubscriptionCancelled event received:', {
      generator,
      encryptedSubscriber: encryptedSubscriber.slice(0, 20) + '...',
      timestamp: timestamp.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    })

    try {
      // Emit event for any other services that might be listening
      subscriptionManager.emit('contract:subscription-cancelled', {
        generatorAddress: generator,
        encryptedConsumerAddress: encryptedSubscriber,
        timestamp: new Date(Number(timestamp) * 1000),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      })

      console.log('[EventListener] SubscriptionCancelled event logged successfully')

    } catch (error: any) {
      console.error('[EventListener] Error handling SubscriptionCancelled event:', error.message)
    }
  }

  /**
   * Handle GeneratorRegistered event
   */
  private async handleGeneratorRegistered(
    generator: string,
    subscriptionFee: bigint,
    performanceFee: bigint,
    event: ethers.Log
  ): Promise<void> {
    console.log('[EventListener] GeneratorRegistered event received:', {
      generator,
      subscriptionFee: subscriptionFee.toString(),
      performanceFee: performanceFee.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    })

    try {
      // Emit event for any other services that might be listening
      subscriptionManager.emit('contract:generator-registered', {
        generatorAddress: generator,
        subscriptionFee: subscriptionFee.toString(),
        performanceFee: Number(performanceFee),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      })

      console.log('[EventListener] GeneratorRegistered event logged successfully')

    } catch (error: any) {
      console.error('[EventListener] Error handling GeneratorRegistered event:', error.message)
    }
  }

  /**
   * Get historical events from a specific block range
   */
  async getHistoricalEvents(fromBlock: number, toBlock: number | 'latest' = 'latest'): Promise<void> {
    console.log(`[EventListener] Fetching historical events from block ${fromBlock} to ${toBlock}`)

    try {
      // Get SubscriptionCreated events
      const subscriptionEvents = await this.contract.queryFilter(
        this.contract.filters.SubscriptionCreated(),
        fromBlock,
        toBlock
      )

      console.log(`[EventListener] Found ${subscriptionEvents.length} SubscriptionCreated events`)

      // Process each event
      for (const event of subscriptionEvents) {
        if (event.args) {
          await this.handleSubscriptionCreated(
            event.args.generator,
            event.args.encryptedSubscriber,
            event.args.timestamp,
            event
          )
        }
      }

      // Get SubscriptionCancelled events
      const cancelledEvents = await this.contract.queryFilter(
        this.contract.filters.SubscriptionCancelled(),
        fromBlock,
        toBlock
      )

      console.log(`[EventListener] Found ${cancelledEvents.length} SubscriptionCancelled events`)

      // Process each event
      for (const event of cancelledEvents) {
        if (event.args) {
          await this.handleSubscriptionCancelled(
            event.args.generator,
            event.args.encryptedSubscriber,
            event.args.timestamp,
            event
          )
        }
      }

      console.log('[EventListener] Historical events processing completed')

    } catch (error: any) {
      console.error('[EventListener] Error fetching historical events:', error.message)
      throw error
    }
  }

  /**
   * Check if the listener is currently running
   */
  isRunning(): boolean {
    return this.isListening
  }

  /**
   * Start monitoring the connection health
   */
  private startConnectionMonitor(): void {
    this.connectionCheckInterval = setInterval(async () => {
      try {
        await this.provider.getBlockNumber()
        this.reconnectAttempts = 0 // Reset on successful connection
      } catch (error) {
        console.log('[EventListener] Connection lost, attempting reconnect...')
        await this.handleReconnect()
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[EventListener] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)

    console.log(`[EventListener] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)
    await new Promise(resolve => setTimeout(resolve, delay))

    try {
      // Create new provider
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl)
      this.contract = new ethers.Contract(
        this.config.contractAddress,
        ALPHA_ENGINE_ABI,
        this.provider
      )

      // Remove old listeners first
      this.contract.removeAllListeners()

      // Re-establish listeners
      this.contract.on('SubscriptionCreated', async (generator, encryptedSubscriber, timestamp, event) => {
        await this.handleSubscriptionCreated(generator, encryptedSubscriber, timestamp, event)
      })

      this.contract.on('SubscriptionCancelled', async (generator, encryptedSubscriber, timestamp, event) => {
        await this.handleSubscriptionCancelled(generator, encryptedSubscriber, timestamp, event)
      })

      this.contract.on('GeneratorRegistered', async (generator, subscriptionFee, performanceFee, event) => {
        await this.handleGeneratorRegistered(generator, subscriptionFee, performanceFee, event)
      })

      console.log('[EventListener] ✅ Reconnected successfully')
      this.reconnectAttempts = 0
    } catch (error: any) {
      console.error('[EventListener] Reconnection failed:', error.message)
    }
  }
}