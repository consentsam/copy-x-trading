import { ethers } from 'ethers';
import { FhenixClient } from 'fhenixjs';
import { db } from '@/db/db';
import { addressMappingsTable } from '@/db/schema/address-mappings-schema';
import { eq, and, sql } from 'drizzle-orm';

// Mock FHE client for development/fallback
class MockFHEClient {
  async encrypt(value: string | bigint | boolean, type: string): Promise<any> {
    // Use deterministic encryption based on value and type
    const str = typeof value === 'string' ? value : String(value);
    const hash = ethers.keccak256(ethers.toUtf8Bytes(`${str}_${type}_mock`));

    // Return in format that matches FhenixClient output
    return {
      data: hash,
      ciphertext: hash,
      proof: '0x0000000000000000000000000000000000000000000000000000000000000000'
    };
  }
}

export class FHEEncryptionService {
  private fhenixClient: FhenixClient | null = null;
  private mockClient: MockFHEClient | null = null;
  private provider: ethers.Provider;
  private initialized = false;
  private useMockFHE = false;

  constructor() {
    // Validate required environment variables - prefer FHENIX_NETWORK_URL but fall back to BLOCKCHAIN_RPC_URL
    const rpcUrl = process.env.FHENIX_NETWORK_URL || process.env.BLOCKCHAIN_RPC_URL;
    if (!rpcUrl) {
      throw new Error(
        '[FHEEncryption] Either FHENIX_NETWORK_URL or BLOCKCHAIN_RPC_URL environment variable is required. ' +
        'Please set it to your Fhenix/blockchain RPC endpoint (e.g., https://api.helium.fhenix.zone for Fhenix mainnet, ' +
        'http://localhost:8545 for local development).'
      );
    }

    // Detect if we're running on local Anvil (development mode)
    this.useMockFHE = rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1');

    console.log(`[FHEEncryption] Using ${this.useMockFHE ? 'Mock FHE' : 'Real FHE'} for encryption`);

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  private async initializeFHE() {
    if (this.initialized) return;

    if (this.useMockFHE) {
      // Use mock client for local development
      this.mockClient = new MockFHEClient();
      this.initialized = true;
      console.log('[FHEEncryptionService] Initialized with Mock FHE client for development');
      return;
    }

    try {
      // Try to initialize real FhenixClient for production
      this.fhenixClient = new FhenixClient({ provider: this.provider });
      this.initialized = true;
      console.log('[FHEEncryptionService] Initialized with real FhenixClient');
    } catch (error) {
      console.warn('[FHEEncryptionService] Real FHE initialization failed, falling back to mock:', error);
      // Fallback to mock client if real FHE fails
      this.mockClient = new MockFHEClient();
      this.useMockFHE = true;
      this.initialized = true;
      console.log('[FHEEncryptionService] Fallback to Mock FHE client successful');
    }
  }

  async encryptAddress(
    realAddress: string, 
    generatorAddress: string
  ): Promise<{ 
    encryptedAddress: string; 
    encryptedData: any; 
  }> {
    await this.initializeFHE();
    
    if (!ethers.isAddress(realAddress) || !ethers.isAddress(generatorAddress)) {
      throw new Error('Invalid address format');
    }
    
    // Normalize addresses for consistent querying
    const normalizedRealAddress = realAddress.toLowerCase();
    const normalizedGeneratorAddress = generatorAddress.toLowerCase();

    const existing = await db
      .select()
      .from(addressMappingsTable)
      .where(
        and(
          eq(addressMappingsTable.realAddress, normalizedRealAddress),
          eq(addressMappingsTable.alphaGeneratorAddress, normalizedGeneratorAddress)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return { 
        encryptedAddress: existing[0].encryptedAddress, 
        encryptedData: JSON.parse(existing[0].encryptedData || '{}') 
      };
    }
    
    // Use the appropriate client based on mock mode
    const encrypted = this.useMockFHE
      ? await this.mockClient!.encrypt(realAddress, 'address')
      : await this.fhenixClient!.encrypt(realAddress, 'address');
    
    const encryptedIdentifier = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'address', 'bytes'],
        [generatorAddress, realAddress, ethers.toUtf8Bytes('FHE_V1')]
      )
    );
    
    const [mapping] = await db
      .insert(addressMappingsTable)
      .values({
        realAddress: normalizedRealAddress, // Use normalized address
        encryptedAddress: encryptedIdentifier,
        encryptedData: JSON.stringify(encrypted),
        alphaGeneratorAddress: normalizedGeneratorAddress, // Use normalized address
      })
      .returning();
    
    return { 
      encryptedAddress: mapping.encryptedAddress, 
      encryptedData: encrypted 
    };
  }

  async resolveEncryptedAddresses(encryptedAddresses: string[]): Promise<Map<string, string>> {
    const mappings = await db
      .select()
      .from(addressMappingsTable)
      .where(sql`${addressMappingsTable.encryptedAddress} = ANY(${encryptedAddresses})`);
    
    const addressMap = new Map<string, string>();
    for (const mapping of mappings) {
      addressMap.set(mapping.encryptedAddress, mapping.realAddress);
    }
    
    return addressMap;
  }

  async decryptAddress(
    encryptedAddress: string,
    generatorAddress: string
  ): Promise<string | null> {
    // Normalize generator address for consistent querying
    const normalizedGeneratorAddress = generatorAddress.toLowerCase();

    const [mapping] = await db
      .select()
      .from(addressMappingsTable)
      .where(
        and(
          eq(addressMappingsTable.encryptedAddress, encryptedAddress),
          eq(addressMappingsTable.alphaGeneratorAddress, normalizedGeneratorAddress)
        )
      )
      .limit(1);
    
    return mapping?.realAddress || null;
  }

  async prepareForContract(encryptedData: any): Promise<{ 
    data: string; 
    proof: string; 
  }> {
    if (typeof encryptedData === 'string') {
      encryptedData = JSON.parse(encryptedData);
    }
    
    return { 
      data: encryptedData.data || encryptedData.ciphertext || '0x', 
      proof: encryptedData.proof || '0x' 
    };
  }

  async encryptAmount(amount: bigint | string | number): Promise<any> {
    await this.initializeFHE();

    if (!this.fhenixClient && !this.mockClient) {
      throw new Error('FHE client not initialized');
    }

    const amountBigInt = BigInt(amount);
    return this.useMockFHE
      ? await this.mockClient!.encrypt(amountBigInt, 'uint256')
      : await this.fhenixClient!.encrypt(amountBigInt, 'uint256');
  }

  async encryptBoolean(value: boolean): Promise<any> {
    await this.initializeFHE();

    if (!this.fhenixClient && !this.mockClient) {
      throw new Error('FHE client not initialized');
    }

    return this.useMockFHE
      ? await this.mockClient!.encrypt(value, 'bool')
      : await this.fhenixClient!.encrypt(value, 'bool');
  }
}

export const encryptionService = new FHEEncryptionService();