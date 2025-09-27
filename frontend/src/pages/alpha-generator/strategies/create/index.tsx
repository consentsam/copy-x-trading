/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/router';
import { useAccount, useReadContract } from 'wagmi';
import axios from 'axios';
import { CreateStrategyInput } from '@/types/alphaengine';
import { ALPHAENGINE_ABI, ALPHAENGINE_CONTRACT_ADDRESS, parseGeneratorRegistration } from '@/contracts/AlphaEngine';
import AlphaGeneratorRegistration from '@/pages/register/alpha-generator';
import { toast } from 'react-hot-toast';

const PageContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 24px;
  transition: color 0.2s;
  
  &:hover {
    color: var(--color-primary);
  }
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px 0;
`;

const PageDescription = styled.p`
  font-size: 16px;
  color: var(--color-text-muted);
  margin: 0;
`;

const FormCard = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 32px;
`;

const FormSection = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 6px;
`;

const RequiredIndicator = styled.span`
  color: var(--color-danger);
  margin-left: 4px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-background);
  color: var(--color-text);
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-muted);
  }

  &::placeholder {
    color: var(--color-text-subtle);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  background: var(--color-background);
  color: var(--color-text);
  resize: vertical;
  min-height: 100px;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-muted);
  }

  &::placeholder {
    color: var(--color-text-subtle);
  }
`;

const CodeTextArea = styled(TextArea)`
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  min-height: 200px;
  background: var(--color-surface);
`;

const HelpText = styled.p`
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 6px;
  margin-bottom: 0;
`;

const ProtocolsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

const ProtocolCheckbox = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-muted);
  }
  
  input:checked + span {
    color: var(--color-primary);
    font-weight: 500;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  ${props => props.$variant === 'secondary' ? `
    background: var(--color-surface);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);

    &:hover {
      background: var(--color-background);
      border-color: var(--color-text-subtle);
    }
  ` : `
    background: var(--color-primary);
    color: var(--color-nav-text);
    border: none;

    &:hover {
      background: var(--color-primary-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent);
    }

    &:active {
      transform: translateY(0);
    }

    &:disabled {
      background: var(--color-neutral-surface);
      color: var(--color-text-muted);
      cursor: not-allowed;
      transform: none;
    }
  `}
`;

const ErrorMessage = styled.div`
  background: var(--color-danger-surface);
  border: 1px solid var(--color-danger-surface);
  border-radius: 6px;
  padding: 12px;
  color: var(--color-danger);
  font-size: 14px;
  margin-bottom: 20px;
`;

const SuccessMessage = styled.div`
  background: var(--color-success-surface);
  border: 1px solid var(--color-success-surface);
  border-radius: 6px;
  padding: 12px;
  color: var(--color-success);
  font-size: 14px;
  margin-bottom: 20px;
`;

const availableProtocols = [
  'Uniswap',
  'Aave',
  'Compound',
  'SushiSwap',
  'Curve',
  'Balancer',
  'MakerDAO',
  'Yearn',
  '1inch',
  'GMX'
];

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 2rem;
`;

const LoadingSpinner = styled.div`
  width: 60px;
  height: 60px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  font-size: 1.2rem;
  color: var(--color-text-muted);
`;

const UserInfo = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const UserDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const DisplayName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
`;

const WalletAddress = styled.span`
  font-size: 13px;
  color: var(--color-text-muted);
  font-family: monospace;
`;

const CreateStrategyPage: React.FC = () => {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [generatorData, setGeneratorData] = useState<any>(null);
  const hasCheckedRegistration = useRef(false);
  
  const [formData, setFormData] = useState({
    strategyName: '',
    strategyDescription: '',
    supportedProtocols: [] as string[],
    strategyJSON: `{
  "version": "1.0",
  "steps": [],
  "conditions": {},
  "parameters": {}
}`
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Check if the user is registered on the smart contract
  const { data: registrationData, isLoading: isCheckingContract } = useReadContract({
    address: ALPHAENGINE_CONTRACT_ADDRESS,
    abi: ALPHAENGINE_ABI,
    functionName: 'getEncryptedSubscribers',
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
    },
  });

  // Single useEffect to check registration status once
  useEffect(() => {
    console.log('[CreateStrategy] Component mounted/updated');
    console.log('[CreateStrategy] Wallet connected:', isConnected);
    console.log('[CreateStrategy] Wallet address:', address);
    console.log('[CreateStrategy] Has checked:', hasCheckedRegistration.current);

    // Only check registration once when we have an address and haven't checked yet
    if (address && !hasCheckedRegistration.current) {
      console.log('[CreateStrategy] Running one-time registration check for:', address);
      hasCheckedRegistration.current = true;
      checkRegistrationStatus();
    } else if (!address) {
      // Reset when wallet disconnects
      hasCheckedRegistration.current = false;
      setIsRegistered(false);
      setCheckingRegistration(false);
    }
  }, [address]); // Only depend on address

  const checkRegistrationStatus = async () => {
    if (!address) {
      console.log('[CreateStrategy] No wallet connected');
      setCheckingRegistration(false);
      return;
    }

    setCheckingRegistration(true);

    try {
      console.log('[CreateStrategy] Checking registration status for:', address);

      // Check if registered on smart contract
      const { isActive: isContractRegistered } = parseGeneratorRegistration(registrationData);

      console.log('[CreateStrategy] Smart contract registration status:', isContractRegistered);

      if (isContractRegistered) {
        // If registered on contract, user can create strategies regardless of backend sync status
        setIsRegistered(true);

        // Try to fetch data from backend for display purposes
        console.log('[CreateStrategy] Fetching generator data from backend');

        try {
          const response = await axios.get(`http://localhost:3001/api/v1/alpha-generators?address=${address.toLowerCase()}`);

          if (response.data?.data?.length > 0) {
            const generator = response.data.data.find((g: any) =>
              g.walletAddress?.toLowerCase() === address.toLowerCase()
            );
            if (generator) {
              setGeneratorData(generator);
              console.log('[CreateStrategy] Generator data fetched:', generator);
            } else {
              // Try to sync with backend but don't block strategy creation
              await syncGeneratorData();
            }
          } else {
            // Try to sync with backend but don't block strategy creation
            await syncGeneratorData();
          }
        } catch (error: any) {
          console.error('[CreateStrategy] Error fetching generator data:', error);
          // Backend sync failed, but user is still registered on contract
          // They can still create strategies
          toast('Backend sync pending, but you can still create strategies');
        }
      } else {
        console.log('[CreateStrategy] User not registered on smart contract');
        setIsRegistered(false);
      }
    } catch (error: any) {
      console.error('[CreateStrategy] Error checking registration:', error);
      toast.error('Failed to check registration status');
    } finally {
      setCheckingRegistration(false);
    }
  };

  const syncGeneratorData = async () => {
    try {
      console.log('[CreateStrategy] Syncing generator data with backend');

      // First check if generator already exists in backend
      try {
        const checkResponse = await axios.get(`http://localhost:3001/api/v1/alpha-generators?address=${address?.toLowerCase()}`);
        if (checkResponse.data?.data?.length > 0) {
          const existingGenerator = checkResponse.data.data.find((g: any) =>
            g.walletAddress?.toLowerCase() === address?.toLowerCase()
          );
          if (existingGenerator) {
            console.log('[CreateStrategy] Generator already exists in backend, skipping sync');
            setGeneratorData(existingGenerator);
            setIsRegistered(true);
            return;
          }
        }
      } catch (checkError) {
        console.log('[CreateStrategy] No existing generator found, proceeding with sync');
      }

      // Only create if generator doesn't exist
      const response = await axios.post('http://localhost:3001/api/v1/alpha-generators', {
        walletAddress: address,
        displayName: `Generator ${address?.slice(0, 6)}...${address?.slice(-4)}`,
        description: 'Synced from smart contract',
      });

      if (response.data?.data) {
        setGeneratorData(response.data.data);
        setIsRegistered(true);
        console.log('[CreateStrategy] Generator data synced successfully');
      }
    } catch (error: any) {
      console.error('[CreateStrategy] Error syncing generator data:', error);
      setIsRegistered(true); // Still allow since they're registered on contract
    }
  };

  const handleRegistrationComplete = async () => {
    console.log('[CreateStrategy] Registration completed');
    // Mark as registered without rechecking to avoid loops
    setIsRegistered(true);
    setCheckingRegistration(false);
    // Reset the check flag so next time component mounts it will check again
    hasCheckedRegistration.current = false;
  };

  const handleInputChange = (field: keyof typeof formData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (field === 'strategyJSON' && typeof value === 'string') {
      validateJSON(value);
    }
  };

  const validateJSON = (jsonString: string) => {
    try {
      if (jsonString.trim()) {
        JSON.parse(jsonString);
        setJsonError(null);
      }
    } catch {
      setJsonError('Invalid JSON format');
    }
  };

  const handleProtocolToggle = (protocol: string) => {
    setFormData(prev => ({
      ...prev,
      supportedProtocols: prev.supportedProtocols.includes(protocol)
        ? prev.supportedProtocols.filter(p => p !== protocol)
        : [...prev.supportedProtocols, protocol]
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.strategyName.trim()) {
      setError('Strategy name is required');
      return false;
    }
    
    
    if (formData.supportedProtocols.length === 0) {
      setError('At least one protocol must be selected');
      return false;
    }
    
    if (jsonError) {
      setError('Please fix JSON errors before submitting');
      return false;
    }
    
    if (!address) {
      setError('Please connect your wallet');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const API_URL = process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL || '';
      
      const payload: CreateStrategyInput = {
        strategyName: formData.strategyName.trim(),
        strategyDescription: formData.strategyDescription.trim() || undefined,
        supportedProtocols: formData.supportedProtocols,
        strategyJSON: JSON.parse(formData.strategyJSON),
        alphaGeneratorAddress: address!
      };
      
      const response = await axios.post(`${API_URL}/api/v1/strategies`, payload, {
        headers: {
          'X-Wallet-Address': address
        }
      });
      
      if (response.data?.isSuccess) {
        setSuccess(true);
        setError('');  // Clear any previous errors
        setTimeout(() => {
          router.push('/alpha-generator/strategies');
        }, 1500);
      } else {
        throw new Error(response.data?.message || 'Failed to create strategy');
      }
    } catch (err: unknown) {
      console.error('Error creating strategy:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create strategy';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/alpha-generator/strategies');
  };


  // Show loading while checking registration
  if (checkingRegistration || isCheckingContract) {
    return (
      <PageContainer>
        <LoadingContainer>
          <LoadingSpinner />
          <LoadingText>Checking registration status...</LoadingText>
        </LoadingContainer>
      </PageContainer>
    );
  }

  // If not connected, show connection message
  if (!isConnected) {
    return (
      <PageContainer>
        <LoadingContainer>
          <LoadingText>Please connect your wallet to continue</LoadingText>
        </LoadingContainer>
      </PageContainer>
    );
  }

  // If not registered, show the registration page
  if (!isRegistered) {
    console.log('[CreateStrategy] Showing registration page');
    return <AlphaGeneratorRegistration onRegistrationComplete={handleRegistrationComplete} />;
  }

  // Show the strategy creation form
  return (
    <PageContainer>
      {generatorData && (
        <UserInfo>
          <UserDetails>
            <DisplayName>
              {generatorData.displayName || generatorData.name || 'Alpha Generator'}
            </DisplayName>
            <WalletAddress>{address}</WalletAddress>
          </UserDetails>
        </UserInfo>
      )}
      <BackButton onClick={handleCancel}>
        ← Back to Strategies
      </BackButton>

      <PageHeader>
        <PageTitle>Import Strategy</PageTitle>
        <PageDescription>
          Import your strategy configuration from the external builder
        </PageDescription>
      </PageHeader>

      <FormCard>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>Strategy created successfully! Redirecting...</SuccessMessage>}

        <FormSection>
          <SectionTitle>Basic Information</SectionTitle>
          
          <FormGroup>
            <Label>
              Strategy Name
              <RequiredIndicator>*</RequiredIndicator>
            </Label>
            <Input
              type="text"
              placeholder="e.g., ETH-USDC Momentum Strategy"
              value={formData.strategyName}
              onChange={(e) => handleInputChange('strategyName', e.target.value)}
              disabled={loading}
            />
            <HelpText>Choose a descriptive name for your strategy</HelpText>
          </FormGroup>

          <FormGroup>
            <Label>Description</Label>
            <TextArea
              placeholder="Describe your strategy's approach, goals, and risk profile..."
              value={formData.strategyDescription}
              onChange={(e) => handleInputChange('strategyDescription', e.target.value)}
              disabled={loading}
            />
            <HelpText>Optional: Help consumers understand your strategy</HelpText>
          </FormGroup>
        </FormSection>

        <FormSection>
          <SectionTitle>Configuration</SectionTitle>
          
          <FormGroup>
            <Label>
              Supported Protocols
              <RequiredIndicator>*</RequiredIndicator>
            </Label>
            <ProtocolsContainer>
              {availableProtocols.map(protocol => (
                <ProtocolCheckbox key={protocol}>
                  <input
                    type="checkbox"
                    checked={formData.supportedProtocols.includes(protocol)}
                    onChange={() => handleProtocolToggle(protocol)}
                    disabled={loading}
                  />
                  <span>{protocol}</span>
                </ProtocolCheckbox>
              ))}
            </ProtocolsContainer>
            <HelpText>Select all protocols your strategy will interact with</HelpText>
          </FormGroup>
        </FormSection>

        <FormSection>
          <SectionTitle>Strategy Configuration</SectionTitle>
          
          <FormGroup>
            <Label>
              Strategy JSON
              <RequiredIndicator>*</RequiredIndicator>
            </Label>
            <CodeTextArea
              placeholder="Paste your strategy JSON from the builder..."
              value={formData.strategyJSON}
              onChange={(e) => handleInputChange('strategyJSON', e.target.value)}
              disabled={loading}
            />
            {jsonError && (
              <HelpText style={{ color: 'var(--color-danger)' }}>{jsonError}</HelpText>
            )}
            {!jsonError && (
              <HelpText>Paste the JSON configuration exported from your strategy builder</HelpText>
            )}
          </FormGroup>
        </FormSection>

        <ButtonGroup>
          <Button
            $variant="secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            $variant="primary"
            onClick={handleSubmit}
            disabled={loading || !address}
          >
            {loading ? 'Creating...' : 'Create Strategy'}
          </Button>
        </ButtonGroup>
      </FormCard>
    </PageContainer>
  );
};

export default CreateStrategyPage;
