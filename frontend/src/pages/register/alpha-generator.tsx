import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import {
  ALPHA_ENGINE_ABI,
  ALPHA_ENGINE_CONTRACT_ADDRESS,
  formatSubscriptionFee,
} from '@/contracts/AlphaEngineContract';
import { currentChain } from '@/libs/wagmi-config';
import { NetworkSwitcher } from '@/Components/NetworkSwitcher';
import { showContractError, showContractSuccess, showContractPending, dismissAllToasts } from '@/utils/contract-error-handler';

const REGISTRATION_STORAGE_KEY = 'alphaGeneratorRegistrationDraft';
const REGISTRATION_TX_KEY = 'alphaGeneratorLastTxHash';
const FALLBACK_TRANSACTION_HASH = `0x${'0'.repeat(64)}`;

type AlphaGeneratorRegistrationProps = {
  onRegistrationComplete?: () => void;
};

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  background: var(--color-background);
`;

const Title = styled.h1`
  font-size: 2.5rem;
  color: var(--color-text);
  margin-bottom: 2rem;
`;

const Form = styled.form`
  width: 100%;
  max-width: 600px;
  background: var(--color-surface);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  color: var(--color-text);
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 1rem;
  min-height: 100px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  &:disabled {
    background: var(--color-neutral-surface);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }
`;

const StatusMessage = styled.div<{ $type?: 'error' | 'success' | 'info' }>`
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  text-align: center;
  background: ${props =>
    props.$type === 'error' ? 'var(--color-error-surface)' :
    props.$type === 'success' ? 'var(--color-success-surface)' :
    'var(--color-info-surface)'};
  color: ${props =>
    props.$type === 'error' ? 'var(--color-error)' :
    props.$type === 'success' ? 'var(--color-success)' :
    'var(--color-info)'};
`;

const InfoBox = styled.div`
  background: var(--color-info-surface);
  color: var(--color-info);
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
`;

const LoadingSpinner = styled.div`
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 2rem auto;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const CheckingContainer = styled.div`
  text-align: center;
  padding: 4rem 2rem;
`;

export default function AlphaGeneratorRegistration({ onRegistrationComplete }: AlphaGeneratorRegistrationProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [subscriptionFee, setSubscriptionFee] = useState('0.01');
  // Performance fee removed - backend hard-codes to 0
  const [status, setStatus] = useState<'idle' | 'checking' | 'registering' | 'syncing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [isFormHydrated, setIsFormHydrated] = useState(false);
  const [hasAttemptedAutoSync, setHasAttemptedAutoSync] = useState(false);

  // Smart contract hooks
  const { writeContract, data: hash, isPending: isWriting, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash });

  // Check if generator is already registered on-chain
  const { data: generatorData, isLoading: isCheckingRegistration } = useReadContract({
    address: ALPHA_ENGINE_CONTRACT_ADDRESS,
    abi: ALPHA_ENGINE_ABI,
    functionName: 'generators',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      // Disable automatic refetching to prevent loops
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: Infinity,
      gcTime: Infinity,
    }
  });

  // Hydrate form fields from previous attempts so we can complete backend sync automatically.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedDraft = window.localStorage.getItem(REGISTRATION_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.displayName) {
          setDisplayName(parsed.displayName);
        }
        if (parsed.description) {
          setDescription(parsed.description);
        }
        if (parsed.subscriptionFee) {
          setSubscriptionFee(parsed.subscriptionFee);
        }
      }
    } catch (error) {
      console.error('[Registration] Failed to hydrate draft from storage:', error);
    } finally {
      setIsFormHydrated(true);
    }
  }, []);

  // Persist form fields so that we can resume backend sync if the user reloads mid-flow.
  useEffect(() => {
    if (!isFormHydrated || typeof window === 'undefined') return;
    try {
      const payload = JSON.stringify({ displayName, description, subscriptionFee });
      window.localStorage.setItem(REGISTRATION_STORAGE_KEY, payload);
    } catch (error) {
      console.error('[Registration] Failed to persist draft to storage:', error);
    }
  }, [displayName, description, subscriptionFee, isFormHydrated]);

  const syncWithBackend = useCallback(async (txHash?: string) => {
    if (!address) {
      console.warn('[Registration] Cannot sync without wallet address');
      return false;
    }

    const effectiveHash = txHash && txHash !== FALLBACK_TRANSACTION_HASH ? txHash : undefined;

    try {
      console.log('[Registration] Updating backend with transaction confirmation:', effectiveHash ?? 'not provided');
      setStatus('syncing');

      if (typeof window !== 'undefined' && effectiveHash) {
        window.localStorage.setItem(REGISTRATION_TX_KEY, effectiveHash);
      }

      // Update existing backend entry with confirmed status
      const response = await fetch('http://localhost:3001/api/v1/alpha-generators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          displayName: displayName || `Generator ${address.slice(0, 6)}...${address.slice(-4)}`,
          description: description || '',
          subscriptionFee: subscriptionFee, // Send in ETH format, not Wei
          transactionHash: effectiveHash,
          metadata: {
            displayName: displayName || `Generator ${address.slice(0, 6)}...${address.slice(-4)}`,
            walletAddress: address,
            subscriptionFee: subscriptionFee, // Keep consistent format
            verified: false,
            rating: 0,
            totalVolume: '0',
            blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : undefined,
            registrationStatus: 'confirmed', // Update to confirmed
            transactionHash: effectiveHash,
          },
        }),
      });

      if (response.ok) {
        console.log('[Registration] Successfully synced with backend');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(REGISTRATION_STORAGE_KEY);
          window.localStorage.removeItem(REGISTRATION_TX_KEY);
        }
        setStatus('success');
        setTimeout(() => {
          if (onRegistrationComplete) {
            onRegistrationComplete();
          } else {
            router.push('/alpha-generator/dashboard');
          }
        }, 2000);
        return true;
      }

      const error = await response.json();
      throw new Error(error.error || 'Failed to sync with backend');
    } catch (error) {
      console.error('[Registration] Backend sync error:', error);
      setStatus('error');
      setErrorMessage(`Backend sync failed: ${error instanceof Error ? error.message : 'Unknown error'}. Your on-chain registration is complete.`);
      return false;
    }
  }, [address, description, displayName, onRegistrationComplete, receipt?.blockNumber, router, subscriptionFee]);

  const checkBackendSync = useCallback(async () => {
    if (!address || !isFormHydrated) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/v1/alpha-generators?address=${address.toLowerCase()}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          console.log('[Registration] Already registered in backend, redirecting to dashboard');
          if (onRegistrationComplete) {
            onRegistrationComplete();
          } else {
            router.push('/alpha-generator/dashboard');
          }
          return;
        }

        if (!hasAttemptedAutoSync) {
          setHasAttemptedAutoSync(true);
          const storedHash =
            typeof window !== 'undefined' ? window.localStorage.getItem(REGISTRATION_TX_KEY) || undefined : undefined;
          await syncWithBackend(storedHash || hash);
          return;
        }

        setStatus('error');
        setErrorMessage('We detected your on-chain registration but could not sync with the backend automatically. Please retry the registration process.');
        return;
      }

      throw new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      console.error('[Registration] Error checking backend sync:', error);
      setStatus('error');
      setErrorMessage('Failed to check registration status');
    }
  }, [address, hash, hasAttemptedAutoSync, isFormHydrated, onRegistrationComplete, router, syncWithBackend]);

  // Check registration status on mount
  useEffect(() => {
    if (!isFormHydrated) return;
    if (generatorData && address) {
      const [genAddress, subFee, _perfFee, isActive] = generatorData as [string, bigint, bigint, boolean];
      console.log('[Registration] On-chain generator data:', {
        address: genAddress,
        subscriptionFee: subFee?.toString(),
        // performanceFee removed - backend ignores this field
        isActive
      });

      if (isActive) {
        setIsAlreadyRegistered(true);
        setStatus('checking');
        checkBackendSync();
      }
    }
  }, [generatorData, address, isFormHydrated, checkBackendSync]);

  // Handle transaction confirmation and backend sync
  useEffect(() => {
    if (isConfirmed && receipt) {
      console.log('[Registration] Transaction confirmed:', receipt.transactionHash);
      dismissAllToasts();
      showContractSuccess('Registration successful on blockchain!', receipt.transactionHash);
      syncWithBackend(receipt.transactionHash);
    }
  }, [isConfirmed, receipt, syncWithBackend]);

  // Handle transaction hash creation (transaction submitted)
  useEffect(() => {
    if (hash) {
      console.log('[Registration] Transaction submitted:', hash);
      dismissAllToasts();
      showContractPending(`Transaction submitted: ${hash.slice(0, 10)}...${hash.slice(-8)}`);
    }
  }, [hash]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      console.error('[Registration] Contract write error:', writeError);
      dismissAllToasts();
      showContractError(writeError);
      setStatus('error');
      const errorMsg = writeError.message || 'Failed to register on blockchain';
      setErrorMessage(errorMsg);

      // Clean up pending registration from backend on contract failure
      if (address) {
        fetch(`http://localhost:3001/api/v1/alpha-generators/${address}`, {
          method: 'DELETE',
        }).catch(cleanupError => {
          console.error('[Registration] Failed to cleanup backend:', cleanupError);
        });
      }
    }
  }, [writeError, address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !isConnected) {
      setStatus('error');
      setErrorMessage('Please connect your wallet first');
      return;
    }

    // Check if on correct network
    if (chainId !== currentChain.id) {
      setStatus('error');
      setErrorMessage(`Please switch to ${currentChain.name} network first`);
      return;
    }

    // Validate inputs
    const subFee = parseFloat(subscriptionFee);
    const perfFee = 0;
    // Performance fee is hard-coded to 0 in backend

    if (subFee < 0.001) {
      setStatus('error');
      setErrorMessage('Subscription fee must be at least 0.001 ETH');
      return;
    }

    if (perfFee < 0 || perfFee > 30) {
      setStatus('error');
      setErrorMessage('Performance fee must be between 0% and 30%');
      return;
    }

    setStatus('registering');
    setErrorMessage('');
    setHasAttemptedAutoSync(false);

    try {
      // Convert to contract parameters
      const subscriptionFeeWei = formatSubscriptionFee(subscriptionFee);
      // Performance fee hard-coded to 0 (0 basis points)

      console.log('[Registration] Calling registerGenerator with:', {
        subscriptionFee: subscriptionFeeWei.toString(),
        performanceFee: '0', // Hard-coded to 0
      });

      // FIRST: Save to backend with pending status
      const backendResponse = await fetch('http://localhost:3001/api/v1/alpha-generators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          displayName: displayName || `Generator ${address.slice(0, 6)}...${address.slice(-4)}`,
          description: description || '',
          subscriptionFee: subscriptionFee, // Send in ETH format, not Wei
          metadata: {
            displayName: displayName || `Generator ${address.slice(0, 6)}...${address.slice(-4)}`,
            walletAddress: address,
            subscriptionFee: subscriptionFee, // Keep consistent format
            verified: false,
            rating: 0,
            totalVolume: '0',
            registrationStatus: 'pending', // Mark as pending until blockchain confirms
          },
        }),
      });

      if (!backendResponse.ok) {
        const error = await backendResponse.json();
        throw new Error(error.error || 'Failed to save registration data');
      }

      console.log('[Registration] Saved to backend with pending status');

      // THEN: Call smart contract with proper error handling
      try {
        // Show pending notification
        showContractPending('Please confirm the transaction in your wallet...');

        // writeContract can throw synchronously if validation fails (e.g., insufficient funds)
        await writeContract({
          address: ALPHA_ENGINE_CONTRACT_ADDRESS,
          abi: ALPHA_ENGINE_ABI,
          functionName: 'registerGenerator',
          args: [subscriptionFeeWei, 0], // Performance fee hard-coded to 0
        });
      } catch (contractError) {
        // Handle synchronous contract errors (validation failures)
        console.error('[Registration] Contract validation error:', contractError);
        dismissAllToasts();
        showContractError(contractError);
        setStatus('error');
        setErrorMessage(contractError instanceof Error ? contractError.message : 'Failed to submit transaction');

        // Clean up pending registration from backend
        try {
          await fetch(`http://localhost:3001/api/v1/alpha-generators/${address}`, {
            method: 'DELETE',
          });
          console.log('[Registration] Cleaned up pending registration from backend');
        } catch (cleanupError) {
          console.error('[Registration] Failed to cleanup backend:', cleanupError);
        }
        return; // Exit early on contract error
      }
    } catch (error) {
      // Handle backend errors
      console.error('[Registration] Backend error:', error);
      dismissAllToasts();
      showContractError(error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit registration');
    }
  };

  const handleRetryBackendSync = () => {
    setHasAttemptedAutoSync(false);
    void syncWithBackend();
  };

  // Show loading while checking registration
  if (isCheckingRegistration || status === 'checking') {
    return (
      <Container>
        <CheckingContainer>
          <LoadingSpinner />
          <h2>Checking Registration Status...</h2>
          <p>Verifying your on-chain registration</p>
        </CheckingContainer>
      </Container>
    );
  }

  // If already registered on-chain
  if (isAlreadyRegistered) {
    return (
      <Container>
        <Title>Already Registered</Title>
        <Form>
          <StatusMessage $type="info">
            You are already registered as an AlphaGenerator on the blockchain!
          </StatusMessage>

          {status === 'syncing' && (
            <CheckingContainer>
              <LoadingSpinner />
              <p>Syncing with backend...</p>
            </CheckingContainer>
          )}

          {status === 'error' && (
            <StatusMessage $type="error">{errorMessage}</StatusMessage>
          )}

          {status === 'error' ? (
            <Button onClick={handleRetryBackendSync}>
              Retry Backend Sync
            </Button>
          ) : (
            <InfoBox>
              Your wallet is registered on-chain. We&apos;re finalizing the backend sync automatically. Keep this
              page open until the process completes.
            </InfoBox>
          )}
        </Form>
      </Container>
    );
  }

  return (
    <Container>
      <Title>Register as AlphaGenerator</Title>

      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
        <NetworkSwitcher />
      </div>

      <Form onSubmit={handleSubmit}>
        <InfoBox>
          🔗 Registration happens on-chain first, then syncs with our backend.
          This ensures complete transparency and decentralization.
        </InfoBox>

        {status === 'error' && (
          <StatusMessage $type="error">{errorMessage}</StatusMessage>
        )}

        {status === 'success' && (
          <StatusMessage $type="success">
            Registration complete! Redirecting to dashboard...
          </StatusMessage>
        )}

        {(isWriting || isConfirming) && (
          <StatusMessage $type="info">
            {isWriting ? 'Please confirm in your wallet...' : 'Waiting for blockchain confirmation...'}
          </StatusMessage>
        )}

        {status === 'syncing' && (
          <StatusMessage $type="info">
            Blockchain confirmed! Syncing with backend...
          </StatusMessage>
        )}

        <FormGroup>
          <Label>Display Name</Label>
          <Input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your strategy name"
            disabled={status !== 'idle'}
            required
          />
        </FormGroup>

        <FormGroup>
          <Label>Description</Label>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your trading strategy and approach"
            disabled={status !== 'idle'}
          />
        </FormGroup>

        <FormGroup>
          <Label>Subscription Fee (ETH)</Label>
          <Input
            type="number"
            step="0.001"
            min="0.001"
            value={subscriptionFee}
            onChange={(e) => setSubscriptionFee(e.target.value)}
            disabled={status !== 'idle'}
            required
          />
        </FormGroup>

        {/* Performance fee field removed - backend hard-codes to 0% */}

        <Button
          type="submit"
          disabled={status !== 'idle' || !isConnected}
        >
          {!isConnected ? 'Connect Wallet First' :
           isWriting ? 'Confirm in Wallet...' :
           isConfirming ? 'Confirming on Blockchain...' :
           status === 'syncing' ? 'Syncing with Backend...' :
           'Register on Blockchain'}
        </Button>
      </Form>
    </Container>
  );
}
