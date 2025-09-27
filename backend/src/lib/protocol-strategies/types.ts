/**
 * Protocol Strategies Types
 * Feature: 003-protocol-strategy-integration
 */

export type ProtocolType = 'AAVE' | 'UNISWAP';

export interface StrategyFunction {
  functionName: string;
  displayName: string;
  requiredParams: string[];
  modifiableParams: string[];
}

export interface Strategy {
  id: string;
  alphaGeneratorId: string;
  name: string;
  description: string;
  protocol: ProtocolType;
  functions: StrategyFunction[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStrategyInput {
  alphaGeneratorId: string;
  name: string;
  description: string;
  protocol: ProtocolType;
  functions: string[]; // Function names to include
}

export interface UpdateStrategyInput {
  name?: string;
  description?: string;
  functions?: string[];
  isActive?: boolean;
}

export interface StrategyFilter {
  alphaGeneratorId?: string;
  protocol?: ProtocolType;
  isActive?: boolean;
  search?: string;
}

export interface StrategyStats {
  totalStrategies: number;
  activeStrategies: number;
  strategiesByProtocol: Record<ProtocolType, number>;
}