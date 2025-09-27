/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Define FHE client interface
export interface FHEClient {
  encrypt(value: any, publicKey?: any): Promise<any>;
  decrypt(encryptedValue: any): Promise<any>;
}

async function hashToBytes32Hex(value: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const data = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const state = new Uint8Array(32);

  for (let i = 0; i < bytes.length; i++) {
    state[i % 32] = (state[i % 32] + bytes[i] + i) & 0xff;
  }

  return Array.from(state)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Mock FHE client for development
// Will be replaced with actual FHE implementation later
class MockFHEClient implements FHEClient {
  async encrypt(value: any): Promise<any> {
    console.log('[MockFHE] Encrypting value:', value);
    // For addresses, return a proper bytes32 format
    // In production, this would be actual FHE encryption
    if (typeof value === 'string' && value.startsWith('0x')) {
      // Convert address to bytes32 by padding with zeros
      const cleanAddress = value.toLowerCase().replace('0x', '');
      // Pad to 32 bytes (64 hex chars) - addresses are 20 bytes, so pad with 12 zero bytes (24 hex chars)
      const paddedHex = cleanAddress.padEnd(64, '0');
      return `0x${paddedHex}`;
    }
    // For other values, return a simple hash-like bytes32
    const hashHex = await hashToBytes32Hex(String(value));
    return `0x${hashHex}`;
  }

  async decrypt(encryptedValue: any): Promise<any> {
    console.log('[MockFHE] Decrypting value:', encryptedValue);
    try {
      if (typeof encryptedValue === 'string' && encryptedValue.startsWith('0x')) {
        const buffer = Buffer.from(encryptedValue.slice(2), 'hex');
        const decoded = JSON.parse(buffer.toString());
        return decoded.value;
      }
    } catch (e) {
      console.warn('[MockFHE] Failed to decrypt, returning raw value');
    }
    return encryptedValue;
  }
}

// Create FHE client - always returns mock for now until FHE implementation is ready
export async function createFHEClient(provider?: any, signer?: any, environment: string = 'MOCK'): Promise<FHEClient> {
  console.log('[FHE] Creating mock FHE client (FhenixJS removed, awaiting new implementation)');
  return new MockFHEClient();
}

// Export specific mock encryption functions for compatibility
export async function encryptAddress(address: string): Promise<string> {
  const client = new MockFHEClient();
  return client.encrypt(address);
}

export async function encryptAmount(amount: bigint): Promise<string> {
  const client = new MockFHEClient();
  return client.encrypt(amount.toString());
}

export async function decryptData(encryptedData: any): Promise<any> {
  const client = new MockFHEClient();
  return client.decrypt(encryptedData);
}
