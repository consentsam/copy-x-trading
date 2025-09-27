import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import { apiClient } from '@/utils/api-client';
import { TradeConfirmation, Subscription } from '@/types/alphaengine';

const DashboardContainer = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const DashboardHeader = styled.div`
  margin-bottom: 32px;
`;

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

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
`;

const StatLabel = styled.p`
  font-size: 14px;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.h2`
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 4px;
`;

const StatSubtext = styled.span`
  font-size: 14px;
  color: var(--color-text-muted);
`;

const QuickActions = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 16px;
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
`;

const ActionCard = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  &:hover {
    background: var(--color-surface-elevated);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const ActionIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-primary-muted);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 12px;
`;

const ActionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
`;

const ActionDescription = styled.p`
  font-size: 14px;
  color: var(--color-text-muted);
`;

const RecentTrades = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
`;

const TradeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
`;

const TradeItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
`;

const TradeInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const TradeStatus = styled.div<{ $status: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => {
    switch(props.$status) {
      case 'pending': return 'var(--color-warning)';
      case 'executed': return 'var(--color-success)';
      case 'failed': return 'var(--color-error)';
      default: return 'var(--color-text-muted)';
    }
  }};
`;

const TradeContent = styled.div`
  flex: 1;
`;

const TradeStrategy = styled.p`
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
  margin-bottom: 2px;
`;

const TradeTime = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
`;

const TradeAction = styled.button`
  padding: 6px 12px;
  background: var(--color-primary);
  color: var(--color-nav-text);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: var(--color-primary-hover);
  }

  &:disabled {
    background: var(--color-neutral-surface);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  color: var(--color-text-muted);
  font-size: 16px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: var(--color-text-muted);
`;

const ConnectionStatus = styled.div<{ $status: string }>`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: ${props => {
    switch(props.$status) {
      case 'connected': return 'var(--color-success)';
      case 'connecting': return 'var(--color-warning)';
      case 'error': return 'var(--color-error)';
      default: return 'var(--color-text-muted)';
    }
  }};
  z-index: 1000;
`;

interface DashboardStats {
  activeSubscriptions: number;
  pendingConfirmations: number;
  executedTrades: number;
  totalSpent: number;
  recentTrades: Array<{
    id: string;
    strategyName: string;
    status: string;
    time: string;
  }>;
}

export default function AlphaConsumerDashboard() {
  const router = useRouter();
  const { address } = useAccount();
  const [stats, setStats] = useState<DashboardStats>({
    activeSubscriptions: 0,
    pendingConfirmations: 0,
    executedTrades: 0,
    totalSpent: 0,
    recentTrades: []
  });
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch subscriptions
      const subscriptions = await apiClient.get<Subscription[]>('/api/consumer/subscriptions', {
        params: { alphaConsumerAddress: address }
      });

      // Fetch pending trades
      const pendingTrades = await apiClient.get<TradeConfirmation[]>('/api/consumer/pending-trades', {
        params: { alphaConsumerAddress: address }
      });
      
      // Process recent trades from actual data
      const recentTrades = (pendingTrades || []).slice(0, 5).map((trade: TradeConfirmation, index: number) => ({
        id: trade.confirmationId || `trade-${index}`,
        strategyName: `Strategy ${trade.strategyId?.substring(0, 8) || index + 1}`,
        status: trade.isExecuted ? 'executed' : 'pending',
        time: trade.createdAt ? new Date(trade.createdAt).toLocaleString() : 'Unknown'
      }));
      
      setStats({
        activeSubscriptions: (subscriptions || []).length,
        pendingConfirmations: (pendingTrades || []).filter((t: TradeConfirmation) => !t.isExecuted).length,
        executedTrades: (pendingTrades || []).filter((t: TradeConfirmation) => t.isExecuted).length,
        totalSpent: 0, // TODO: Calculate from actual subscription fees
        recentTrades: recentTrades
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Set mock data on error
      setStats({
        activeSubscriptions: 0,
        pendingConfirmations: 0,
        executedTrades: 0,
        totalSpent: 0,
        recentTrades: []
      });
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      fetchDashboardData();

      // Set up SSE connection for real-time updates
      const backendUrl = process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL || 'http://localhost:3001';
      const eventSource = new EventSource(`${backendUrl}/api/consumer/stream?address=${address}`);

      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Received event:', data);

          switch (data.type) {
            case 'connected':
              setConnectionStatus('connected');
              break;
            case 'trade_created':
              // Refresh data when new trade is created
              fetchDashboardData();
              break;
            case 'trade_status_changed':
              // Refresh data when trade status changes
              fetchDashboardData();
              break;
            case 'heartbeat':
              // Keep connection alive
              break;
          }
        } catch (error) {
          console.error('[SSE] Failed to parse event data:', error);
        }
      });

      eventSource.addEventListener('error', (error) => {
        console.error('[SSE] Connection error:', error);
        setConnectionStatus('error');
      });

      return () => {
        eventSource.close();
      };
    }
    // Remove fetchDashboardData from dependencies to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const quickActions = [
    {
      icon: '🔍',
      title: 'Browse AlphaGenerators',
      description: 'Discover profitable strategies',
      path: '/alpha-consumer/strategies'
    },
    {
      icon: '✅',
      title: 'View Confirmations',
      description: 'Manage pending trades',
      path: '/alpha-consumer/confirmations'
    },
    {
      icon: '📋',
      title: 'My Subscriptions',
      description: 'Manage active subscriptions',
      path: '/alpha-consumer/subscriptions'
    },
    {
      icon: '📊',
      title: 'Performance',
      description: 'Track your trading results',
      path: '/alpha-consumer/performance'
    }
  ];

  const handleViewConfirmation = (_tradeId: string) => {
    router.push('/alpha-consumer/confirmations');
  };

  if (!address) {
    return (
      <DashboardContainer>
        <LoadingState>Please connect your wallet to continue</LoadingState>
      </DashboardContainer>
    );
  }

  if (loading) {
    return (
      <DashboardContainer>
        <LoadingState>Loading dashboard...</LoadingState>
      </DashboardContainer>
    );
  }

  return (
      <DashboardContainer>
        <ConnectionStatus $status={connectionStatus}>
          {connectionStatus === 'connected' && '🟢 Live Updates'}
          {connectionStatus === 'connecting' && '🟡 Connecting...'}
          {connectionStatus === 'error' && '🔴 Connection Error'}
        </ConnectionStatus>

        <DashboardHeader>
          <Title>Alpha Consumer Dashboard</Title>
          <Subtitle>Track your subscriptions and manage trades</Subtitle>
        </DashboardHeader>

        <StatsGrid>
          <StatCard>
            <StatLabel>Active Subscriptions</StatLabel>
            <StatValue>{stats.activeSubscriptions}</StatValue>
            <StatSubtext>Strategies you're following</StatSubtext>
          </StatCard>
          <StatCard>
            <StatLabel>Pending Confirmations</StatLabel>
            <StatValue>{stats.pendingConfirmations}</StatValue>
            <StatSubtext>Awaiting your action</StatSubtext>
          </StatCard>
          <StatCard>
            <StatLabel>Executed Trades</StatLabel>
            <StatValue>{stats.executedTrades}</StatValue>
            <StatSubtext>Successfully completed</StatSubtext>
          </StatCard>
          <StatCard>
            <StatLabel>Total Spent</StatLabel>
            <StatValue>{stats.totalSpent} ETH</StatValue>
            <StatSubtext>On subscription fees</StatSubtext>
          </StatCard>
        </StatsGrid>

        <QuickActions>
          <SectionTitle>Quick Actions</SectionTitle>
          <ActionGrid>
            {quickActions.map(action => (
              <ActionCard key={action.path} onClick={() => router.push(action.path)}>
                <ActionIcon>{action.icon}</ActionIcon>
                <ActionTitle>{action.title}</ActionTitle>
                <ActionDescription>{action.description}</ActionDescription>
              </ActionCard>
            ))}
          </ActionGrid>
        </QuickActions>

        <RecentTrades>
          <SectionTitle>Recent Trade Signals</SectionTitle>
          {stats.recentTrades.length === 0 ? (
            <EmptyState>
              <p>No recent trades</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                Subscribe to strategies to receive trade signals
              </p>
            </EmptyState>
          ) : (
            <TradeList>
              {stats.recentTrades.map(trade => (
                <TradeItem key={trade.id}>
                  <TradeInfo>
                    <TradeStatus $status={trade.status} />
                    <TradeContent>
                      <TradeStrategy>{trade.strategyName}</TradeStrategy>
                      <TradeTime>{trade.time}</TradeTime>
                    </TradeContent>
                  </TradeInfo>
                  {trade.status === 'pending' && (
                    <TradeAction onClick={() => handleViewConfirmation(trade.id)}>
                      Review
                    </TradeAction>
                  )}
                </TradeItem>
              ))}
            </TradeList>
          )}
        </RecentTrades>
      </DashboardContainer>
  );
}