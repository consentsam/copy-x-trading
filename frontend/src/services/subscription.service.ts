import { writeContract, waitForTransactionReceipt, readContract } from '@wagmi/core'
import { config } from '../libs/wagmi-config'
import { apiClient } from '@/utils/api-client'
import { handleApiError, withRetry } from '@/utils/api-error-handler'
import { Subscription, TradeConfirmation, RegisterSubscriptionInput } from '@/types/alphaengine'
import {
  ALPHAENGINE_ABI,
  ALPHAENGINE_CONTRACT_ADDRESS,
  strategyIdToBytes32
} from '@/contracts/AlphaEngineABI'
import { showContractError, showContractSuccess, showContractPending, dismissAllToasts, getContractErrorMessage } from '@/utils/contract-error-handler'

/**
 * Subscription Service
 * Handles on-chain subscriptions and backend registration
 */

/**
 * Subscribe to a strategy on-chain
 */
export async function subscribeOnChain(args: {
  strategyId: string;
  subscriptionFeeWei: bigint;
}): Promise<`0x${string}`> {
  try {
    // Convert strategy ID to bytes32
    const strategyIdHex = strategyIdToBytes32(args.strategyId);

    // Show pending notification
    showContractPending('Please confirm the subscription in your wallet...');

    // Execute the on-chain subscription
    const hash = await writeContract(config, {
      address: ALPHAENGINE_CONTRACT_ADDRESS,
      abi: ALPHAENGINE_ABI,
      functionName: 'subscribeToStrategy',
      args: [strategyIdHex],
      value: args.subscriptionFeeWei,
    });

    // Update notification for pending transaction
    dismissAllToasts();
    showContractPending(`Transaction submitted: ${hash.slice(0, 10)}...${hash.slice(-8)}`);

    // Wait for transaction confirmation
    const receipt = await waitForTransactionReceipt(config, {
      hash,
      confirmations: 2, // Wait for 2 confirmations for safety
    });

    if (receipt.status === 'reverted') {
      dismissAllToasts();
      showContractError(new Error('Transaction reverted. Please check your balance and try again.'));
      throw new Error('Transaction reverted. Please check your balance and try again.');
    }

    // Show success notification
    dismissAllToasts();
    showContractSuccess('Successfully subscribed to strategy!', hash);

    return hash;
  } catch (error: unknown) {
    dismissAllToasts();
    showContractError(error);

    // Check if this is a user rejection - if so, don't re-throw
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
      // User cancelled - this is a normal flow, not an error
      return '0x0' as `0x${string}`; // Return a null hash to indicate cancellation
    }

    // Re-throw other errors with user-friendly message
    throw new Error(getContractErrorMessage(error));
  }
}

/**
 * Register subscription with backend after on-chain confirmation
 */
export const registerSubscription = async (
  strategyId: string,
  alphaConsumerAddress: string,
  subscriptionTxHash: string
): Promise<Subscription> => {
  try {
    const data: RegisterSubscriptionInput = {
      strategyId,
      alphaConsumerAddress,
      subscriptionTxHash,
    };
    
    return await withRetry(() =>
      apiClient.post<Subscription>(`/api/v1/strategies/${strategyId}/subscribe`, data)
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Get pending trades for a consumer
 */
export const getConsumerPendingTrades = async (
  alphaConsumerAddress: string
): Promise<TradeConfirmation[]> => {
  try {
    return await withRetry(() =>
      apiClient.get<TradeConfirmation[]>('/api/consumer/pending-trades', {
        params: { alphaConsumerAddress }
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Check if user is subscribed to a strategy on-chain
 */
export const checkSubscriptionOnChain = async (
  subscriberAddress: string,
  strategyId: string
): Promise<{
  subscriptionId: bigint;
  isActive: boolean;
  subscribedAt: bigint;
  subscriptionFee: bigint;
}> => {
  try {
    const strategyIdHex = strategyIdToBytes32(strategyId);
    
    const result = await readContract(config, {
      address: ALPHAENGINE_CONTRACT_ADDRESS,
      abi: ALPHAENGINE_ABI,
      functionName: 'getSubscription',
      args: [subscriberAddress as `0x${string}`, strategyIdHex],
    });
    
    return {
      subscriptionId: result[0] as bigint,
      isActive: result[1] as boolean,
      subscribedAt: result[2] as bigint,
      subscriptionFee: result[3] as bigint,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Unsubscribe from a strategy
 */
export const unsubscribeFromStrategy = async (
  strategyId: string
): Promise<`0x${string}`> => {
  try {
    const strategyIdHex = strategyIdToBytes32(strategyId);

    // Show pending notification
    showContractPending('Please confirm the unsubscription in your wallet...');

    const hash = await writeContract(config, {
      address: ALPHAENGINE_CONTRACT_ADDRESS,
      abi: ALPHAENGINE_ABI,
      functionName: 'unsubscribeFromStrategy',
      args: [strategyIdHex],
    });

    // Update notification for pending transaction
    dismissAllToasts();
    showContractPending(`Transaction submitted: ${hash.slice(0, 10)}...${hash.slice(-8)}`);

    await waitForTransactionReceipt(config, {
      hash,
      confirmations: 2,
    });

    // Show success notification
    dismissAllToasts();
    showContractSuccess('Successfully unsubscribed from strategy!', hash);

    return hash;
  } catch (error: unknown) {
    dismissAllToasts();
    showContractError(error);

    // Check if this is a user rejection - if so, don't re-throw
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
      // User cancelled - this is a normal flow, not an error
      return '0x0' as `0x${string}`; // Return a null hash to indicate cancellation
    }

    // Re-throw other errors with user-friendly message
    throw new Error(getContractErrorMessage(error));
  }
}

/**
 * Get all strategies a user is subscribed to
 */
export const getSubscriberStrategies = async (
  subscriberAddress: string
): Promise<string[]> => {
  try {
    const result = await readContract(config, {
      address: ALPHAENGINE_CONTRACT_ADDRESS,
      abi: ALPHAENGINE_ABI,
      functionName: 'getSubscriberStrategies',
      args: [subscriberAddress as `0x${string}`],
    });
    
    // Convert bytes32 array back to strategy IDs
    return (result as `0x${string}`[]).map(hex => hex);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Export the service as a namespace for better organization
 */
export const subscriptionService = {
  subscribeOnChain,
  registerSubscription,
  getConsumerPendingTrades,
  checkSubscriptionOnChain,
  unsubscribeFromStrategy,
  getSubscriberStrategies,
};