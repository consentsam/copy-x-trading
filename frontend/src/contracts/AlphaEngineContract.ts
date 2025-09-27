import AlphaEngineABI from './AlphaEngineSubscription.abi.json';
import { parseEther } from 'viem';

// Contract address (deployed to Anvil)
export const ALPHA_ENGINE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}` || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// Contract ABI
export const ALPHA_ENGINE_ABI = AlphaEngineABI as readonly unknown[];

// Helper function to format subscription fee (convert ETH to Wei)
export const formatSubscriptionFee = (ethAmount: string): bigint => {
  return parseEther(ethAmount);
};

// Helper function to format performance fee (percentage to basis points)
// 1% = 100 basis points
export const formatPerformanceFee = (percentage: number): bigint => {
  return BigInt(Math.floor(percentage * 100));
};

// Utility function to parse generator registration tuple
export const parseGeneratorRegistration = (data: readonly unknown[] | undefined): {
  isActive: boolean;
  address?: string;
  subscriptionFee?: bigint;
  performanceFee?: bigint;
} => {
  if (!data || !Array.isArray(data)) {
    return { isActive: false };
  }

  const [address, subscriptionFee, performanceFee, isActive] = data as [string, bigint, bigint, boolean];
  return {
    isActive: Boolean(isActive),
    address,
    subscriptionFee,
    performanceFee
  };
};

// Contract read functions
export const contractReads = {
  // Check if an address is registered as a generator
  isGeneratorRegistered: (address: string) => ({
    address: ALPHA_ENGINE_CONTRACT_ADDRESS,
    abi: ALPHA_ENGINE_ABI,
    functionName: 'generators',
    args: [address],
  }),

  // Get minimum subscription fee
  getMinSubscriptionFee: () => ({
    address: ALPHA_ENGINE_CONTRACT_ADDRESS,
    abi: ALPHA_ENGINE_ABI,
    functionName: 'MIN_SUBSCRIPTION_FEE',
  }),

  // Get maximum performance fee
  getMaxPerformanceFee: () => ({
    address: ALPHA_ENGINE_CONTRACT_ADDRESS,
    abi: ALPHA_ENGINE_ABI,
    functionName: 'MAX_PERFORMANCE_FEE',
  }),
};

// Contract write functions
export const contractWrites = {
  // Register as an AlphaGenerator
  registerGenerator: (subscriptionFee: bigint, performanceFee: bigint) => ({
    address: ALPHA_ENGINE_CONTRACT_ADDRESS,
    abi: ALPHA_ENGINE_ABI,
    functionName: 'registerGenerator',
    args: [subscriptionFee, performanceFee],
  }),

  // Update generator fees
  updateGeneratorFees: (subscriptionFee: bigint, performanceFee: bigint) => ({
    address: ALPHA_ENGINE_CONTRACT_ADDRESS,
    abi: ALPHA_ENGINE_ABI,
    functionName: 'updateGeneratorFees',
    args: [subscriptionFee, performanceFee],
  }),
};