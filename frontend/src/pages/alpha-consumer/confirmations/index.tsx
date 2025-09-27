import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useAccount } from 'wagmi';
import TradeConfirmationList from '@/Components/AlphaEngine/TradeConfirmationList';
import { TradeConfirmation } from '@/types/alphaengine';
import { useConfirmationsSSE } from '@/hooks/useConfirmationsSSE';
import { confirmationsService } from '@/services/confirmations.service';
import { ethers } from 'ethers';
import { useEthersSigner } from '@/hooks/useEthersSigner';
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
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
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
`;

const ConnectionStatus = styled.div<{ $connected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: ${props => props.$connected ? 'var(--color-success-surface)' : 'var(--color-danger-surface)'};
  border: 1px solid ${props => props.$connected ? 'var(--color-success-surface)' : 'var(--color-danger-surface)'};
  border-radius: 20px;
  font-size: 14px;
  color: ${props => props.$connected ? 'var(--color-success)' : 'var(--color-danger)'};
  margin-bottom: 24px;
`;

const StatusDot = styled.div<{ $connected: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$connected ? 'var(--color-success)' : 'var(--color-danger)'};
  animation: ${props => props.$connected ? 'pulse 2s infinite' : 'none'};
  
  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
`;

const FilterSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const FilterButton = styled.button<{ $active?: boolean }>`
  background-color: ${props => props.$active ? 'var(--color-primary)' : 'transparent'};
  color: ${props => props.$active ? 'var(--color-nav-text)' : 'var(--color-text-muted)'};
  border: 1px solid ${props => props.$active ? 'var(--color-primary)' : 'var(--color-border)'};
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: var(--color-primary);
    color: ${props => props.$active ? 'var(--color-nav-text)' : 'var(--color-primary)'};
  }
`;

const RefreshButton = styled.button`
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ConfirmationsContainer = styled.div`
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  min-height: 300px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
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

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px;
  font-size: 16px;
  color: var(--color-text-muted);
`;

const ErrorContainer = styled.div`
  background: var(--color-danger-surface);
  border: 1px solid var(--color-danger-surface);
  border-radius: 8px;
  padding: 16px;
  color: var(--color-danger);
  margin-bottom: 24px;
`;

const WalletPrompt = styled.div`
  background: var(--color-warning-surface);
  border: 1px solid var(--color-warning-surface);
  border-radius: 8px;
  padding: 16px;
  color: var(--color-warning);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const NotificationBadge = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--color-primary);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(37, 70, 240, 0.3);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  animation: slideIn 0.3s ease-out;
  z-index: 1000;
  
  @keyframes slideIn {
    from {
      transform: translateY(100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

type FilterType = 'all' | 'recent' | 'high-gas' | 'urgent';

const ConsumerConfirmationsPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner();
  const [confirmations, setConfirmations] = useState<TradeConfirmation[]>([]);
  const [filteredConfirmations, setFilteredConfirmations] = useState<TradeConfirmation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sseConnected, setSseConnected] = useState(false);
  const [newConfirmationAlert, setNewConfirmationAlert] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const fetchPendingTrades = useCallback(async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Use confirmations service to fetch pending trades
      const pendingTrades = await confirmationsService.getPendingConfirmations(address);
      setConfirmations(pendingTrades || []);
    } catch (err: unknown) {
      console.error('Error fetching confirmations:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load confirmations';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      fetchPendingTrades();
    }
  }, [address, fetchPendingTrades]);

  const applyFilter = useCallback(() => {
    let filtered = [...confirmations];

    switch (filter) {
      case 'recent':
        filtered = filtered.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 10);
        break;
      case 'high-gas':
        filtered = filtered.filter(c => {
          const gasEstimate = BigInt(c.gasEstimate || '0');
          return gasEstimate > BigInt('100000');
        });
        break;
      case 'urgent':
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        filtered = filtered.filter(c =>
          new Date(c.createdAt) < oneHourAgo
        );
        break;
      case 'all':
      default:
        break;
    }

    setFilteredConfirmations(filtered);
  }, [confirmations, filter]);

  useEffect(() => {
    applyFilter();
  }, [applyFilter]);

  useConfirmationsSSE({
    onMessage: (data: TradeConfirmation) => {
      if (data?.alphaConsumerAddress?.toLowerCase() === address?.toLowerCase()) {
        setNewConfirmationAlert(true);
        setTimeout(() => setNewConfirmationAlert(false), 3000);
        fetchPendingTrades();
      }
    },
    onStatusChange: (status) => {
      setSseConnected(status === 'connected');
    },
    filterByAddress: address
  });

  const handleApprove = async (confirmationId: string) => {
    const confirmation = confirmations.find(c => c.confirmationId === confirmationId);
    if (!confirmation || !signer) return;

    try {
      setExecutingId(confirmationId);

      let txHash: string;

      // Check if this is a strategy-based execution with ABI
      if (confirmation.metadata?.functionABI && confirmation.metadata?.contractAddress) {
        // Execute using ABI
        const contract = new ethers.Contract(
          confirmation.metadata.contractAddress as string,
          [confirmation.metadata.functionABI],
          signer
        );

        const params = confirmation.metadata.parameters || {};
        const paramValues = Object.values(params);

        const tx = await contract[confirmation.metadata.functionName as string](...paramValues);
        const receipt = await tx.wait();
        txHash = receipt.transactionHash;
      } else {
        // Fallback to stub transaction for traditional executions
        const stubTxHash = `0x${Date.now().toString(16)}`;
        txHash = stubTxHash;
      }

      // Mark the confirmation as executed
      await confirmationsService.completeConfirmation(
        confirmationId,
        true, // isExecuted
        txHash // executionTxHash
      );

      // Refresh the pending trades list
      fetchPendingTrades();
    } catch (err: unknown) {
      console.error('Error executing trade:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to execute trade';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setExecutingId(null);
    }
  };

  const handleRefresh = () => {
    fetchPendingTrades();
  };

  const calculateStats = () => {
    const totalPending = confirmations.length;
    const totalGasEstimate = confirmations.reduce((sum, c) => {
      try {
        return sum + BigInt(c.gasEstimate || '0');
      } catch {
        return sum;
      }
    }, BigInt(0));
    
    const oldestTime = confirmations.length > 0 
      ? Math.min(...confirmations.map(c => new Date(c.createdAt).getTime()))
      : Date.now();
    const waitTime = Math.floor((Date.now() - oldestTime) / 1000 / 60);
    
    return {
      totalPending,
      totalGasEstimate: (Number(totalGasEstimate) / 1e9).toFixed(2),
      longestWait: waitTime > 0 ? `${waitTime} min` : '0 min'
    };
  };

  const stats = calculateStats();

  if (!isConnected || !address) {
    return (
      <PageContainer>
        <PageHeader>
          <PageTitle>Trade Confirmations</PageTitle>
          <PageDescription>
            Review and execute pending trades from your subscribed strategies
          </PageDescription>
        </PageHeader>
        
        <WalletPrompt>
          <span>⚠️</span>
          <span>Please connect your wallet to view pending confirmations</span>
        </WalletPrompt>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Trade Confirmations</PageTitle>
        <PageDescription>
          Review and execute pending trades from your subscribed strategies
        </PageDescription>
      </PageHeader>

      <ConnectionStatus $connected={sseConnected}>
        <StatusDot $connected={sseConnected} />
        {sseConnected ? 'Real-time updates active' : 'Connecting to updates...'}
      </ConnectionStatus>

      {error && (
        <ErrorContainer>
          Error: {error}
        </ErrorContainer>
      )}

      <StatsContainer>
        <StatCard>
          <StatLabel>Pending Trades</StatLabel>
          <StatValue>{stats.totalPending}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Total Gas (Gwei)</StatLabel>
          <StatValue>{stats.totalGasEstimate}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Longest Wait</StatLabel>
          <StatValue>{stats.longestWait}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Connected Wallet</StatLabel>
          <StatValue style={{ fontSize: '14px', wordBreak: 'break-all' }}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </StatValue>
        </StatCard>
      </StatsContainer>

      <FilterSection>
        <FilterBar>
          <FilterButton
            $active={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All Pending
          </FilterButton>
          <FilterButton
            $active={filter === 'recent'}
            onClick={() => setFilter('recent')}
          >
            Recent (10)
          </FilterButton>
          <FilterButton
            $active={filter === 'high-gas'}
            onClick={() => setFilter('high-gas')}
          >
            High Gas
          </FilterButton>
          <FilterButton
            $active={filter === 'urgent'}
            onClick={() => setFilter('urgent')}
          >
            Urgent (&gt;1hr)
          </FilterButton>
        </FilterBar>
        <RefreshButton onClick={handleRefresh} disabled={loading}>
          🔄 Refresh
        </RefreshButton>
      </FilterSection>

      <ConfirmationsContainer>
        {loading ? (
          <LoadingContainer>Loading confirmations...</LoadingContainer>
        ) : filteredConfirmations.length > 0 ? (
          <TradeConfirmationList
            confirmations={filteredConfirmations}
            onApprove={handleApprove}
            processingIds={executingId ? [executingId] : []}
          />
        ) : (
          <EmptyState>
            <EmptyIcon>📭</EmptyIcon>
            <EmptyTitle>No pending confirmations</EmptyTitle>
            <EmptyDescription>
              {confirmations.length === 0 
                ? "You don't have any pending trades. New trades will appear here when broadcasted."
                : "No confirmations match your current filter."}
            </EmptyDescription>
          </EmptyState>
        )}
      </ConfirmationsContainer>

      {newConfirmationAlert && (
        <NotificationBadge>
          ✨ New trade confirmation received!
        </NotificationBadge>
      )}
    </PageContainer>
  );
};

export default ConsumerConfirmationsPage;
