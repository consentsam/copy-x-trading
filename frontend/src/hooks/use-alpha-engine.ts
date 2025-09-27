import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseEther, Address } from 'viem';
import { alphaEngineClient, type AlphaGenerator } from '@/utils/alphaengine-client';
import { ALPHAENGINE_ABI, ALPHAENGINE_CONTRACT_ADDRESS } from '@/contracts/AlphaEngine';
import { toast } from 'react-toastify';
import { showContractError, showContractSuccess, showContractPending, dismissAllToasts } from '@/utils/contract-error-handler';
import { currentChain } from '../libs/wagmi-config';
import { type NotificationEvent } from '@/types/alpha-engine';

// Mock FhenixClient for now to avoid build issues
interface MockFhenixClient {
  encrypt: (value: unknown) => Promise<string>;
}

export interface UseAlphaEngineReturn {
  // State
  isSubscribing: boolean;
  isRegistering: boolean;
  encryptedAddress: string | null;
  subscriptionStatus: 'idle' | 'encrypting' | 'signing' | 'confirming' | 'completed' | 'error';

  // Methods
  subscribeToGenerator: (generator: AlphaGenerator) => Promise<void>;
  registerAsGenerator: (fee: string, performanceFee: number) => Promise<void>;
  verifySubscription: (generatorAddress: string) => Promise<boolean>;
  getEncryptedSubscribers: (generatorAddress: string) => Promise<string[]>;

  // Contract state
  contractWrite: ReturnType<typeof useWriteContract>;
  transactionReceipt: ReturnType<typeof useWaitForTransactionReceipt>;
}

export function useAlphaEngine(): UseAlphaEngineReturn {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [encryptedAddress, setEncryptedAddress] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<UseAlphaEngineReturn['subscriptionStatus']>('idle');
  const [fhenixClient, setFhenixClient] = useState<MockFhenixClient | null>(null);

  const contractWrite = useWriteContract();
  const transactionReceipt = useWaitForTransactionReceipt({
    hash: contractWrite.data,
  });

  const handleTransactionSuccess = useCallback(async () => {
    console.log('[handleTransactionSuccess] Called with:', {
      hash: contractWrite.data,
      userAddress: userAddress,
      variables: contractWrite.variables
    });

    if (!contractWrite.data || !userAddress) {
      console.log('[handleTransactionSuccess] Missing data or address, returning');
      return;
    }

    try {
      // Get the function name from contract write context
      const functionName = contractWrite.variables?.functionName;
      console.log('[handleTransactionSuccess] Function name:', functionName);

      if (functionName === 'subscribe') {
        // Register subscription with backend
        const generatorAddress = contractWrite.variables?.args?.[0] as string;
        console.log('[handleTransactionSuccess] Registering with backend:', {
          generatorAddress,
          userAddress,
          txHash: contractWrite.data
        });

        await alphaEngineClient.subscribeToGenerator(
          generatorAddress,
          userAddress,
          contractWrite.data
        );

        console.log('[handleTransactionSuccess] Backend registration successful');
        dismissAllToasts();
        showContractSuccess('Successfully subscribed to generator!', contractWrite.data);
        setSubscriptionStatus('completed');
      } else if (functionName === 'registerGenerator') {
        // Register generator with backend
        await alphaEngineClient.registerGenerator({
          walletAddress: userAddress,
          subscriptionFee: contractWrite.variables?.args?.[0] as string,
          performanceFee: contractWrite.variables?.args?.[1] as number,
        });
        dismissAllToasts();
        showContractSuccess('Successfully registered as generator!', contractWrite.data);
      }
    } catch (error) {
      console.error('[handleTransactionSuccess] Post-transaction error:', error);
      dismissAllToasts();
      showContractError(new Error('Transaction succeeded but backend sync failed'));
    } finally {
      console.log('[handleTransactionSuccess] Cleanup - resetting flags');
      setIsSubscribing(false);
      setIsRegistering(false);
    }
  }, [contractWrite.data, userAddress, contractWrite.variables]);

  // Initialize FHE client
  useEffect(() => {
    const initializeFhenixClient = async () => {
      // Only attempt to load FHE in browser environment
      if (typeof window === 'undefined') return;

      try {
        // Dynamic import the FHE service
        const { createFHEClient } = await import('@/services/fhe.service');

        // Create mock FHE client (real implementation will be added later)
        const client = await createFHEClient(null, null, 'MOCK');
        setFhenixClient(client);
        console.log('[FHEClient] Initialized mock FHE client successfully');
      } catch (error) {
        console.error('[FHEClient] Failed to initialize FHE client:', error);
        // Don't throw - the service will fall back to mock client
        console.log('[FHEClient] Continuing with mock FHE client');
      }
    };

    initializeFhenixClient();
  }, []);

  // Handle contract write state changes
  useEffect(() => {
    console.log('[Contract Write] Status changed:', {
      status: contractWrite.status,
      hash: contractWrite.data,
      isLoading: contractWrite.isPending,
      isSuccess: contractWrite.isSuccess,
      isError: contractWrite.isError,
      error: contractWrite.error
    });

    if (contractWrite.isError) {
      console.error('[Contract Write] Error:', contractWrite.error);
      setSubscriptionStatus('error');
      setIsSubscribing(false);
      dismissAllToasts();
      showContractError(contractWrite.error);
    }
  }, [contractWrite.status, contractWrite.data, contractWrite.isError, contractWrite.error, contractWrite.isPending, contractWrite.isSuccess]);

  // Handle transaction completion
  useEffect(() => {
    console.log('[Transaction] Transaction status:', {
      hash: contractWrite.data,
      isPending: transactionReceipt.isPending,
      isLoading: transactionReceipt.isPending,
      isSuccess: transactionReceipt.isSuccess,
      isError: transactionReceipt.isError,
      error: transactionReceipt.error,
      receipt: transactionReceipt.data
    });

    if (transactionReceipt.isSuccess && contractWrite.data) {
      console.log('[Transaction] Success! Calling handleTransactionSuccess');
      handleTransactionSuccess();
    }

    if (transactionReceipt.isError) {
      console.error('[Transaction] Error waiting for receipt:', transactionReceipt.error);
      setSubscriptionStatus('error');
      setIsSubscribing(false);
      dismissAllToasts();
      showContractError(new Error('Transaction failed to confirm'));
    }
  }, [transactionReceipt.isSuccess, transactionReceipt.isError, transactionReceipt.isPending, contractWrite.data, handleTransactionSuccess, transactionReceipt.data, transactionReceipt.error]);

  /**
   * Subscribe to an alpha generator
   */
  const subscribeToGenerator = useCallback(async (generator: AlphaGenerator) => {
    console.log('[Subscribe] Starting subscription process');
    console.log('[Subscribe] isConnected:', isConnected);
    console.log('[Subscribe] userAddress:', userAddress);
    console.log('[Subscribe] fhenixClient:', !!fhenixClient);
    console.log('[Subscribe] chainId:', chainId);
    console.log('[Subscribe] currentChain.id:', currentChain.id);

    if (!isConnected || !userAddress || !fhenixClient) {
      console.error('[Subscribe] Missing requirements:', {
        isConnected,
        userAddress,
        hasFhenixClient: !!fhenixClient
      });
      showContractError(new Error('Please connect your wallet'));
      return;
    }

    // Check if on correct network
    if (chainId !== currentChain.id) {
      console.error('[Subscribe] Wrong network:', {
        currentChainId: chainId,
        expectedChainId: currentChain.id
      });
      showContractError(new Error(`Please switch to ${currentChain.name} network first`));
      return;
    }

    try {
      setIsSubscribing(true);
      setSubscriptionStatus('encrypting');

      // Step 1: Encrypt user address for this generator
      const encrypted = await fhenixClient.encrypt(
        userAddress as string
      );

      // Extract encrypted data (mock returns string directly)
      const encryptedData = encrypted;
      setEncryptedAddress(encryptedData);

      // Step 2: Call smart contract
      setSubscriptionStatus('signing');

      // Ensure subscription fee is properly formatted for parseEther
      let subscriptionFeeEth: string;
      try {
        // Convert to string if not already, handle decimal values properly
        const feeStr = String(generator.subscriptionFee);

        // Check if it's already a valid ETH string (no conversion needed)
        if (feeStr && !isNaN(Number(feeStr))) {
          subscriptionFeeEth = feeStr;
        } else {
          // Fallback to "0" if invalid
          subscriptionFeeEth = "0";
          console.warn('[Subscribe] Invalid subscription fee value, using 0:', generator.subscriptionFee);
        }
      } catch (error) {
        console.error('[Subscribe] Error processing subscription fee:', error);
        subscriptionFeeEth = "0";
      }

      console.log('[Subscribe] Processing subscription with fee:', subscriptionFeeEth, 'ETH');
      console.log('[Subscribe] Contract details:', {
        address: ALPHAENGINE_CONTRACT_ADDRESS,
        functionName: 'subscribe',
        generatorAddress: generator.walletAddress,
        encryptedData: encryptedData,
        value: parseEther(subscriptionFeeEth).toString()
      });

      console.log('[Subscribe] Calling writeContract...');

      // writeContract doesn't return the hash immediately, it updates contractWrite.data
      // Wrap in try-catch to handle synchronous errors
      try {
        await contractWrite.writeContractAsync({
          address: ALPHAENGINE_CONTRACT_ADDRESS,
          abi: ALPHAENGINE_ABI,
          functionName: 'subscribe',
          args: [generator.walletAddress as Address, encryptedData as `0x${string}`],
          value: parseEther(subscriptionFeeEth),
        });

        // The transaction hash will be available in contractWrite.data after user confirms in wallet
        setSubscriptionStatus('confirming');
        showContractPending('Please confirm the transaction in your wallet...');
        console.log('[Subscribe] Transaction request sent to wallet, waiting for confirmation...');
      } catch (writeError: unknown) {
        // Check if it's a user rejection
        const errorMessage = writeError instanceof Error ? writeError.message.toLowerCase() : '';
        if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
          console.log('[Subscribe] User rejected transaction');
          dismissAllToasts();
          showContractError(writeError);
          setSubscriptionStatus('idle');
          setIsSubscribing(false);
          return; // Exit early for user cancellation - don't throw
        }
        // Re-throw other errors to be caught by outer try-catch
        throw writeError;
      }
    } catch (error: unknown) {
      console.error('Subscription error:', error);
      dismissAllToasts();
      showContractError(error);
      setSubscriptionStatus('error');
      setIsSubscribing(false);
    }
  }, [isConnected, userAddress, fhenixClient, contractWrite, chainId]);

  /**
   * Register as an alpha generator
   */
  const registerAsGenerator = useCallback(async (
    subscriptionFee: string,
    performanceFee: number
  ) => {
    if (!isConnected || !userAddress) {
      showContractError(new Error('Please connect your wallet'));
      return;
    }

    // Check if on correct network
    if (chainId !== currentChain.id) {
      showContractError(new Error(`Please switch to ${currentChain.name} network first`));
      return;
    }

    try {
      setIsRegistering(true);
      showContractPending('Please confirm the registration in your wallet...');

      try {
        await contractWrite.writeContractAsync({
          address: ALPHAENGINE_CONTRACT_ADDRESS,
          abi: ALPHAENGINE_ABI,
          functionName: 'registerGenerator',
          args: [parseEther(subscriptionFee), BigInt(performanceFee)],
        });
      } catch (writeError: unknown) {
        // Check if it's a user rejection
        const errorMessage = writeError instanceof Error ? writeError.message.toLowerCase() : '';
        if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
          console.log('[Register] User rejected transaction');
          dismissAllToasts();
          showContractError(writeError);
          setIsRegistering(false);
          return; // Exit early for user cancellation - don't throw
        }
        // Re-throw other errors to be caught by outer try-catch
        throw writeError;
      }
    } catch (error: unknown) {
      console.error('Registration error:', error);
      dismissAllToasts();
      showContractError(error);
      setIsRegistering(false);
    }
  }, [isConnected, userAddress, contractWrite, chainId]);

  /**
   * Verify subscription status on-chain
   */
  const verifySubscription = useCallback(async (generatorAddress: string): Promise<boolean> => {
    if (!userAddress || !fhenixClient) return false;

    try {
      // First check with backend
      const response = await alphaEngineClient.verifySubscription(userAddress, generatorAddress);

      if (!response.isSubscribed) return false;

      // Optionally verify on-chain
      // This would require calling the smart contract's isSubscribed function
      // with the encrypted address

      return true;
    } catch (error) {
      console.error('Verification error:', error);
      return false;
    }
  }, [userAddress, fhenixClient]);

  /**
   * Get encrypted subscribers for a generator
   */
  const getEncryptedSubscribers = useCallback(async (generatorAddress: string): Promise<string[]> => {
    try {
      const response = await alphaEngineClient.getGeneratorSubscriptions(generatorAddress);
      return response
        .filter(sub => sub.encryptedConsumerAddress)
        .map(sub => sub.encryptedConsumerAddress as string);
    } catch (error) {
      console.error('Failed to fetch subscribers:', error);
      return [];
    }
  }, []);

  return {
    isSubscribing,
    isRegistering,
    encryptedAddress,
    subscriptionStatus,
    subscribeToGenerator,
    registerAsGenerator,
    verifySubscription,
    getEncryptedSubscribers,
    contractWrite,
    transactionReceipt,
  };
}

/**
 * Hook to manage real-time notifications
 */
export function useTradeNotifications(consumerAddress?: string) {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!consumerAddress) return;

    const eventSource = alphaEngineClient.createNotificationStream(consumerAddress);

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('SSE connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setNotifications(prev => [data, ...prev].slice(0, 50)); // Keep last 50

        // Show toast for new trades
        if (data.type === 'NEW_TRADE') {
          toast.success('New trade alert from your generator!');
        }
      } catch (error) {
        console.error('Failed to parse notification:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      console.error('SSE connection error');
    };

    return () => {
      eventSource.close();
    };
  }, [consumerAddress]);

  return {
    notifications,
    isConnected,
  };
}