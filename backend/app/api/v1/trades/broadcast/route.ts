import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { alphaGeneratorsTable } from '@/db/schema/alpha-generators-schema';
import { strategiesTable } from '@/db/schema/strategies-schema';
import { eq } from 'drizzle-orm';
import { ethers } from 'ethers';
import { z } from 'zod';
import { tradeLifecycleService } from '@/lib/services/trade-lifecycle.service';
import { ProtocolConfigService } from '@/lib/services/protocol-config.service';
import { ProtocolAction } from '@/lib/protocols/action-mappings';

const BroadcastTradeSchema = z.object({
  generatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  protocolId: z.string().optional(),
  action: z.nativeEnum(ProtocolAction).optional(),
  params: z.record(z.string(), z.any()).optional(),
  expiryMinutes: z.number().min(1).max(60).default(5),
  gasLimit: z.string().optional(),
  value: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  // New fields for strategy-based execution
  strategyId: z.string().optional(),
  protocol: z.string().optional(),
  functionName: z.string().optional(),
  functionABI: z.any().optional(),
  contractAddress: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  gasEstimate: z.string().optional(),
  expiryTime: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validation = BroadcastTradeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const {
      generatorAddress,
      protocolId,
      action,
      params,
      expiryMinutes,
      gasLimit,
      value,
      metadata,
      strategyId,
      protocol,
      functionName,
      functionABI,
      contractAddress,
      parameters,
      gasEstimate,
      expiryTime
    } = validation.data;
    
    const [generator] = await db
      .select()
      .from(alphaGeneratorsTable)
      .where(eq(alphaGeneratorsTable.generatorAddress, generatorAddress))
      .limit(1);
    
    if (!generator || !generator.isActive) {
      return NextResponse.json({
        error: 'Generator not found or inactive',
      }, { status: 404 });
    }

    let confirmationIds;
    let responseData;

    // Handle strategy-based broadcasts (new flow)
    if (strategyId && functionName && functionABI) {
      // Load strategy to verify ownership and get additional data
      const [strategy] = await db
        .select()
        .from(strategiesTable)
        .where(eq(strategiesTable.strategyId, strategyId))
        .limit(1);

      if (!strategy) {
        return NextResponse.json({
          error: 'Strategy not found',
        }, { status: 404 });
      }

      const expiryTimeDate = expiryTime
        ? new Date(expiryTime)
        : new Date(Date.now() + expiryMinutes * 60 * 1000);

      // Broadcast with strategy-specific data
      confirmationIds = await tradeLifecycleService.broadcastTrade({
        generatorAddress,
        strategyId,
        protocolId: protocol || protocolId,
        action: action || ('custom' as ProtocolAction),
        executionData: JSON.stringify({
          functionName,
          parameters,
          contractAddress,
        }),
        expiryTime: expiryTimeDate,
        gasEstimate: gasEstimate || '150000',
        metadata: {
          ...metadata,
          functionName,
          functionABI,
          contractAddress,
          parameters,
          protocol,
        },
        // Pass strategy-specific fields
        functionName,
        functionABI,
        parameters,
        contractAddress,
      });

      responseData = {
        confirmationIds,
        subscriberCount: confirmationIds.length,
        expiryTime: expiryTimeDate,
        trade: {
          generatorAddress,
          strategyId,
          protocol,
          functionName,
          parameters,
          contractAddress,
          gasEstimate: gasEstimate || '150000',
        },
      };
    } else {
      // Handle traditional protocol-based broadcasts (existing flow)
      if (!protocolId || !action || !params) {
        return NextResponse.json({
          error: 'Missing required fields for protocol-based broadcast',
        }, { status: 400 });
      }

      const protocolValidation = await ProtocolConfigService.validateProtocolAction(
        protocolId,
        action,
        params
      );

      if (!protocolValidation.valid) {
        return NextResponse.json({
          error: 'Invalid protocol action',
          details: protocolValidation.errors,
        }, { status: 400 });
      }

      const encodedData = await ProtocolConfigService.encodeExecutionData({
        protocolId,
        action,
        params,
        gasLimit: gasLimit ? BigInt(gasLimit) : undefined,
        value: value ? BigInt(value) : undefined,
      });

      const expiryTimeDate = new Date(Date.now() + expiryMinutes * 60 * 1000);

      confirmationIds = await tradeLifecycleService.broadcastTrade({
        generatorAddress,
        protocolId,
        action,
        executionData: encodedData.encoded,
        expiryTime: expiryTimeDate,
        gasEstimate: encodedData.gasEstimate.toString(),
        metadata: {
          ...metadata,
          protocolAddress: encodedData.protocolAddress,
          value: encodedData.value.toString(),
          params,
        },
      });

      responseData = {
        confirmationIds,
        subscriberCount: confirmationIds.length,
        expiryTime: expiryTimeDate,
        trade: {
          generatorAddress,
          protocolId,
          action,
          params,
          gasEstimate: encodedData.gasEstimate.toString(),
        },
      };
    }
    
    await db
      .update(alphaGeneratorsTable)
      .set({
        performanceStats: {
          totalTrades: (generator.performanceStats as any)?.totalTrades + 1 || 1,
          successRate: (generator.performanceStats as any)?.successRate || 0,
          avgReturns: (generator.performanceStats as any)?.avgReturns || 0,
          totalVolume: (generator.performanceStats as any)?.totalVolume || 0,
        },
        updatedAt: new Date(),
      })
      .where(eq(alphaGeneratorsTable.generatorAddress, generatorAddress));
    
    console.log(
      `[BroadcastTrade] Broadcasted trade from ${generatorAddress}: ${
        strategyId ? `Strategy ${strategyId}` : `${protocolId}/${action}`
      }`
    );

    return NextResponse.json({
      data: responseData,
      message: `Trade broadcasted to ${confirmationIds.length} subscribers`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[BroadcastTrade] Error:', error);
    return NextResponse.json({
      error: 'Failed to broadcast trade',
      details: error.message,
    }, { status: 500 });
  }
}