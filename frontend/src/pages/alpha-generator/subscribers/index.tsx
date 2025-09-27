/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useAccount } from 'wagmi';
import { toast } from 'react-toastify';

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
  color: var(--color-text);
  margin: 0 0 8px 0;
`;

const PageDescription = styled.p`
  font-size: 16px;
  color: var(--color-text-muted);
  margin: 0;
`;

const StatsContainer = styled.div`
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: ${({ theme }) =>
    theme.mode === 'light'
      ? '0 12px 28px rgba(15, 23, 42, 0.08)'
      : '0 18px 40px rgba(0, 0, 0, 0.55)'};
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: ${({ theme }) =>
      theme.mode === 'light'
        ? '0 16px 40px rgba(37, 70, 240, 0.18)'
        : '0 22px 46px rgba(92, 124, 255, 0.35)'};
    transform: translateY(-2px);
  }
`;

const StatLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
`;

const StatValue = styled.div`
  font-size: 26px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const TableContainer = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: ${({ theme }) =>
    theme.mode === 'light'
      ? '0 10px 24px rgba(15, 23, 42, 0.06)'
      : '0 16px 36px rgba(0, 0, 0, 0.5)'};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHeader = styled.thead`
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
`;

const TableRow = styled.tr`
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-surface);
  }
`;

const TableHead = styled.th`
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const TableCell = styled.td`
  padding: 12px 16px;
  font-size: 14px;
  color: var(--color-text);
`;

const AddressBadge = styled.span`
  font-family: monospace;
  background: var(--color-surface);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid var(--color-border);
`;

const StatusBadge = styled.span<{ status: 'active' | 'expired' | 'pending' }>`
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;

  ${props => {
    switch (props.status) {
      case 'active':
        return `
          background: var(--color-success-surface);
          color: var(--color-success);
        `;
      case 'expired':
        return `
          background: var(--color-danger-surface);
          color: var(--color-danger);
        `;
      case 'pending':
        return `
          background: var(--color-warning-surface);
          color: var(--color-warning);
        `;
    }
  }}
`;


const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: var(--color-surface);
  border-radius: 12px;
  border: 2px dashed var(--color-border);
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 8px 0;
`;

const EmptyDescription = styled.p`
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0;
`;

interface Subscriber {
  address: string;
  subscriptionDate: string;
  expiryDate: string;
  feePaid: string;
  status: 'active' | 'expired' | 'pending';
  subscriptionTxHash?: string;
}

const AlphaGeneratorSubscribersPage: React.FC = () => {
  const { address } = useAccount();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscribers = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);

      // Normalize address to lowercase for consistent API calls
      const normalizedAddress = address.toLowerCase();
      const response = await fetch(`http://localhost:3001/api/v1/subscribers?generator=${normalizedAddress}`);
      const data = await response.json();

      if (data.isSuccess && data.data) {
        const responseData = data.data;
        const subscribersData = responseData.subscribers || responseData; // Handle both formats

        const transformedSubscribers: Subscriber[] = subscribersData.map((sub: any) => {
          // Use the actual expiry date from the API
          const expiryDate = new Date(sub.expiresAt || sub.expiryDate);
          const now = new Date();
          const isExpired = !sub.isActive || expiryDate < now;

          // Format address to show first 6 and last 4 characters
          const formatAddress = (addr: string) => {
            if (addr.length <= 10) return addr;
            return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
          };

          // Format fee - convert from wei to ETH
          const formatFee = (feeWei: string) => {
            try {
              const ethValue = parseFloat(feeWei) / 1e18; // Convert wei to ETH
              return `${ethValue.toFixed(4)} ETH`;
            } catch {
              return '0.1000 ETH'; // Default fallback
            }
          };

          return {
            address: formatAddress(sub.subscriberAddress || sub.alphaConsumerAddress || ''),
            subscriptionDate: new Date(sub.subscribedAt).toLocaleDateString(),
            expiryDate: expiryDate.toLocaleDateString(),
            feePaid: formatFee(sub.subscriptionFee || '100000000000000000'), // Default 0.1 ETH in wei
            status: sub.isActive && !isExpired ? 'active' : 'expired',
            subscriptionTxHash: sub.subscriptionTxHash
          };
        });

        setSubscribers(transformedSubscribers);

        // Update stats if available in response
        if (responseData.stats) {
          const revenueEth = parseFloat(responseData.stats.totalRevenue || '0') / 1e18; // Convert wei to ETH
          setStats({
            activeSubscribers: responseData.stats.activeSubscribers || 0,
            totalRevenue: revenueEth
          });
        }
      } else {
        setSubscribers([]);
      }
    } catch (err) {
      console.error('Error fetching subscribers:', err);
      // Show toast for background data fetch failure
      toast.error('Unable to load subscribers. Please refresh the page.');
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      fetchSubscribers();
    } else {
      setLoading(false);
    }
  }, [address, fetchSubscribers]);

  const [stats, setStats] = useState({ activeSubscribers: 0, totalRevenue: 0 });

  const activeSubscribers = stats.activeSubscribers || subscribers.filter(s => s.status === 'active').length;
  const totalRevenue = stats.totalRevenue;
  const avgSubscriptionLength = 30; // days (updated to match 30-day subscription period)

  if (loading) {
    return (
      <PageContainer>
        <PageHeader>
          <PageTitle>Subscribers</PageTitle>
        </PageHeader>
        <div>Loading subscribers...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Your Subscribers</PageTitle>
        <PageDescription>
          Manage and view all subscribers to your trading strategies
        </PageDescription>
      </PageHeader>

      <StatsContainer>
        <StatCard>
          <StatLabel>Active Subscribers</StatLabel>
          <StatValue>{activeSubscribers}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Total Revenue</StatLabel>
          <StatValue>{totalRevenue.toFixed(1)} ETH</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Avg Subscription</StatLabel>
          <StatValue>{avgSubscriptionLength} days</StatValue>
        </StatCard>
      </StatsContainer>

      {subscribers.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subscriber Address</TableHead>
                <TableHead>Subscription Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Fee Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {subscribers.map((subscriber, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <AddressBadge>{subscriber.address}</AddressBadge>
                  </TableCell>
                  <TableCell>{subscriber.subscriptionDate}</TableCell>
                  <TableCell>{subscriber.expiryDate}</TableCell>
                  <TableCell>{subscriber.feePaid}</TableCell>
                  <TableCell>
                    <StatusBadge status={subscriber.status}>
                      {subscriber.status === 'active' ? 'Active' :
                       subscriber.status === 'expired' ? 'Expired' : 'Pending'}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState>
          <EmptyIcon>👥</EmptyIcon>
          <EmptyTitle>No subscribers yet</EmptyTitle>
          <EmptyDescription>
            Once users subscribe to your strategies, they'll appear here
          </EmptyDescription>
        </EmptyState>
      )}
    </PageContainer>
  );
};

export default AlphaGeneratorSubscribersPage;
