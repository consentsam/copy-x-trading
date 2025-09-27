import React, { useMemo } from 'react';
import styled, { useTheme } from 'styled-components';
import { BaseCard } from '../Containers';
import { StatusBadge, MetricRow } from '../Common';
import Pressable from '../PressableButton/Pressable';
import { Strategy } from '@/types/alphaengine';
import { formatEther } from 'viem';

interface StrategyCardProps {
  strategy: Strategy;
  onSubscribe?: () => void;
  onViewDetails?: () => void;
  isSubscribed?: boolean;
  isConsumerView?: boolean;
}

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const TitleSection = styled.div`
  flex: 1;
`;

const StrategyTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0 0 4px 0;
  transition: color 0.2s ease;
`;

const StrategyDescription = styled.p`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0;
  line-height: 1.4;
  transition: color 0.2s ease;
`;

const ProtocolsSection = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
`;

const ProtocolPill = styled.span`
  display: inline-block;
  padding: 4px 10px;
  background: ${({ theme }) => theme.colors.primaryMuted};
  color: ${({ theme }) => theme.colors.sidebarActiveText};
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
`;

const ActionSection = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.subtleBorder};
  transition: border-color 0.2s ease;
`;

const SubscribeButton = styled.button<{ isSubscribed?: boolean }>`
  flex: 1;
  background-color: ${({ theme, isSubscribed }) =>
    isSubscribed ? theme.colors.success : theme.colors.primary};
  color: ${({ theme }) => theme.colors.navText};
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: ${({ isSubscribed }) => (isSubscribed ? 'default' : 'pointer')};
  transition: all 0.2s ease;
  opacity: ${({ isSubscribed }) => (isSubscribed ? 0.85 : 1)};

  &:hover {
    ${({ isSubscribed, theme }) =>
      !isSubscribed && `
        background-color: ${theme.colors.primaryHover};
        transform: translateY(-1px);
      `}
  }

  &:active {
    ${({ isSubscribed }) =>
      !isSubscribed && `
        transform: translateY(0);
      `}
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const ViewDetailsButton = styled.button`
  background-color: transparent;
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: 6px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryMuted};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;


const EMPTY_PLACEHOLDER = '—';

const formatWeiToEth = (weiValue?: string | bigint | null): string => {
  if (weiValue === undefined || weiValue === null) {
    return EMPTY_PLACEHOLDER;
  }

  try {
    const normalized = typeof weiValue === 'bigint' ? weiValue : BigInt(weiValue);
    const ethValue = parseFloat(formatEther(normalized));
    if (!Number.isFinite(ethValue)) {
      return EMPTY_PLACEHOLDER;
    }
    return `${ethValue.toFixed(4)} ETH`;
  } catch (error) {
    console.warn('Failed to format wei value:', error);
    return EMPTY_PLACEHOLDER;
  }
};

const formatInteger = (value?: number | null): string => {
  if (value === undefined || value === null) {
    return '0';
  }

  return Number.isFinite(value) ? value.toLocaleString() : '0';
};

const formatRate = (value?: number | null): string => {
  if (value === undefined || value === null) {
    return '0%';
  }

  return Number.isFinite(value) ? `${value.toFixed(1)}%` : '0%';
};

const formatAddress = (address?: string | null): string => {
  if (!address || address.length === 0) {
    return EMPTY_PLACEHOLDER;
  }

  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  onSubscribe,
  onViewDetails,
  isSubscribed = false
}) => {
  const theme = useTheme();

  const metrics = useMemo(() => {
    const executionStats = strategy.executionStats || {
      executedTrades: 0,
      totalTrades: 0,
      executionRate: 0,
    };

    return [
      {
        label: 'Strategy Executions',
        value: formatInteger(executionStats.executedTrades),
        color: theme.colors.success,
      },
      {
        label: 'Success Rate',
        value: formatRate(executionStats.executionRate),
        color: theme.colors.success,
      },
      {
        label: 'Total Volume',
        value: formatWeiToEth(strategy.totalVolume),
        color: theme.colors.text,
      },
      {
        label: 'Generator',
        value: formatAddress(strategy.alphaGeneratorAddress),
        color: theme.colors.textMuted,
      },
    ];
  }, [strategy, theme]);

  return (
    <BaseCard>
      <CardHeader>
        <TitleSection>
          <StrategyTitle>{strategy.strategyName}</StrategyTitle>
          {strategy.strategyDescription && (
            <StrategyDescription>
              {strategy.strategyDescription}
            </StrategyDescription>
          )}
        </TitleSection>
        <StatusBadge 
          status={strategy.isActive ? 'active' : 'inactive'}
          size="medium"
        />
      </CardHeader>

      {strategy.supportedProtocols && strategy.supportedProtocols.length > 0 && (
        <ProtocolsSection>
          {strategy.supportedProtocols.map((protocol, index) => (
            <ProtocolPill key={index}>{protocol}</ProtocolPill>
          ))}
        </ProtocolsSection>
      )}

      <MetricRow metrics={metrics} columns={2} />

      <ActionSection>
        {onSubscribe && (
          <Pressable disabled={isSubscribed}>
            <SubscribeButton
              onClick={onSubscribe}
              isSubscribed={isSubscribed}
              disabled={isSubscribed}
            >
              {isSubscribed ? '✓ Subscribed' : 'Subscribe'}
            </SubscribeButton>
          </Pressable>
        )}
        {onViewDetails && (
          <ViewDetailsButton onClick={onViewDetails}>
            View Details
          </ViewDetailsButton>
        )}
      </ActionSection>
    </BaseCard>
  );
};

export default StrategyCard;
