import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { alphaEngineClient, type AlphaGenerator } from '@/utils/alphaengine-client';
import { useAlphaEngine } from '@/hooks/use-alpha-engine';
import GeneratorCard from './GeneratorCard';
import SubscriptionModal from './SubscriptionModal';
import styled from 'styled-components';
import { toast } from 'react-toastify';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  transition: color 0.2s ease;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${props => props.$active ? props.theme.colors.primary : props.theme.colors.border};
  background: ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.$active ? props.theme.colors.navText : props.theme.colors.text};
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;

  &:hover {
    background: ${props => props.$active ? props.theme.colors.primaryHover : props.theme.colors.primaryMuted};
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 8px 16px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-size: 14px;
  transition: all 0.2s ease;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 48px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 16px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  transition: all 0.2s ease;
`;

const EmptyStateTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 8px;
  transition: color 0.2s ease;
`;

const EmptyStateText = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  transition: color 0.2s ease;
`;

const Stats = styled.div`
  display: flex;
  gap: 24px;
  padding: 16px;
  background: ${({ theme }) => theme.colors.surfaceElevated};
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: 24px;
  transition: all 0.2s ease;
`;

const StatItem = styled.div``;

const StatLabel = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  font-weight: 500;
`;

const StatValue = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  transition: color 0.2s ease;
`;

type SortOption = 'rating' | 'subscribers' | 'fee' | 'recent';
type FilterOption = 'all' | 'verified' | 'subscribed';

export default function GeneratorList() {
  const { address: userAddress, isConnected } = useAccount();
  const {} = useAlphaEngine();

  const [generators, setGenerators] = useState<AlphaGenerator[]>([]);
  const [filteredGenerators, setFilteredGenerators] = useState<AlphaGenerator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy] = useState<SortOption>('rating');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [selectedGenerator, setSelectedGenerator] = useState<AlphaGenerator | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscribedGenerators, setSubscribedGenerators] = useState<Set<string>>(new Set());

  const fetchGenerators = async () => {
    try {
      setLoading(true);
      const response = await alphaEngineClient.getGenerators(true);
      setGenerators(response || []);
    } catch (error) {
      console.error('Failed to fetch generators:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSubscriptions = useCallback(async () => {
    if (!userAddress) return;

    try {
      const response = await alphaEngineClient.getUserSubscriptions(userAddress);
      const subscribed = new Set(
        response.map(sub => sub.alphaGeneratorAddress)
      );
      setSubscribedGenerators(subscribed);
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    }
  }, [userAddress]);

  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...generators];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(gen =>
        gen.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gen.walletAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gen.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply filter
    switch (filterBy) {
      case 'verified':
        filtered = filtered.filter(gen => gen.isVerified);
        break;
      case 'subscribed':
        filtered = filtered.filter(gen => subscribedGenerators.has(gen.walletAddress));
        break;
    }

    // Apply sorting
    switch (sortBy) {
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'subscribers':
        filtered.sort((a, b) => b.totalSubscribers - a.totalSubscribers);
        break;
      case 'fee':
        filtered.sort((a, b) => {
          const getFeeValue = (generator: AlphaGenerator) => {
            const fee = generator.subscriptionFee;
            if (fee === undefined || fee === null || fee === '') {
              return 0;
            }
            try {
              // Check if fee is already a decimal string (like "0.01") or wei value
              const feeStr = String(fee);

              // If it contains a decimal point, it's already in ETH
              if (feeStr.includes('.')) {
                return parseFloat(feeStr);
              } else {
                // Otherwise assume it's in wei and convert to ETH
                return parseFloat(formatEther(BigInt(feeStr)));
              }
            } catch (error) {
              console.warn('Invalid subscription fee value in sort:', fee, error);
              return 0;
            }
          };
          return getFeeValue(a) - getFeeValue(b);
        });
        break;
      case 'recent':
        filtered.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    setFilteredGenerators(filtered);
  }, [generators, searchTerm, sortBy, filterBy, subscribedGenerators]);

  // Fetch generators
  useEffect(() => {
    fetchGenerators();
  }, []);

  // Fetch user subscriptions - only when address changes
  useEffect(() => {
    if (userAddress) {
      fetchUserSubscriptions();
    }
    // Remove fetchUserSubscriptions from dependencies to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  // Apply filters and sorting
  useEffect(() => {
    applyFiltersAndSort();
    // Remove applyFiltersAndSort from dependencies to prevent loops
    // Keep only the data dependencies that should trigger re-filtering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generators, searchTerm, sortBy, filterBy, subscribedGenerators]);

  const handleSubscribe = (generator: AlphaGenerator) => {
    if (!isConnected) {
      toast.info('Please connect your wallet to subscribe');
      return;
    }

    setSelectedGenerator(generator);
    setShowSubscriptionModal(true);
  };

  const handleSubscriptionComplete = () => {
    setShowSubscriptionModal(false);
    setSelectedGenerator(null);
    fetchUserSubscriptions(); // Refresh subscriptions
  };

  const calculateStats = () => {
    const totalGenerators = generators.length;
    const verifiedCount = generators.filter(g => g.isVerified).length;
    const totalVolume = generators.reduce((sum, g) => sum + parseFloat(g.totalVolume || '0'), 0);
    const avgFee = generators.reduce((sum, g) => {
      // Safely handle subscriptionFee conversion
      const fee = g.subscriptionFee;
      if (fee === undefined || fee === null || fee === '') {
        return sum;
      }
      try {
        // Check if fee is already a decimal string (like "0.01") or wei value
        const feeStr = String(fee);
        let ethValue: number;

        // If it contains a decimal point, it's already in ETH
        if (feeStr.includes('.')) {
          ethValue = parseFloat(feeStr);
        } else {
          // Otherwise assume it's in wei and convert to ETH
          ethValue = parseFloat(formatEther(BigInt(feeStr)));
        }

        return sum + ethValue;
      } catch (error) {
        console.warn('Invalid subscription fee value:', fee, error);
        return sum;
      }
    }, 0) / (generators.length || 1);

    return { totalGenerators, verifiedCount, totalVolume, avgFee };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <Container>
        <LoadingState>Loading alpha generators...</LoadingState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>Alpha Generators</Title>
      </Header>

      <Stats>
        <StatItem>
          <StatLabel>Total Generators</StatLabel>
          <StatValue>{stats.totalGenerators || '-'}</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Verified</StatLabel>
          <StatValue>{stats.verifiedCount || '-'}</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Avg. Fee</StatLabel>
          <StatValue>{stats.avgFee ? `${stats.avgFee.toFixed(4)} ETH` : '-'}</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Your Subscriptions</StatLabel>
          <StatValue>{subscribedGenerators.size || '-'}</StatValue>
        </StatItem>
      </Stats>

      <FilterBar>
        <SearchInput
          type="text"
          placeholder="Search by name, address, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <FilterButton
          $active={filterBy === 'all'}
          onClick={() => setFilterBy('all')}
        >
          All
        </FilterButton>
        <FilterButton
          $active={filterBy === 'verified'}
          onClick={() => setFilterBy('verified')}
        >
          Verified
        </FilterButton>
        <FilterButton
          $active={filterBy === 'subscribed'}
          onClick={() => setFilterBy('subscribed')}
        >
          Subscribed
        </FilterButton>
      </FilterBar>

      {filteredGenerators.length === 0 ? (
        <EmptyState>
          <EmptyStateTitle>No generators found</EmptyStateTitle>
          <EmptyStateText>
            {searchTerm
              ? 'Try adjusting your search terms'
              : 'No active generators available at the moment'}
          </EmptyStateText>
        </EmptyState>
      ) : (
        <Grid>
          {filteredGenerators.map(generator => (
            <GeneratorCard
              key={generator.walletAddress}
              generator={generator}
              isSubscribed={subscribedGenerators.has(generator.walletAddress)}
              onSubscribe={() => handleSubscribe(generator)}
            />
          ))}
        </Grid>
      )}

      {showSubscriptionModal && selectedGenerator && (
        <SubscriptionModal
          generator={selectedGenerator}
          onClose={() => setShowSubscriptionModal(false)}
          onSuccess={handleSubscriptionComplete}
        />
      )}
    </Container>
  );
}