import React, { useState } from 'react';
import styled from 'styled-components';
import { BaseCard } from '../Containers';
import { StatusBadge } from '../Common';
import Pressable from '../PressableButton/Pressable';
import { TradeConfirmation } from '@/types/alphaengine';

interface FunctionABIInput {
  name: string;
  type: string;
  internalType?: string;
}

interface FunctionABI {
  inputs?: FunctionABIInput[];
  name?: string;
  outputs?: FunctionABIInput[];
}

interface TradeConfirmationItemProps {
  confirmation: TradeConfirmation;
  onApprove?: (confirmationId: string) => void;
  onReject?: (confirmationId: string) => void;
  isProcessing?: boolean;
}

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const ConfirmationInfo = styled.div`
  flex: 1;
`;

const ConfirmationId = styled.div`
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: monospace;
  margin-bottom: 4px;
`;

const StrategyInfo = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
`;

const DetailsSection = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 12px;
  margin: 12px 0;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 4px;
  }
`;

const DetailLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
`;

const DetailValue = styled.span`
  font-size: 12px;
  color: var(--color-text);
  font-family: monospace;
`;

const ParamsSection = styled.div`
  margin: 12px 0;
`;

const ParamsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const ParamsTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const ExpandButton = styled.button`
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  
  &:hover {
    background: var(--color-primary-muted);
  }
`;

const JsonViewer = styled.pre`
  background: var(--color-surface-alt);
  color: var(--color-text);
  padding: 12px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.4;
  overflow-x: auto;
  max-height: 200px;
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
`;

const ActionSection = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
`;

const ParameterInput = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 13px;
  margin-top: 4px;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`;

const ParameterSection = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 12px;
  margin: 12px 0;
`;

const ParameterLabel = styled.label`
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
`;

const ParameterType = styled.span`
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: normal;
`;

const ApproveButton = styled.button`
  flex: 1;
  background-color: var(--color-success);
  color: var(--color-nav-text);
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: color-mix(in srgb, var(--color-success) 85%, transparent);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

const RejectButton = styled.button`
  background-color: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: 6px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--color-danger-surface);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

const TimeInfo = styled.div`
  font-size: 11px;
  color: var(--color-text-subtle);
  margin-top: 8px;
`;

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const formatGasEstimate = (gas: string): string => {
  try {
    const gasNum = parseInt(gas);
    return gasNum.toLocaleString();
  } catch {
    return gas;
  }
};

const TradeConfirmationItem: React.FC<TradeConfirmationItemProps> = ({
  confirmation,
  onApprove,
  onReject,
  isProcessing = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedParameters, setEditedParameters] = useState<{ [key: string]: string }>({});
  const [showParameterEdit, setShowParameterEdit] = useState(false);

  // Initialize edited parameters from metadata
  React.useEffect(() => {
    if (confirmation.metadata?.parameters) {
      setEditedParameters(confirmation.metadata.parameters as { [key: string]: string });
    }
  }, [confirmation]);

  const getStatus = () => {
    if (confirmation.isExecuted) return 'success';
    if (isProcessing) return 'pending';
    return 'warning';
  };

  const getStatusLabel = () => {
    if (confirmation.isExecuted) return 'Executed';
    if (isProcessing) return 'Processing';
    return 'Pending';
  };

  return (
    <BaseCard>
      <Header>
        <ConfirmationInfo>
          <ConfirmationId>ID: {confirmation.confirmationId}</ConfirmationId>
          <StrategyInfo>Strategy: {confirmation.strategyId}</StrategyInfo>
        </ConfirmationInfo>
        <StatusBadge 
          status={getStatus()}
          label={getStatusLabel()}
          size="small"
        />
      </Header>

      <DetailsSection>
        <DetailRow>
          <DetailLabel>Protocol</DetailLabel>
          <DetailValue>
            {(confirmation.metadata?.protocol as string) || confirmation.executionParams?.protocol || 'N/A'}
          </DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Function</DetailLabel>
          <DetailValue>
            {(confirmation.metadata?.functionName as string) || confirmation.executionParams?.action || 'N/A'}
          </DetailValue>
        </DetailRow>
        {Boolean(confirmation.metadata?.contractAddress) && (
          <DetailRow>
            <DetailLabel>Contract</DetailLabel>
            <DetailValue>{(confirmation.metadata?.contractAddress as string).slice(0, 10)}...</DetailValue>
          </DetailRow>
        )}
        {confirmation.gasEstimate && (
          <DetailRow>
            <DetailLabel>Gas Estimate</DetailLabel>
            <DetailValue>{formatGasEstimate(confirmation.gasEstimate)}</DetailValue>
          </DetailRow>
        )}
        {confirmation.executionTxHash && (
          <DetailRow>
            <DetailLabel>Tx Hash</DetailLabel>
            <DetailValue>{confirmation.executionTxHash.slice(0, 10)}...</DetailValue>
          </DetailRow>
        )}
      </DetailsSection>

      <ParamsSection>
        <ParamsHeader>
          <ParamsTitle>Execution Parameters</ParamsTitle>
          <ExpandButton onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </ExpandButton>
        </ParamsHeader>
        {isExpanded && (
          <JsonViewer>
            {JSON.stringify(confirmation.executionParams || confirmation.metadata?.parameters, null, 2)}
          </JsonViewer>
        )}
      </ParamsSection>

      {/* Parameter editing section for strategy-based executions */}
      {Boolean(confirmation.metadata?.functionABI) && !confirmation.isExecuted && (
        <ParameterSection>
          <ParamsHeader>
            <ParamsTitle>Edit Parameters Before Execution</ParamsTitle>
            <ExpandButton onClick={() => setShowParameterEdit(!showParameterEdit)}>
              {showParameterEdit ? 'Hide' : 'Edit'}
            </ExpandButton>
          </ParamsHeader>

          {showParameterEdit && (
            <div style={{ marginTop: '12px' }}>
              {(confirmation.metadata?.functionABI as FunctionABI)?.inputs?.map((input: FunctionABIInput) => (
                <div key={input.name} style={{ marginBottom: '12px' }}>
                  <ParameterLabel>
                    {input.name} <ParameterType>({input.type})</ParameterType>
                  </ParameterLabel>
                  <ParameterInput
                    type="text"
                    value={editedParameters[input.name] || ''}
                    onChange={(e) => setEditedParameters({
                      ...editedParameters,
                      [input.name]: e.target.value
                    })}
                    placeholder={`Enter ${input.name}`}
                  />
                </div>
              ))}
            </div>
          )}
        </ParameterSection>
      )}

      {!confirmation.isExecuted && (
        <ActionSection>
          {onApprove && (
            <Pressable disabled={isProcessing}>
              <ApproveButton 
                onClick={() => onApprove(confirmation.confirmationId)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Approve & Execute'}
              </ApproveButton>
            </Pressable>
          )}
          {onReject && (
            <RejectButton 
              onClick={() => onReject(confirmation.confirmationId)}
              disabled={isProcessing}
            >
              Reject
            </RejectButton>
          )}
        </ActionSection>
      )}

      <TimeInfo>
        Created: {formatTimestamp(confirmation.createdAt)}
        {confirmation.updatedAt !== confirmation.createdAt && (
          <> • Updated: {formatTimestamp(confirmation.updatedAt)}</>
        )}
      </TimeInfo>
    </BaseCard>
  );
};

export default TradeConfirmationItem;
