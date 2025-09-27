/* eslint-disable @typescript-eslint/no-explicit-any */
import styled from "styled-components";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import axios from "axios";
import { ALPHAENGINE_ABI, ALPHAENGINE_CONTRACT_ADDRESS, parseGeneratorRegistration } from "@/contracts/AlphaEngine";
import AlphaGeneratorRegistration from "@/pages/register/alpha-generator";
import AlphaConsumerRegistration from "@/pages/register/alpha-consumer";

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  justify-content: center;
  width: 100%;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  color: var(--color-text);
  margin-bottom: 4rem;
  text-align: center;
  transition: color 0.2s ease;
`;

const OptionsContainer = styled.div`
  display: flex;
  gap: 40px;
  justify-content: center;
  flex-wrap: wrap;
  max-width: 1200px;
  width: 100%;
  padding: 0 20px;
`;

const Option = styled.div<{ $isSelected?: boolean }>`
  padding: 2rem;
  border-radius: 16px;
  cursor: pointer;
  text-align: center;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const IconContainer = styled.div<{ $isSelected?: boolean }>`
  width: 180px;
  height: 180px;
  margin: 0 auto 1.5rem;
  background: var(--color-surface-elevated);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: ${(props) =>
    props.$isSelected ? "4px solid var(--color-primary)" : "4px solid var(--color-border)"};
  box-shadow: ${(props) =>
    props.$isSelected
      ? "0 0 0 8px var(--color-primary-muted), 0px 12px 30px rgba(15, 23, 42, 0.12)"
      : "0 12px 30px rgba(15, 23, 42, 0.08)"};
  transition: all 0.3s ease;
`;

const OptionTitle = styled.h3<{ $isSelected?: boolean }>`
  font-size: 24px;
  font-weight: 600;
  color: ${(props) => (props.$isSelected ? 'var(--color-primary)' : 'var(--color-text)')};
  margin-bottom: 8px;
  transition: color 0.3s ease;
`;

const OptionDescription = styled.p<{ $isSelected?: boolean }>`
  color: ${(props) => (props.$isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)')};
  font-size: 16px;
  font-weight: 400;
  transition: color 0.3s ease;
`;

const CheckIcon = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: 48px;
  right: 45px;
  width: 24px;
  height: 24px;
  background: var(--color-primary);
  border-radius: 50%;
  display: ${(props) => (props.$isVisible ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  color: var(--color-nav-text);
  font-size: 14px;
`;

const ContinueButton = styled.button`
  background-color: var(--color-primary);
  color: var(--color-nav-text);
  padding: 10px 30px;
  border-radius: 4px;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 3rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--color-primary-hover);
  }

  &:disabled {
    background-color: var(--color-neutral-surface);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-muted);
  }
`;

const StatusMessage = styled.div`
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  text-align: center;
  background-color: var(--color-info-surface);
  color: var(--color-info);
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-nav-text);
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const getApiOrigin = (): string => {
  // Priority 1: Environment variable
  if (process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL) {
    return process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL;
  }

  // Priority 2: Browser window location origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Priority 3: Default fallback
  return 'http://localhost:3001';
};

const buildApiUrl = (endpoint: string): string => {
  const origin = getApiOrigin();
  // Remove trailing slash from origin and leading slash from endpoint to prevent double slashes
  const cleanOrigin = origin.replace(/\/$/, '');
  const cleanEndpoint = endpoint.replace(/^\//, '');
  return `${cleanOrigin}/${cleanEndpoint}`;
};

export default function SelectUserType() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<"alpha-generator" | "alpha-consumer" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showGeneratorRegistration, setShowGeneratorRegistration] = useState(false);
  const [showConsumerRegistration, setShowConsumerRegistration] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Get wallet address from wagmi
  const { address: walletAddress } = useAccount();

  // Check AlphaGenerator registration on smart contract
  const { data: generatorRegistrationData, isLoading: isCheckingContract } = useReadContract({
    address: ALPHAENGINE_CONTRACT_ADDRESS,
    abi: ALPHAENGINE_ABI,
    functionName: 'getEncryptedSubscribers',
    args: walletAddress ? [walletAddress] : undefined,
    query: {
      enabled: !!walletAddress && selectedType === 'alpha-generator',
      // Disable automatic refetching to prevent loops
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: Infinity,
      gcTime: Infinity,
    },
  });

  useEffect(() => {
    console.log('[SelectUserType] Component mounted');
    console.log('[SelectUserType] Wallet address:', walletAddress);
    console.log('[SelectUserType] Selected type:', selectedType);
  }, [walletAddress, selectedType]);

  const checkAlphaGeneratorRegistration = async () => {
    console.log('[SelectUserType] Checking AlphaGenerator registration');

    try {
      // Check smart contract registration
      const { isActive: isContractRegistered } = parseGeneratorRegistration(generatorRegistrationData);
      console.log('[SelectUserType] Contract registration status:', isContractRegistered);

      if (!isContractRegistered) {
        console.log('[SelectUserType] AlphaGenerator not registered, showing registration page');
        setShowGeneratorRegistration(true);
        return false;
      }

      setStatusMessage('Detected your on-chain registration. Waiting for backend sync...');
      const isBackendSynced = await pollBackendForGenerator();

      if (isBackendSynced) {
        setStatusMessage('Backend sync complete. Redirecting to dashboard...');
        return true;
      }

      console.log('[SelectUserType] Backend entry not ready yet, keeping user on registration screen');
      setStatusMessage('We registered you on-chain, but the backend is still syncing. Please complete the registration flow to finish.');
      setShowGeneratorRegistration(true);
      return false;
    } catch (error) {
      console.error('[SelectUserType] Error checking AlphaGenerator registration:', error);
      const { isActive: contractIsActive } = parseGeneratorRegistration(generatorRegistrationData);
      if (contractIsActive) {
        setStatusMessage('We detected your on-chain registration but could not reach the backend. Please complete the registration flow to finish syncing.');
        setShowGeneratorRegistration(true);
      }
      return false;
    }
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const pollBackendForGenerator = async (attempts = 5, delayMs = 1500) => {
    if (!walletAddress) return false;

    let lastError: any = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const normalizedWalletAddress = walletAddress?.toLowerCase();
        const response = await axios.get(buildApiUrl(`api/v1/alpha-generators?address=${normalizedWalletAddress}`));

        if (response.data?.data?.length > 0) {
          const generator = response.data.data.find((g: any) =>
            g.walletAddress?.toLowerCase() === normalizedWalletAddress
          );

          if (generator) {
            return true;
          }
        }
      } catch (error) {
        lastError = error;
        console.error('[SelectUserType] Poll attempt failed while waiting for backend sync:', error);
      }

      if (attempt < attempts - 1) {
        await wait(delayMs);
      }
    }

    // After all retries failed, throw the last error to let callers handle it appropriately
    if (lastError) {
      throw lastError;
    }

    return false;
  };

  const checkAlphaConsumerRegistration = async () => {
    console.log('[SelectUserType] Checking AlphaConsumer registration');

    try {
      const normalizedWalletAddress = walletAddress?.toLowerCase();
      const response = await axios.get(buildApiUrl(`api/v1/alpha-consumers?address=${normalizedWalletAddress}`));

      if (response.data?.data) {
        console.log('[SelectUserType] AlphaConsumer is registered');
        return true;
      } else {
        console.log('[SelectUserType] AlphaConsumer not registered, showing registration page');
        setShowConsumerRegistration(true);
        return false;
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('[SelectUserType] AlphaConsumer not found, showing registration');
        setShowConsumerRegistration(true);
        return false;
      }
      console.error('[SelectUserType] Error checking AlphaConsumer registration:', error);
      return false;
    }
  };

  const handleContinue = async () => {
    if (!selectedType || !walletAddress) return;

    setIsLoading(true);
    setStatusMessage("Checking registration status...");

    try {
      if (selectedType === 'alpha-generator') {
        // Check AlphaGenerator registration
        const isRegistered = await checkAlphaGeneratorRegistration();

        if (isRegistered) {
          console.log('[SelectUserType] AlphaGenerator is registered, redirecting to dashboard');
          router.push('/alpha-generator/dashboard');
        }
        // If not registered, the registration component will be shown
      } else if (selectedType === 'alpha-consumer') {
        // Check AlphaConsumer registration
        const isRegistered = await checkAlphaConsumerRegistration();

        if (isRegistered) {
          console.log('[SelectUserType] AlphaConsumer is registered, redirecting to dashboard');
          router.push('/alpha-consumer/dashboard');
        }
        // If not registered, the registration component will be shown
      }
    } catch (error) {
      console.error('[SelectUserType] Error during registration check:', error);
      setStatusMessage("Error checking registration. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratorRegistrationComplete = () => {
    console.log('[SelectUserType] AlphaGenerator registration completed');
    setShowGeneratorRegistration(false);
    // Redirect to dashboard
    router.push('/alpha-generator/dashboard');
  };

  const _handleConsumerRegistrationComplete = () => {
    console.log('[SelectUserType] AlphaConsumer registration completed');
    setShowConsumerRegistration(false);
    // Redirect to dashboard
    router.push('/alpha-consumer/dashboard');
  };

  // If showing registration forms
  if (showGeneratorRegistration) {
    return <AlphaGeneratorRegistration onRegistrationComplete={handleGeneratorRegistrationComplete} />;
  }

  if (showConsumerRegistration) {
    return <AlphaConsumerRegistration />;
  }

  return (
    <Container>
      <Title>Choose Your Role</Title>
      <OptionsContainer>
        <Option
          $isSelected={selectedType === "alpha-generator"}
          onClick={() => setSelectedType("alpha-generator")}>
          <IconContainer $isSelected={selectedType === "alpha-generator"}>
            <div style={{
              fontSize: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '90px',
              height: '90px'
            }}>
              📊
            </div>
          </IconContainer>
          <OptionTitle $isSelected={selectedType === "alpha-generator"}>
            Create Strategies
          </OptionTitle>
          <OptionDescription $isSelected={selectedType === "alpha-generator"}>
            Share your winning trades
          </OptionDescription>
          <CheckIcon $isVisible={selectedType === "alpha-generator"}>✓</CheckIcon>
        </Option>

        <Option
          $isSelected={selectedType === "alpha-consumer"}
          onClick={() => setSelectedType("alpha-consumer")}>
          <IconContainer $isSelected={selectedType === "alpha-consumer"}>
            <div style={{
              fontSize: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '90px',
              height: '90px'
            }}>
              📋
            </div>
          </IconContainer>
          <OptionTitle $isSelected={selectedType === "alpha-consumer"}>
            Copy Strategies
          </OptionTitle>
          <OptionDescription $isSelected={selectedType === "alpha-consumer"}>
            Follow proven traders
          </OptionDescription>
          <CheckIcon $isVisible={selectedType === "alpha-consumer"}>✓</CheckIcon>
        </Option>
      </OptionsContainer>

      {statusMessage && <StatusMessage>{statusMessage}</StatusMessage>}

      <ContinueButton
        onClick={handleContinue}
        disabled={!selectedType || isLoading || isCheckingContract || !walletAddress}>
        {isLoading ? (
          <>
            <LoadingSpinner />
            <span>Checking...</span>
          </>
        ) : (
          <>
            <span>Continue</span>
            <span>→</span>
          </>
        )}
      </ContinueButton>
    </Container>
  );
}
