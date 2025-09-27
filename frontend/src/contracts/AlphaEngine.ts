import { Address } from 'viem';

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

export const ALPHAENGINE_CONTRACT_ADDRESS: Address = (process.env.NEXT_PUBLIC_ALPHAENGINE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;

export const ALPHAENGINE_ABI = [
  {
    inputs: [
      { name: '_subscriptionFee', type: 'uint256' },
      { name: '_performanceFee', type: 'uint256' }
    ],
    name: 'registerGenerator',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_generator', type: 'address' },
      { name: '_encryptedAddress', type: 'bytes32' }  // FHE eaddress compiles to bytes32
    ],
    name: 'subscribe',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_generator', type: 'address' },
      { name: '_encryptedAddress', type: 'bytes32' }  // FHE eaddress compiles to bytes32
    ],
    name: 'unsubscribe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: '_generator', type: 'address' }],
    name: 'getEncryptedSubscribers',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: '_generator', type: 'address' },
      { name: '_encryptedAddress', type: 'bytes32' }
    ],
    name: 'isSubscribed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: '_executionData', type: 'bytes' },
      { name: '_gasEstimate', type: 'uint256' },
      { name: '_expiryMinutes', type: 'uint256' }
    ],
    name: 'proposeTrade',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_tradeId', type: 'bytes32' },
      { name: '_encryptedExecutor', type: 'bytes32' }
    ],
    name: 'executeTrade',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'generator', type: 'address' },
      { indexed: false, name: 'subscriptionFee', type: 'uint256' }
    ],
    name: 'GeneratorRegistered',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'generator', type: 'address' },
      { indexed: false, name: 'encryptedSubscriber', type: 'bytes32' },  // FHE eaddress compiles to bytes32
      { indexed: false, name: 'timestamp', type: 'uint256' }
    ],
    name: 'SubscriptionCreated',
    type: 'event'
  }
] as const;