/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import { useAccount } from 'wagmi';
import { apiClient } from '@/utils/api-client';
import TradeExecutionModal from '@/Components/TradeExecutionModal';
import { Subscriber } from '@/types/alphaengine';

const Container = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 20px;
`;

const TitleSection = styled.div``;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: var(--color-text-muted);
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  background: ${props => props.$variant === 'secondary'
    ? 'transparent'
    : 'var(--color-primary)'};
  color: ${props => props.$variant === 'secondary'
    ? 'var(--color-text)'
    : 'var(--color-nav-text)'};
  border: ${props => props.$variant === 'secondary'
    ? '1px solid var(--color-border)'
    : 'none'};
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$variant === 'secondary'
      ? 'var(--color-surface-elevated)'
      : 'var(--color-primary-hover)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
`;

const StatLabel = styled.p`
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const StatValue = styled.h3`
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
`;

const DetailsSection = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  margin-bottom: 32px;

  @media (max-width: 968px) {
    grid-template-columns: 1fr;
  }
`;

const DescriptionCard = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 16px;
`;

const Description = styled.p`
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-muted);
`;

const InfoCard = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`;

const InfoLabel = styled.span`
  font-size: 14px;
  color: var(--color-text-muted);
`;

const InfoValue = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
`;

const PerformanceSection = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
`;

const ChartPlaceholder = styled.div`
  height: 300px;
  background: var(--color-surface);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 14px;
`;

const SubscribersList = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
`;

const SubscriberItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-surface);
  border-radius: 6px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SubscriberAddress = styled.span`
  font-family: monospace;
  font-size: 14px;
  color: var(--color-text);
`;

const SubscribedDate = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  color: var(--color-text-muted);
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: var(--color-text-muted);
`;

interface Strategy {
  strategyId: string;
  strategyName: string;
  strategyDescription: string;
  alphaGeneratorAddress: string;
  totalVolume: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  supportedProtocols: any;
  strategyJSON: any;
}

// Interface for display with computed/default values
interface StrategyDisplay extends Strategy {
  name: string;
  description: string;
  performanceFee: number;
  totalTrades: number;
  successRate: number;
  status: string;
}

export default function StrategyDetailPage() {
  const router = useRouter();
  const { strategyId } = router.query;
  const { address } = useAccount();
  const [strategy, setStrategy] = useState<StrategyDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);

  useEffect(() => {
    if (strategyId && typeof strategyId === 'string') {
      fetchStrategyDetails();
    }
  }, [strategyId, address]);

  const fetchStrategyDetails = async () => {
    try {
      setLoading(true);

      // Fetch strategy details - apiClient automatically unwraps the response
      const strategyData = await apiClient.get<Strategy>(`/api/v1/strategies/${strategyId}`);

      // Transform backend data to display format
      const strategyDisplay: StrategyDisplay = {
        ...strategyData,
        name: strategyData.strategyName || 'Untitled Strategy',
        description: strategyData.strategyDescription || 'No description available',
        performanceFee: 2.5, // Default performance fee
        totalTrades: 0, // TODO: Calculate from trades table
        successRate: 0, // TODO: Calculate from trades table
        status: strategyData.isActive ? 'active' : 'inactive',
      };

      setStrategy(strategyDisplay);

      // Check if current user is the owner
      const userIsOwner = address && strategyData.alphaGeneratorAddress &&
        strategyData.alphaGeneratorAddress.toLowerCase() === address.toLowerCase();

      setIsOwner(!!userIsOwner);

      // Fetch subscribers if owner - but don't fail the whole page if this fails
      if (userIsOwner) {
        try {
          const subscribersData = await apiClient.get<any[]>(`/api/v1/strategies/${strategyId}/subscribers`);
          setSubscribers(subscribersData || []);
        } catch (error) {
          console.warn('Subscribers endpoint not available yet:', error);
          // Set empty subscribers array as fallback
          setSubscribers([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch strategy details:', error);
      setStrategy(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTrade = () => {
    setShowTradeModal(true);
  };

  const handleTradeSubmitted = () => {
    setShowTradeModal(false);
    // Optionally refresh strategy data
    fetchStrategyDetails();
  };

  const handleEdit = () => {
    router.push(`/alpha-generator/strategies/${strategyId}/edit`);
  };

  const handleViewPerformance = () => {
    router.push(`/alpha-generator/performance?strategyId=${strategyId}`);
  };

  if (loading) {
    return (
      <Container>
        <LoadingState>Loading strategy details...</LoadingState>
      </Container>
    );
  }

  if (!strategy) {
    return (
      <Container>
        <EmptyState>Strategy not found</EmptyState>
      </Container>
    );
  }

  return (
      <Container>
        <Header>
          <TitleSection>
            <Title>{strategy.name}</Title>
            <Subtitle>Strategy ID: {strategy.strategyId}</Subtitle>
          </TitleSection>
          <ActionButtons>
            {isOwner && (
              <>
                <Button onClick={handleExecuteTrade}>
                  🚀 Execute Trade
                </Button>
                <Button $variant="secondary" onClick={handleEdit}>
                  ✏️ Edit Strategy
                </Button>
                <Button $variant="secondary" onClick={handleViewPerformance}>
                  📊 View Performance
                </Button>
              </>
            )}
          </ActionButtons>
        </Header>

        <StatsGrid>
          <StatCard>
            <StatLabel>Total Trades</StatLabel>
            <StatValue>{strategy.totalTrades}</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Success Rate</StatLabel>
            <StatValue>{strategy.successRate}%</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Performance Fee</StatLabel>
            <StatValue>{strategy.performanceFee}%</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Status</StatLabel>
            <StatValue style={{ textTransform: 'capitalize' }}>{strategy.status}</StatValue>
          </StatCard>
        </StatsGrid>

        <DetailsSection>
          <DescriptionCard>
            <SectionTitle>Description</SectionTitle>
            <Description>{strategy.description}</Description>
          </DescriptionCard>
          
          <InfoCard>
            <SectionTitle>Strategy Information</SectionTitle>
            <InfoRow>
              <InfoLabel>Generator</InfoLabel>
              <InfoValue>
                {strategy.alphaGeneratorAddress
                  ? `${strategy.alphaGeneratorAddress.substring(0, 8)}...`
                  : 'N/A'
                }
              </InfoValue>
            </InfoRow>
            <InfoRow>
              <InfoLabel>Created</InfoLabel>
              <InfoValue>{new Date(strategy.createdAt).toLocaleDateString()}</InfoValue>
            </InfoRow>
            <InfoRow>
              <InfoLabel>Last Trade</InfoLabel>
              <InfoValue>2 hours ago</InfoValue>
            </InfoRow>
            <InfoRow>
              <InfoLabel>Avg. Trade Size</InfoLabel>
              <InfoValue>0.5 ETH</InfoValue>
            </InfoRow>
          </InfoCard>
        </DetailsSection>

        <PerformanceSection>
          <SectionTitle>Performance Chart</SectionTitle>
          <ChartPlaceholder>
            Performance chart will be displayed here
          </ChartPlaceholder>
        </PerformanceSection>

        {isOwner && subscribers.length > 0 && (
          <SubscribersList>
            <SectionTitle>Recent Subscribers</SectionTitle>
            {subscribers.slice(0, 5).map((sub, index) => (
              <SubscriberItem key={index}>
                <SubscriberAddress>
                  {sub.alphaConsumerAddress}
                </SubscriberAddress>
                <SubscribedDate>
                  {new Date(sub.subscribedAt).toLocaleDateString()}
                </SubscribedDate>
              </SubscriberItem>
            ))}
            {subscribers.length > 5 && (
              <Button
                $variant="secondary"
                style={{ width: '100%', marginTop: '12px' }}
                onClick={() => router.push('/alpha-generator/subscribers')}
              >
                View All {subscribers.length} Subscribers
              </Button>
            )}
          </SubscribersList>
        )}

        {showTradeModal && strategy && (
          <TradeExecutionModal
            strategyId={strategy.strategyId}
            strategyName={strategy.name}
            strategy={strategy}
            onClose={() => setShowTradeModal(false)}
            onSubmit={handleTradeSubmitted}
          />
        )}
      </Container>
  );
}