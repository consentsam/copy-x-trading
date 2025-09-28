import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { useAccount } from 'wagmi';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: var(--color-surface-elevated);
  border-radius: 12px;
  padding: 32px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  margin-bottom: 24px;
`;

const ModalTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
`;

const ModalSubtitle = styled.p`
  font-size: 14px;
  color: var(--color-text-muted);
`;

const FormSection = styled.div`
  margin-bottom: 24px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text);
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  &::placeholder {
    color: var(--color-text-muted);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text);
  transition: border-color 0.2s ease;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`;

const HelpText = styled.p`
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  background: ${props => props.variant === 'secondary' 
    ? 'transparent' 
    : 'var(--color-primary)'};
  color: ${props => props.variant === 'secondary' 
    ? 'var(--color-text)' 
    : 'var(--color-nav-text)'};
  border: ${props => props.variant === 'secondary' 
    ? '1px solid var(--color-border)' 
    : 'none'};
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.variant === 'secondary'
      ? 'var(--color-surface)'
      : 'var(--color-primary-hover)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SuccessMessage = styled.div`
  padding: 12px 16px;
  background: var(--color-success-muted);
  color: var(--color-success);
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background: var(--color-error-muted);
  color: var(--color-error);
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
`;

const PreviewSection = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
`;

const PreviewTitle = styled.h4`
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 12px;
`;

const PreviewContent = styled.pre`
  font-family: monospace;
  font-size: 12px;
  color: var(--color-text);
  white-space: pre-wrap;
  word-wrap: break-word;
`;

interface ABIInput {
  name: string;
  type: string;
  internalType?: string;
}

interface ProtocolConfig {
  enabled: boolean;
  functions: string[];
  abis: Record<string, {
    inputs: ABIInput[];
  }>;
  contractAddress: string;
}

interface TradeExecutionModalProps {
  strategyId: string;
  strategyName: string;
  strategy: {
    strategyJSON?: {
      protocols?: string[] | Record<string, ProtocolConfig>;
      functions?: Array<{
        protocol: string;
        function: string;
        params: Record<string, any>;
      }>;
    };
    supportedProtocols?: string[];
    functions?: Array<{
      displayName: string;
      functionName: string;
      requiredParams: string[];
      modifiableParams: string[];
    }>;
    protocol?: string;
  };
  onClose: () => void;
  onSubmit: () => void;
}

export default function TradeExecutionModal({
  strategyId,
  strategyName,
  strategy,
  onClose,
  onSubmit
}: TradeExecutionModalProps) {
  // Get available protocols from strategy configuration
  const availableProtocols = useMemo(() => {
    // First check supportedProtocols (new format)
    if (strategy?.supportedProtocols && Array.isArray(strategy.supportedProtocols)) {
      return strategy.supportedProtocols;
    }
    // Then check strategyJSON.protocols as array (current API format)
    if (strategy?.strategyJSON?.protocols && Array.isArray(strategy.strategyJSON.protocols)) {
      return strategy.strategyJSON.protocols;
    }
    // Finally check old object format for backward compatibility
    if (strategy?.strategyJSON?.protocols && typeof strategy.strategyJSON.protocols === 'object') {
      return Object.entries(strategy.strategyJSON.protocols)
        .filter(([_, data]) => (data as ProtocolConfig).enabled)
        .map(([protocol]) => protocol);
    }
    return [];
  }, [strategy?.strategyJSON?.protocols, strategy?.supportedProtocols]);

  const [selectedProtocol, setSelectedProtocol] = useState<string>('');
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [parameters, setParameters] = useState<{ [key: string]: string }>({});
  const [gasEstimate, setGasEstimate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { address } = useAccount();

  // Set default protocol and function when component mounts
  useEffect(() => {
    if (availableProtocols.length > 0 && !selectedProtocol) {
      const firstProtocol = availableProtocols[0];
      setSelectedProtocol(firstProtocol);

      // For simplified protocol format, we'll need to handle functions differently
      const strategyFunctions = strategy?.strategyJSON?.functions;
      if (strategyFunctions && strategyFunctions.length > 0) {
        const protocolFunctions = strategyFunctions
          .filter(f => f.protocol === firstProtocol)
          .map(f => f.function);
        if (protocolFunctions.length > 0) {
          setSelectedFunction(protocolFunctions[0]);
        }
      }
    }
  }, [availableProtocols, selectedProtocol, strategy?.strategyJSON?.protocols]);

  // Auto-populate onBehalfOf parameter when function changes
  useEffect(() => {
    if (selectedFunction && address) {
      // Check if this is an AAVE function with onBehalfOf parameter
      const functionFromRoot = strategy?.functions?.find(
        (f: any) => f.functionName === selectedFunction
      );

      if (functionFromRoot?.requiredParams?.includes('onBehalfOf')) {
        // Auto-populate onBehalfOf with the current wallet address
        setParameters(prevParams => ({
          ...prevParams,
          onBehalfOf: address
        }));
      }
    }
  }, [selectedFunction, address, strategy?.functions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!selectedProtocol || !selectedFunction) {
      setError('Please select a protocol and function');
      setSubmitting(false);
      return;
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL || 'http://localhost:3001';

      // Find the selected function from the strategy's functions array
      // First check new format at root level
      const functionFromRoot = strategy?.functions?.find(
        (f: any) => f.functionName === selectedFunction
      );

      // Fallback to old format
      const selectedFunctionData = strategy?.strategyJSON?.functions?.find(
        f => f.protocol.toUpperCase() === selectedProtocol.toUpperCase() && f.function === selectedFunction
      );

      if (!functionFromRoot && !selectedFunctionData) {
        throw new Error('Function configuration not found');
      }

      // For protocol strategies, we send the function configuration directly
      const payload = {
        strategyId,
        generatorAddress: address,
        protocol: selectedProtocol,
        functionName: selectedFunction,
        // Use the user-entered parameters
        parameters: parameters,
        gasEstimate: gasEstimate || "150000",
        expiryTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        // Add functionABI - required by backend for strategy-based broadcasts
        functionABI: selectedFunctionData?.abi || {
          name: selectedFunction,
          type: 'function',
          inputs: Object.keys(selectedFunctionData?.params || parameters || {}).map(key => ({
            name: key,
            type: 'string'
          }))
        },
        // Add contractAddress if available
        contractAddress: selectedFunctionData?.contractAddress || undefined
      };

      await axios.post(`${API_URL}/api/v1/trades/broadcast`, payload, {
        headers: {
          'X-Wallet-Address': address!,
          'Content-Type': 'application/json'
        }
      });

      setSuccess(true);

      // Show success message
      setTimeout(() => {
        onSubmit();
      }, 2000);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast trade');
    } finally {
      setSubmitting(false);
    }
  };

  const getExecutionParamsPreview = () => {
    // Find the selected function configuration
    const selectedFunctionData = strategy?.strategyJSON?.functions?.find(
      f => f.protocol.toUpperCase() === selectedProtocol.toUpperCase() && f.function === selectedFunction
    );

    return JSON.stringify({
      protocol: selectedProtocol,
      function: selectedFunction,
      parameters: parameters && Object.keys(parameters).length > 0
        ? parameters
        : selectedFunctionData?.params || {}
    }, null, 2);
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Execute Trade</ModalTitle>
          <ModalSubtitle>
            Broadcast trade signal to all subscribers of {strategyName}
          </ModalSubtitle>
        </ModalHeader>

        {success && (
          <SuccessMessage>
            ✅ Trade successfully broadcasted to all subscribers!
          </SuccessMessage>
        )}

        {error && (
          <ErrorMessage>
            ❌ {error}
          </ErrorMessage>
        )}

        <form onSubmit={handleSubmit}>
          <FormSection>
            <FormGroup>
              <Label>Select Protocol</Label>
              <Select
                value={selectedProtocol}
                onChange={(e) => {
                  setSelectedProtocol(e.target.value);
                  setSelectedFunction('');
                  setParameters({});
                }}
                disabled={submitting}
              >
                <option value="">Choose a protocol</option>
                {availableProtocols.map((protocol) => (
                  <option key={protocol} value={protocol}>
                    {protocol.toUpperCase()}
                  </option>
                ))}
              </Select>
            </FormGroup>

            {selectedProtocol && (
              <FormGroup>
                <Label>Select Function</Label>
                <Select
                  value={selectedFunction}
                  onChange={(e) => {
                    setSelectedFunction(e.target.value);
                    // Reset parameters but will be re-populated by useEffect for onBehalfOf
                    setParameters({});
                  }}
                  disabled={submitting}
                >
                  <option value="">Choose a function</option>
                  {(() => {
                    // Check if functions exist at the root level (new format)
                    if (strategy?.functions && Array.isArray(strategy.functions)) {
                      return strategy.functions.map((func: any) => (
                        <option key={func.functionName} value={func.functionName}>
                          {func.displayName || func.functionName}
                        </option>
                      ));
                    }
                    // Get functions for the selected protocol (old format)
                    if (strategy?.strategyJSON?.functions) {
                      return strategy.strategyJSON.functions
                        .filter(f => f.protocol.toUpperCase() === selectedProtocol.toUpperCase())
                        .map(f => f.function)
                        .map((func) => (
                          <option key={func} value={func}>
                            {func}
                          </option>
                        ));
                    }
                    // Fallback to old format if exists
                    const protocolConfig = strategy?.strategyJSON?.protocols?.[selectedProtocol] as ProtocolConfig;
                    if (protocolConfig?.functions) {
                      return protocolConfig.functions.map((func) => (
                        <option key={func} value={func}>
                          {func}
                        </option>
                      ));
                    }
                    return [];
                  })()}
                </Select>
              </FormGroup>
            )}

            {selectedFunction && selectedProtocol && (
              <FormGroup>
                <Label>Function Parameters</Label>
                {(() => {
                  // First check new format at root level
                  const functionFromRoot = strategy?.functions?.find(
                    (f: any) => f.functionName === selectedFunction
                  );

                  if (functionFromRoot?.requiredParams && functionFromRoot.requiredParams.length > 0) {
                    // Display input fields for each required parameter
                    return functionFromRoot.requiredParams.map((param: string) => {
                      const isOnBehalfOf = param === 'onBehalfOf';
                      const isReadOnly = isOnBehalfOf; // Make onBehalfOf read-only

                      return (
                        <div key={param} style={{ marginBottom: '12px' }}>
                          <Label>
                            {param.replace(/([A-Z])/g, ' $1').trim()}
                            {isOnBehalfOf && ' (Auto-filled)'}
                          </Label>
                          <Input
                            type="text"
                            value={parameters[param] || ''}
                            onChange={(e) => !isReadOnly && setParameters({...parameters, [param]: e.target.value})}
                            placeholder={isOnBehalfOf ? 'Your wallet address' : `Enter ${param}`}
                            disabled={submitting || isReadOnly}
                            style={isReadOnly ? {
                              backgroundColor: 'var(--color-surface)',
                              opacity: 0.8,
                              cursor: 'not-allowed'
                            } : {}}
                          />
                          <HelpText>
                            {isOnBehalfOf
                              ? 'Auto-populated with your wallet address for AAVE protocol execution'
                              : functionFromRoot.modifiableParams?.includes(param)
                                ? 'Modifiable parameter - AlphaConsumers can change this'
                                : 'Required parameter'}
                          </HelpText>
                        </div>
                      );
                    });
                  }

                  // Fallback to old format
                  const selectedFunctionData = strategy?.strategyJSON?.functions?.find(
                    f => f.protocol.toUpperCase() === selectedProtocol.toUpperCase() && f.function === selectedFunction
                  );

                  if (selectedFunctionData?.params) {
                    // Display the pre-configured parameters
                    return Object.entries(selectedFunctionData.params).map(([key, value]) => (
                      <div key={key} style={{ marginBottom: '12px' }}>
                        <Label>{key}</Label>
                        <Input
                          type="text"
                          value={String(value)}
                          disabled={true}
                          style={{ backgroundColor: 'var(--color-surface)', opacity: 0.7 }}
                        />
                        <HelpText>Pre-configured parameter</HelpText>
                      </div>
                    ));
                  }
                  return <HelpText>No parameters required for this function</HelpText>;
                })()}
              </FormGroup>
            )}

            <FormGroup>
              <Label>Gas Estimate (Optional)</Label>
              <Input
                type="text"
                value={gasEstimate}
                onChange={(e) => setGasEstimate(e.target.value)}
                placeholder="e.g., 150000"
                disabled={submitting}
              />
              <HelpText>Estimated gas units for this transaction</HelpText>
            </FormGroup>
          </FormSection>

          {selectedProtocol && selectedFunction && (
            <PreviewSection>
              <PreviewTitle>Execution Parameters Preview</PreviewTitle>
              <PreviewContent>{getExecutionParamsPreview()}</PreviewContent>
            </PreviewSection>
          )}

          <ButtonGroup>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !selectedProtocol || !selectedFunction}
            >
              {submitting ? 'Broadcasting...' : '🚀 Broadcast Trade'}
            </Button>
          </ButtonGroup>
        </form>
      </ModalContent>
    </ModalOverlay>
  );
}