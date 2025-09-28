import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { ethers } from 'ethers';
import { useAccount, useWalletClient } from 'wagmi';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const Title = styled.h2`
  font-size: 24px;
  margin-bottom: 20px;
  color: #333;
`;

const TradeCard = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
`;

const TradeHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
`;

const Protocol = styled.span`
  background: #4CAF50;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
`;

const FunctionName = styled.h3`
  font-size: 18px;
  color: #333;
  margin: 0;
`;

const TimeLeft = styled.div`
  color: #666;
  font-size: 14px;
`;

const ParameterSection = styled.div`
  margin: 15px 0;
`;

const ParameterTitle = styled.h4`
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ParameterGrid = styled.div`
  display: grid;
  gap: 10px;
`;

const Parameter = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 14px;

  label {
    color: #666;
    font-weight: 500;
  }

  span {
    color: #333;
    font-family: monospace;
    word-break: break-all;
  }
`;

const ModifiableInput = styled.input`
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
  width: 200px;
  text-align: right;

  &:focus {
    outline: none;
    border-color: #4CAF50;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${props => props.variant === 'primary' && `
    background: #4CAF50;
    color: white;
    &:hover:not(:disabled) {
      background: #45a049;
    }
  `}

  ${props => props.variant === 'secondary' && `
    background: #f0f0f0;
    color: #333;
    &:hover:not(:disabled) {
      background: #e0e0e0;
    }
  `}

  ${props => props.variant === 'danger' && `
    background: #f44336;
    color: white;
    &:hover:not(:disabled) {
      background: #da190b;
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadingSpinner = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #999;

  h3 {
    font-size: 20px;
    margin-bottom: 10px;
  }

  p {
    font-size: 14px;
  }
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;

  ${props => props.status === 'PENDING' && `
    background: #FFC107;
    color: #333;
  `}

  ${props => props.status === 'EXECUTING' && `
    background: #2196F3;
    color: white;
  `}

  ${props => props.status === 'EXECUTED' && `
    background: #4CAF50;
    color: white;
  `}

  ${props => props.status === 'REJECTED' && `
    background: #f44336;
    color: white;
  `}
`;

interface PendingTrade {
  confirmationId: string;
  broadcastId: string;
  protocol: string;
  functionName: string;
  functionABI: any;
  contractAddress: string;
  originalParameters: Record<string, any>;
  modifiedParameters: Record<string, any>;
  gasEstimate: string;
  expiryTime: string;
  status: string;
  generatorAddress: string;
  strategyName: string;
}

export const PendingTradesExecutor: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [modifiedParams, setModifiedParams] = useState<Record<string, Record<string, any>>>({});

  useEffect(() => {
    if (isConnected && address) {
      fetchPendingTrades();
    }
  }, [isConnected, address]);

  const fetchPendingTrades = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${API_URL}/api/v1/trades/pending`, {
        headers: {
          'X-Wallet-Address': address!,
        }
      });

      if (response.data.success || response.data.isSuccess) {
        setPendingTrades(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleParameterChange = (confirmationId: string, paramName: string, value: string) => {
    setModifiedParams(prev => ({
      ...prev,
      [confirmationId]: {
        ...prev[confirmationId],
        [paramName]: value
      }
    }));
  };

  const handleExecuteTrade = async (trade: PendingTrade) => {
    if (!walletClient) {
      alert('Please connect your wallet');
      return;
    }

    try {
      setExecuting(trade.confirmationId);

      // Get the modified parameters or use original ones
      const finalParams = {
        ...trade.originalParameters,
        ...modifiedParams[trade.confirmationId],
        // Always override onBehalfOf with the current user's address for AAVE
        ...(trade.protocol === 'AAVE' && trade.originalParameters.onBehalfOf ? { onBehalfOf: address } : {})
      };

      // Create the contract interface
      const iface = new ethers.Interface([trade.functionABI]);

      // Encode the function call
      const functionData = iface.encodeFunctionData(
        trade.functionName,
        Object.values(finalParams)
      );

      // Execute the transaction
      const tx = await walletClient.sendTransaction({
        to: trade.contractAddress as `0x${string}`,
        data: functionData as `0x${string}`,
        gas: BigInt(trade.gasEstimate || '150000'),
      });

      // Update the confirmation status in the backend
      const API_URL = process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL || 'http://localhost:3001';
      await axios.post(`${API_URL}/api/v1/trades/confirm`, {
        confirmationId: trade.confirmationId,
        transactionHash: tx,
        status: 'EXECUTED',
        modifiedParameters: finalParams
      }, {
        headers: {
          'X-Wallet-Address': address!,
        }
      });

      alert(`Trade executed successfully! Transaction: ${tx}`);

      // Refresh the pending trades
      fetchPendingTrades();
    } catch (error: any) {
      console.error('Failed to execute trade:', error);
      alert(`Failed to execute trade: ${error.message}`);
    } finally {
      setExecuting(null);
    }
  };

  const handleRejectTrade = async (trade: PendingTrade) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL || 'http://localhost:3001';
      await axios.post(`${API_URL}/api/v1/trades/confirm`, {
        confirmationId: trade.confirmationId,
        status: 'REJECTED'
      }, {
        headers: {
          'X-Wallet-Address': address!,
        }
      });

      alert('Trade rejected');
      fetchPendingTrades();
    } catch (error: any) {
      console.error('Failed to reject trade:', error);
      alert(`Failed to reject trade: ${error.message}`);
    }
  };

  const calculateTimeLeft = (expiryTime: string) => {
    const now = Date.now();
    const expiry = new Date(expiryTime).getTime();
    const diff = expiry - now;

    if (diff <= 0) return 'Expired';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  if (!isConnected) {
    return (
      <Container>
        <EmptyState>
          <h3>Connect Your Wallet</h3>
          <p>Please connect your wallet to view pending trades</p>
        </EmptyState>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container>
        <LoadingSpinner>Loading pending trades...</LoadingSpinner>
      </Container>
    );
  }

  if (pendingTrades.length === 0) {
    return (
      <Container>
        <EmptyState>
          <h3>No Pending Trades</h3>
          <p>You don't have any pending trades to execute at the moment</p>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <Title>Pending Trades ({pendingTrades.length})</Title>

      {pendingTrades.map(trade => {
        const params = modifiedParams[trade.confirmationId] || {};
        const finalParams = { ...trade.originalParameters, ...params };
        const modifiableParams = trade.functionABI?.inputs?.filter((input: any) =>
          ['amount', 'quantity', 'slippage'].includes(input.name)
        ).map((input: any) => input.name) || ['amount'];

        return (
          <TradeCard key={trade.confirmationId}>
            <TradeHeader>
              <div>
                <Protocol>{trade.protocol}</Protocol>
                <FunctionName>{trade.functionName}</FunctionName>
              </div>
              <div>
                <StatusBadge status={trade.status}>{trade.status}</StatusBadge>
                <TimeLeft>Expires in: {calculateTimeLeft(trade.expiryTime)}</TimeLeft>
              </div>
            </TradeHeader>

            <ParameterSection>
              <ParameterTitle>Strategy: {trade.strategyName}</ParameterTitle>
              <ParameterTitle>Generator: {trade.generatorAddress.slice(0, 6)}...{trade.generatorAddress.slice(-4)}</ParameterTitle>
            </ParameterSection>

            <ParameterSection>
              <ParameterTitle>Parameters</ParameterTitle>
              <ParameterGrid>
                {Object.entries(finalParams).map(([key, value]) => (
                  <Parameter key={key}>
                    <label>{key}:</label>
                    {modifiableParams.includes(key) ? (
                      <ModifiableInput
                        type="text"
                        value={params[key] || value}
                        onChange={(e) => handleParameterChange(trade.confirmationId, key, e.target.value)}
                        disabled={executing === trade.confirmationId}
                      />
                    ) : (
                      <span>
                        {key === 'onBehalfOf' && trade.protocol === 'AAVE'
                          ? address
                          : String(value).length > 42
                            ? `${String(value).slice(0, 6)}...${String(value).slice(-4)}`
                            : String(value)
                        }
                      </span>
                    )}
                  </Parameter>
                ))}
              </ParameterGrid>
            </ParameterSection>

            <ButtonGroup>
              <Button
                variant="primary"
                onClick={() => handleExecuteTrade(trade)}
                disabled={executing === trade.confirmationId || trade.status !== 'PENDING'}
              >
                {executing === trade.confirmationId ? 'Executing...' : '✅ Execute Trade'}
              </Button>
              <Button
                variant="danger"
                onClick={() => handleRejectTrade(trade)}
                disabled={executing === trade.confirmationId || trade.status !== 'PENDING'}
              >
                ❌ Reject
              </Button>
            </ButtonGroup>
          </TradeCard>
        );
      })}
    </Container>
  );
};