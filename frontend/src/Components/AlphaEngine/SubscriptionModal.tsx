import React, { useEffect } from 'react';
import { formatEther } from 'viem';
import { useAlphaEngine } from '@/hooks/use-alpha-engine';
import { type AlphaGenerator } from '@/utils/alphaengine-client';
import { showContractError } from '@/utils/contract-error-handler';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${({ theme }) => theme.colors.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: ${({ theme }) => theme.colors.surfaceElevated};
  border-radius: ${({ theme }) => theme.radii.lg};
  width: 90%;
  max-width: 500px;
  padding: 32px;
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.mode === 'light' 
    ? '0 20px 40px rgba(0, 0, 0, 0.15)' 
    : '0 20px 40px rgba(0, 0, 0, 0.5)'};
`;

const CloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 24px;
  transition: color 0.2s ease;
`;

const GeneratorInfo = styled.div`
  padding: 16px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: 24px;
  transition: all 0.2s ease;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const InfoLabel = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 14px;
  transition: color 0.2s ease;
`;

const InfoValue = styled.span`
  color: ${({ theme }) => theme.colors.text};
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s ease;
`;

const PrivacyNote = styled.div`
  background: ${({ theme }) => theme.colors.infoSurface};
  border: 1px solid ${({ theme }) => theme.colors.info};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 12px;
  margin-bottom: 24px;
  transition: all 0.2s ease;
`;

const PrivacyText = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.5;
  margin: 0;
  transition: color 0.2s ease;
`;

const PrivacyIcon = styled.span`
  display: inline-block;
  margin-right: 8px;
`;

const StatusSection = styled.div`
  margin-bottom: 24px;
`;

const StatusItem = styled.div<{ $active: boolean; $completed: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${props => {
    if (props.$completed) return props.theme.colors.successSurface;
    if (props.$active) return props.theme.colors.primaryMuted;
    return props.theme.colors.surface;
  }};
  border: 1px solid ${props => {
    if (props.$completed) return props.theme.colors.success;
    if (props.$active) return props.theme.colors.primary;
    return props.theme.colors.border;
  }};
  transition: all 0.2s ease;
`;

const StatusIcon = styled.div<{ $completed: boolean; $active: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props => {
    if (props.$completed) return props.theme.colors.success;
    if (props.$active) return props.theme.colors.primary;
    return props.theme.colors.border;
  }};
  color: ${({ theme }) => theme.colors.navText};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
`;

const StatusText = styled.div`
  flex: 1;
`;

const StatusTitle = styled.p`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 2px;
  margin-top: 0;
  transition: color 0.2s ease;
`;

const StatusDescription = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0;
  transition: color 0.2s ease;
`;

const LoadingSpinner = styled.div<{ $active: boolean }>`
  width: 16px;
  height: 16px;
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: ${props => props.$active ? 'spin 0.6s linear infinite' : 'none'};

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  flex: 1;
  padding: 12px 24px;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: ${props => props.$variant === 'secondary' ? `1px solid ${props.theme.colors.border}` : 'none'};
  background: ${props => props.$variant === 'secondary' ? 'transparent' : props.theme.colors.primary};
  color: ${props => props.$variant === 'secondary' ? props.theme.colors.text : props.theme.colors.navText};

  &:hover:not(:disabled) {
    background: ${props => props.$variant === 'secondary' ? props.theme.colors.primaryMuted : props.theme.colors.primaryHover};
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  padding: 12px;
  background: ${({ theme }) => theme.colors.dangerSurface};
  border: 1px solid ${({ theme }) => theme.colors.danger};
  border-radius: ${({ theme }) => theme.radii.md};
  margin-bottom: 16px;
  transition: all 0.2s ease;
`;

const ErrorText = styled.p`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.danger};
  margin: 0;
  transition: color 0.2s ease;
`;

interface SubscriptionModalProps {
  generator: AlphaGenerator;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubscriptionModal({ generator, onClose, onSuccess }: SubscriptionModalProps) {
  const {
    subscribeToGenerator,
    subscriptionStatus,
    encryptedAddress,
  } = useAlphaEngine();

  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    if (subscriptionStatus === 'completed') {
      onSuccess();
    } else if (subscriptionStatus === 'error') {
      setError('Subscription failed. Please try again.');
    }
  }, [subscriptionStatus, onSuccess]);

  const handleSubscribe = async () => {
    setError(null);
    try {
      await subscribeToGenerator(generator);
    } catch (err: unknown) {
      // Toast notification is already handled in the hook
      // Just update local error state for UI display
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    }
  };

  const getStatusSteps = () => {
    const steps = [
      {
        id: 'encrypt',
        title: 'Encrypting Address',
        description: 'Creating privacy-protected address using FHE',
        active: subscriptionStatus === 'encrypting',
        completed: ['signing', 'confirming', 'completed'].includes(subscriptionStatus),
      },
      {
        id: 'sign',
        title: 'Sign Transaction',
        description: 'Approve subscription in your wallet',
        active: subscriptionStatus === 'signing',
        completed: ['confirming', 'completed'].includes(subscriptionStatus),
      },
      {
        id: 'confirm',
        title: 'Confirming Transaction',
        description: 'Waiting for blockchain confirmation',
        active: subscriptionStatus === 'confirming',
        completed: subscriptionStatus === 'completed',
      },
    ];

    return steps;
  };

  const steps = getStatusSteps();
  const isProcessing = !['idle', 'completed', 'error'].includes(subscriptionStatus);

  return (
    <Overlay onClick={isProcessing ? undefined : onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose} disabled={isProcessing}>×</CloseButton>

        <Title>Subscribe to Alpha Generator</Title>

        <GeneratorInfo>
          <InfoRow>
            <InfoLabel>Generator</InfoLabel>
            <InfoValue>{generator.displayName || 'Anonymous'}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Address</InfoLabel>
            <InfoValue style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {generator.walletAddress.slice(0, 6)}...{generator.walletAddress.slice(-4)}
            </InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Subscription Fee</InfoLabel>
            <InfoValue>
              {(() => {
                try {
                  if (typeof generator.subscriptionFee === 'string' && generator.subscriptionFee.includes('.')) {
                    return `${parseFloat(generator.subscriptionFee).toFixed(4)} ETH`;
                  } else {
                    return `${formatEther(BigInt(generator.subscriptionFee || 0))} ETH`;
                  }
                } catch (error) {
                  console.warn('Invalid subscription fee value:', generator.subscriptionFee, error);
                  // This is just a display formatting issue, not a critical error
                  return `${generator.subscriptionFee} ETH`;
                }
              })()}
            </InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Performance Fee</InfoLabel>
            <InfoValue>{(generator.performanceFee / 100).toFixed(1)}%</InfoValue>
          </InfoRow>
        </GeneratorInfo>

        <PrivacyNote>
          <PrivacyText>
            <PrivacyIcon>🔒</PrivacyIcon>
            Your address will be encrypted using Fully Homomorphic Encryption (FHE) before being stored on-chain.
            This ensures your privacy while allowing the generator to verify your subscription.
          </PrivacyText>
        </PrivacyNote>

        {error && (
          <ErrorMessage>
            <ErrorText>{error}</ErrorText>
          </ErrorMessage>
        )}

        {subscriptionStatus !== 'idle' && (
          <StatusSection>
            {steps.map((step, index) => (
              <StatusItem
                key={step.id}
                $active={step.active}
                $completed={step.completed}
              >
                <StatusIcon $active={step.active} $completed={step.completed}>
                  {step.completed ? '✓' : index + 1}
                </StatusIcon>
                <StatusText>
                  <StatusTitle>{step.title}</StatusTitle>
                  <StatusDescription>{step.description}</StatusDescription>
                </StatusText>
                {step.active && <LoadingSpinner $active={true} />}
              </StatusItem>
            ))}
          </StatusSection>
        )}

        {encryptedAddress && subscriptionStatus !== 'idle' && (
          <InfoRow style={{ marginBottom: '24px' }}>
            <InfoLabel>Encrypted Address</InfoLabel>
            <InfoValue style={{ fontFamily: 'monospace', fontSize: '11px' }}>
              {encryptedAddress.slice(0, 10)}...
            </InfoValue>
          </InfoRow>
        )}

        <ButtonGroup>
          <Button
            $variant="secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubscribe}
            disabled={isProcessing || subscriptionStatus === 'completed'}
          >
            {isProcessing ? 'Processing...' :
             subscriptionStatus === 'completed' ? 'Subscribed!' :
             'Subscribe'}
          </Button>
        </ButtonGroup>
      </Modal>
    </Overlay>
  );
}