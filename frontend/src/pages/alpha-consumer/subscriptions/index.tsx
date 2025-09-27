import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import type { Subscription } from '@/types/alphaengine';

const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin: 0 0 8px 0;
  transition: color 0.2s ease;
`;

const PageDescription = styled.p`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0;
  transition: color 0.2s ease;
`;

const StatsContainer = styled.div`
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: ${({ theme }) => theme.colors.surfaceElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 16px;
  flex: 1;
  transition: background 0.2s ease, border-color 0.2s ease;
`;

const StatLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  transition: color 0.2s ease;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  transition: color 0.2s ease;
`;

const SubscriptionCard = styled.div`
  background: ${({ theme }) => theme.colors.surfaceElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s ease, border-color 0.2s ease;
`;

const SubscriberInfo = styled.div`
  flex: 1;
`;

const SubscriberAddress = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0 0 4px 0;
  font-family: monospace;
  transition: color 0.2s ease;
`;

const StrategyInfo = styled.p`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0 0 12px 0;
  transition: color 0.2s ease;
`;

const SubscriptionMeta = styled.div`
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: color 0.2s ease;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StatusBadge = styled.span<{ status: 'active' | 'paused' | 'expired' }>`
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
  transition: background-color 0.2s ease, color 0.2s ease;

  ${({ theme, status }) => {
    switch (status) {
      case 'active':
        return `
          background: ${theme.colors.successSurface};
          color: ${theme.colors.success};
        `;
      case 'paused':
        return `
          background: ${theme.colors.warningSurface};
          color: ${theme.colors.warning};
        `;
      case 'expired':
      default:
        return `
          background: ${theme.colors.dangerSurface};
          color: ${theme.colors.danger};
        `;
    }
  }}
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  ${({ theme, variant }) => {
    switch (variant) {
      case 'danger':
        return `
          background: ${theme.colors.danger};
          color: ${theme.colors.navText};

          &:hover {
            background: ${theme.colors.dangerSurface};
            color: ${theme.colors.danger};
          }
        `;
      case 'secondary':
        return `
          background: ${theme.colors.surface};
          color: ${theme.colors.textMuted};
          border: 1px solid ${theme.colors.border};

          &:hover {
            background: ${theme.colors.surfaceAlt};
          }
        `;
      case 'primary':
      default:
        return `
          background: ${theme.colors.primary};
          color: ${theme.colors.navText};

          &:hover {
            background: ${theme.colors.primaryHover};
          }
        `;
    }
  }}

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 12px;
  border: 2px dashed ${({ theme }) => theme.colors.subtleBorder};
  transition: background 0.2s ease, border-color 0.2s ease;
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0 0 8px 0;
  transition: color 0.2s ease;
`;

const EmptyDescription = styled.p`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0 0 24px 0;
  transition: color 0.2s ease;
`;

interface SubscriberData extends Subscription {
  subscriberAddress: string;
  subscriptionFee?: string;
  expiryDate?: string;
}

interface SubscriptionResponseData {
  alphaGeneratorAddress: string;
  alphaConsumerAddress: string;
  subscriptionFee?: string;
  expiresAt?: string;
  expiryDate?: string;
  subscribedAt: string;
  isActive: boolean;
  subscriptionId: string;
}

const toEthNumber = (wei?: string | null): number => {
  if (!wei) {
    return 0;
  }

  try {
    return parseFloat(formatEther(BigInt(wei)));
  } catch (error) {
    console.warn('Failed to convert wei to ETH:', error);
    return 0;
  }
};

const formatFeeLabel = (feeEth: number): string => `${feeEth.toFixed(4)} ETH`;

const AlphaConsumerSubscriptionsPage: React.FC = () => {
  const router = useRouter();
  const { address } = useAccount();
  const [subscribers, setSubscribers] = useState<SubscriberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAlphaGenerator, setIsAlphaGenerator] = useState(false);

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true);

      // Normalize address to lowercase for consistent API calls
      const normalizedAddress = address?.toLowerCase() || '';

      // Check if user is an alpha generator by querying the alpha-generators endpoint
      const generatorResponse = await fetch(`http://localhost:3001/api/v1/alpha-generators?address=${normalizedAddress}`);
      const generatorData = await generatorResponse.json();

      // If this address is registered as an AlphaGenerator
      if (generatorResponse.ok && generatorData.data && generatorData.data.length > 0) {
        setIsAlphaGenerator(true);

        // Fetch subscribers for this generator
        const subscribersResponse = await fetch(`http://localhost:3001/api/v1/subscribers?generator=${normalizedAddress}`);
        const subscribersData = await subscribersResponse.json();

        if (subscribersResponse.ok && subscribersData.data) {
          // Extract subscribers array from the response object
          // The API returns { subscribers: [...], stats: {...} }
          setSubscribers(subscribersData.data.subscribers || []);
        }
      } else {
        setIsAlphaGenerator(false);
        // Fetch regular subscriptions (consumer view)
        const subscriptionsResponse = await fetch(`http://localhost:3001/api/v1/subscriptions?consumer=${normalizedAddress}`);
        const subscriptionsData = await subscriptionsResponse.json();

        if (subscriptionsResponse.ok && subscriptionsData.data) {
          const responseData = subscriptionsData.data;
          const subscriptionsArray = responseData.subscriptions || responseData; // Handle both formats

          // Transform to match expected format
          const transformed = subscriptionsArray.map((sub: SubscriptionResponseData) => ({
            ...sub,
            subscriberAddress: sub.alphaConsumerAddress,
            strategyName: 'Strategy Subscription',
            subscriptionFee: sub.subscriptionFee || '100000000000000000', // Default 0.1 ETH in wei
            expiryDate: sub.expiresAt || sub.expiryDate
          }));
          setSubscribers(transformed);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      fetchSubscribers();
    }
  }, [fetchSubscribers, address]);

  
  const handlePauseSubscription = (subscriptionId: string) => {
    console.log('Pause subscription:', subscriptionId);
  };

  const handleCancelSubscription = (subscriptionId: string) => {
    console.log('Cancel subscription:', subscriptionId);
  };

  const browseStrategies = () => {
    router.push('/alpha-consumer/strategies');
  };

  const activeSubscribers = subscribers.filter(s => s.isActive).length;
  const totalRevenue = subscribers.reduce((sum, s) => {
    return sum + toEthNumber(s.subscriptionFee);
  }, 0);

  if (loading) {
    return (
      <PageContainer>
        <PageHeader>
          <PageTitle>My Subscriptions</PageTitle>
        </PageHeader>
        <div>Loading subscriptions...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{isAlphaGenerator ? 'Your Subscribers' : 'My Subscriptions'}</PageTitle>
        <PageDescription>
          {isAlphaGenerator
            ? 'Manage and view all subscribers to your trading strategies'
            : 'Manage your active strategy subscriptions'}
        </PageDescription>
      </PageHeader>

      <StatsContainer>
        <StatCard>
          <StatLabel>{isAlphaGenerator ? 'Active Subscribers' : 'Active Subscriptions'}</StatLabel>
          <StatValue>{activeSubscribers}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>{isAlphaGenerator ? 'Total Revenue' : 'Total Fees Paid'}</StatLabel>
          <StatValue>{totalRevenue.toFixed(4)} ETH</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>{isAlphaGenerator ? 'Total Strategies' : 'Total Subscriptions'}</StatLabel>
          <StatValue>{subscribers.length}</StatValue>
        </StatCard>
      </StatsContainer>

      {subscribers.length > 0 ? (
        subscribers.map((subscriber) => {
          const feeEth = toEthNumber(subscriber.subscriptionFee);

          return (
            <SubscriptionCard key={subscriber.subscriptionId}>
            <SubscriberInfo>
              <SubscriberAddress>
                {subscriber.subscriberAddress.slice(0, 6)}...{subscriber.subscriberAddress.slice(-4)}
              </SubscriberAddress>
              {isAlphaGenerator && (
                <StrategyInfo>
                  Subscriber
                </StrategyInfo>
              )}
              <SubscriptionMeta>
                <MetaItem>
                  Subscribed: {new Date(subscriber.subscribedAt).toLocaleDateString()}
                </MetaItem>
                {subscriber.expiryDate && (
                  <MetaItem>
                    Expires: {new Date(subscriber.expiryDate).toLocaleDateString()}
                  </MetaItem>
                )}
                <MetaItem>
                  Status: {subscriber.isActive ? 'Active' : 'Inactive'}
                </MetaItem>
                {feeEth > 0 && (
                  <MetaItem>
                    Fee: {formatFeeLabel(feeEth)}
                  </MetaItem>
                )}
              </SubscriptionMeta>
            </SubscriberInfo>
            <StatusBadge status={subscriber.isActive ? 'active' : 'expired'}>
              {subscriber.isActive ? 'Active' : 'Expired'}
            </StatusBadge>
            <ActionButtons>
              {subscriber.isActive && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handlePauseSubscription(subscriber.subscriptionId)}
                  >
                    Pause
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleCancelSubscription(subscriber.subscriptionId)}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </ActionButtons>
          </SubscriptionCard>
          );
        })
      ) : (
        <EmptyState>
          <EmptyIcon>📋</EmptyIcon>
          <EmptyTitle>
            {isAlphaGenerator ? 'No subscribers yet' : 'No active subscriptions'}
          </EmptyTitle>
          <EmptyDescription>
            {isAlphaGenerator
              ? 'Once users subscribe to your strategies, they\'ll appear here'
              : 'You haven\'t subscribed to any trading strategies yet'}
          </EmptyDescription>
          {!isAlphaGenerator && (
            <Button variant="primary" onClick={browseStrategies}>
              Browse AlphaGenerators
            </Button>
          )}
        </EmptyState>
      )}
    </PageContainer>
  );
};

export default AlphaConsumerSubscriptionsPage;
