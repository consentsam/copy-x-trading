import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

import { successResponse, errorResponse, serverErrorResponse } from '@/app/api/api-utils';
import { subscriptionManager } from '../../../../../../src/libraries/subscription-manager';

import AlphaEngineABI from '../../../../../../../frontend/src/contracts/AlphaEngineSubscription.abi.json';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const generatorAddress = params.address;

    // Parse JSON with proper error handling
    let body: any;
    try {
      body = await req.json();
    } catch (error) {
      return errorResponse('Invalid or missing JSON body', 400, req);
    }

    // Validate parsed object shape
    if (!body || typeof body !== 'object') {
      return errorResponse('Request body must be a valid JSON object', 400, req);
    }

    const { subscriberWallet, subscriptionTxHash, fee } = body;

    // Validate required fields exist and are strings
    if (!subscriberWallet || typeof subscriberWallet !== 'string') {
      return errorResponse('subscriberWallet is required and must be a string', 400, req);
    }

    if (!subscriptionTxHash || typeof subscriptionTxHash !== 'string') {
      return errorResponse('subscriptionTxHash is required and must be a string', 400, req);
    }

    // Normalize addresses
    const normalizedGeneratorAddress = generatorAddress.toLowerCase();
    const normalizedSubscriberAddress = subscriberWallet.toLowerCase();

    // Validate and normalize fee
    let subscriptionFee: string;

    if (fee) {
      // Use fee from client payload
      subscriptionFee = validateAndNormalizeFee(fee);
    } else {
      // Query on-chain generator fee
      subscriptionFee = await queryOnChainGeneratorFee(normalizedGeneratorAddress);
    }

    // Create subscription record in database using the subscribe method
    const subscription = await subscriptionManager.subscribe({
      generatorAddress: normalizedGeneratorAddress,
      consumerAddress: normalizedSubscriberAddress,
      fee: subscriptionFee,
      encryptedConsumerAddress: body.encryptedConsumerAddress || undefined,
      subscriptionTxHash
    });

    // Return the created subscription
    return successResponse({
      subscriptionId: subscription.subscriptionId,
      alphaGeneratorAddress: subscription.alphaGeneratorAddress,
      alphaConsumerAddress: subscription.alphaConsumerAddress,
      subscriptionTxHash: subscription.subscriptionTxHash,
      isActive: subscription.isActive,
      subscribedAt: subscription.subscribedAt.toISOString(),
      expiresAt: subscription.expiresAt.toISOString(),
      message: 'Subscription created successfully'
    }, 'Subscription registered', 201, req);

  } catch (error: any) {
    console.error('[Subscribe API] Error:', error);

    // Check if it's a duplicate subscription
    if (error.message?.includes('already subscribed')) {
      return errorResponse('Already subscribed to this generator', 409, req);
    }

    // Check for fee-related errors
    if (error.message?.includes('Invalid fee')) {
      return errorResponse(error.message, 400, req);
    }

    return serverErrorResponse(error, req);
  }
}

/**
 * Validate and normalize fee value
 * Accepts string or number, ensures it's a valid wei amount
 */
function validateAndNormalizeFee(fee: string | number): string {
  try {
    // Handle empty or null values
    if (!fee || (typeof fee === 'string' && fee.trim() === '')) {
      throw new Error('Invalid fee: fee cannot be empty');
    }

    // Convert to string for processing
    const feeStr = fee.toString().trim();

    // Check if it's a valid numeric string
    if (!/^\d+(\.\d+)?$/.test(feeStr)) {
      throw new Error('Invalid fee: must be a numeric value');
    }

    // Convert to BigInt to ensure it's a valid wei amount
    const feeBigInt = ethers.parseEther(feeStr.includes('.') ? feeStr : ethers.formatEther(BigInt(feeStr)));

    // Ensure fee is positive
    if (feeBigInt <= 0n) {
      throw new Error('Invalid fee: must be greater than 0');
    }

    return feeBigInt.toString();
  } catch (error: any) {
    throw new Error(`Invalid fee: ${error.message}`);
  }
}

/**
 * Query on-chain generator fee from smart contract
 */
async function queryOnChainGeneratorFee(generatorAddress: string): Promise<string> {
  try {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || 'http://localhost:8545';
    const contractAddress = process.env.ALPHA_ENGINE_CONTRACT_ADDRESS;

    if (!contractAddress) {
      throw new Error('Contract address not configured');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, AlphaEngineABI, provider);

    // Query generator info from contract
    const generatorInfo = await contract.generators(generatorAddress);

    if (!generatorInfo || !generatorInfo.subscriptionFee) {
      // Fallback to default fee if generator not found or no fee set
      console.warn(`[Subscribe API] Generator ${generatorAddress} not found on-chain, using default fee`);
      return '50000000000000000'; // 0.05 ETH default
    }

    return generatorInfo.subscriptionFee.toString();
  } catch (error: any) {
    console.error('[Subscribe API] Error querying on-chain fee:', error);
    // Fallback to default fee on error
    return '50000000000000000'; // 0.05 ETH default
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const generatorAddress = params.address.toLowerCase();

    // Get all subscriptions for this generator
    const subscriptions = await subscriptionManager.getGeneratorSubscribers(generatorAddress);

    return successResponse({
      generatorAddress,
      subscriptions: subscriptions.map(sub => ({
        subscriptionId: sub.subscriptionId,
        alphaConsumerAddress: sub.alphaConsumerAddress,
        subscribedAt: sub.subscribedAt.toISOString(),
        expiresAt: sub.expiresAt.toISOString(),
        isActive: sub.isActive
      })),
      totalSubscribers: subscriptions.length,
      activeSubscribers: subscriptions.filter(s => s.isActive).length
    }, 'Subscriptions retrieved', 200, req);

  } catch (error: any) {
    return serverErrorResponse(error, req);
  }
}
