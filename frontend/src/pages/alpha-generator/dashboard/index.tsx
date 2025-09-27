import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import { apiClient } from '@/utils/api-client';
import { Strategy } from '@/types/alphaengine';
import { toast } from 'react-toastify';

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

const StatChange = styled.span<{ $positive?: boolean }>`
  font-size: 14px;
  color: ${props => props.$positive ? 'var(--color-success)' : 'var(--color-error)'};
  display: flex;
  align-items: center;
  gap: 4px;
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

const BottomGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 32px;
`;

const RecentActivity = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
`;

const OpenTrades = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
`;

const TradesHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const ViewHistoryButton = styled.button`
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-surface-elevated);
    border-color: var(--color-primary);
  }
`;

const TradesTable = styled.div`
  margin-top: 16px;
`;

const TradesTableHeader = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-muted);
`;


const EmptyState = styled.div`
  text-align: center;
  padding: 32px;
  color: var(--color-text-muted);
  font-size: 14px;
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
`;

const ActivityItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
`;

const ActivityDot = styled.div<{ type?: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => {
    switch(props.type) {
      case 'subscription': return 'var(--color-success)';
      case 'trade': return 'var(--color-primary)';
      case 'performance': return 'var(--color-warning)';
      default: return 'var(--color-text-muted)';
    }
  }};
`;

const ActivityContent = styled.div`
  flex: 1;
`;

const ActivityTitle = styled.p`
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 2px;
`;

const ActivityTime = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  color: var(--color-text-muted);
  font-size: 16px;
`;

interface DashboardStats {
  totalStrategies: number;
  activeSubscribers: number;
  totalTrades: number;
  successRate: number;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    time: string;
  }>;
}

export default function AlphaGeneratorDashboard() {
  const router = useRouter();
  const { address } = useAccount();
  const [stats, setStats] = useState<DashboardStats>({
    totalStrategies: 0,
    activeSubscribers: 0,
    totalTrades: 0,
    successRate: 0,
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch strategies
      const strategies = await apiClient.get<Strategy[]>('/api/v1/strategies', {
        params: { alphaGeneratorAddress: address }
      });

      // Calculate stats from strategies
      const totalSubscribers = (strategies || []).reduce((sum: number, s: Strategy) => 
        sum + (s.subscriberCount || 0), 0
      );
      
      // TODO: Fetch real activities data from backend
      
      setStats({
        totalStrategies: (strategies || []).length,
        activeSubscribers: totalSubscribers,
        totalTrades: 0, // TODO: Calculate from actual trades
        successRate: 0, // TODO: Calculate from actual trades
        recentActivities: [] // TODO: Fetch from backend
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Show toast for dashboard data load failure
      toast.error('Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      fetchDashboardData();
    }
    // Remove fetchDashboardData from dependencies to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const quickActions = [
    {
      icon: '📊',
      title: 'Create Strategy',
      description: 'Launch a new trading strategy',
      path: '/alpha-generator/strategies/create'
    },
    {
      icon: '📈',
      title: 'View Performance',
      description: 'Analyze your strategy metrics',
      path: '/alpha-generator/performance'
    },
    {
      icon: '👥',
      title: 'View Subscribers',
      description: 'Manage your subscriber base',
      path: '/alpha-generator/subscribers'
    },
    {
      icon: '🎯',
      title: 'My Strategies',
      description: 'Manage existing strategies',
      path: '/alpha-generator/strategies'
    }
  ];

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
      <DashboardHeader>
        <Title>Alpha Generator Dashboard</Title>
        <Subtitle>Monitor your strategies and track performance</Subtitle>
      </DashboardHeader>

      <StatsGrid>
        <StatCard>
          <StatLabel>Total Strategies</StatLabel>
          <StatValue>{stats.totalStrategies}</StatValue>
          <StatChange $positive>+2 this week</StatChange>
        </StatCard>
        <StatCard>
          <StatLabel>Active Subscribers</StatLabel>
          <StatValue>{stats.activeSubscribers}</StatValue>
          <StatChange $positive>+12% growth</StatChange>
        </StatCard>
        <StatCard>
          <StatLabel>Total Trades</StatLabel>
          <StatValue>{stats.totalTrades}</StatValue>
          <StatChange $positive>+8 today</StatChange>
        </StatCard>
        <StatCard>
          <StatLabel>Success Rate</StatLabel>
          <StatValue>{stats.successRate}%</StatValue>
          <StatChange $positive>+3.2%</StatChange>
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

      <BottomGrid>
        <RecentActivity>
          <SectionTitle>Recent Activity</SectionTitle>
          <ActivityList>
            {stats.recentActivities.length > 0 ? (
              stats.recentActivities.map(activity => (
                <ActivityItem key={activity.id}>
                  <ActivityDot type={activity.type} />
                  <ActivityContent>
                    <ActivityTitle>{activity.title}</ActivityTitle>
                    <ActivityTime>{activity.time}</ActivityTime>
                  </ActivityContent>
                </ActivityItem>
              ))
            ) : (
              <EmptyState>No recent activity</EmptyState>
            )}
          </ActivityList>
        </RecentActivity>

        <OpenTrades>
          <TradesHeader>
            <SectionTitle>Open Trades</SectionTitle>
            <ViewHistoryButton onClick={() => router.push('/alpha-generator/trades/history')}>
              View History
            </ViewHistoryButton>
          </TradesHeader>
          <TradesTable>
            <TradesTableHeader>
              <div>StrategyName</div>
              <div>AmountInvested</div>
              <div>PnL</div>
            </TradesTableHeader>
            <EmptyState>No open trades</EmptyState>
          </TradesTable>
        </OpenTrades>
      </BottomGrid>
    </DashboardContainer>
  );
}