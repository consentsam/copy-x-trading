/* eslint-disable @typescript-eslint/no-explicit-any */
import { useWalletClient } from 'wagmi';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { useMemo } from 'react';

function walletClientToSigner(walletClient: any): JsonRpcSigner | null {
  if (!walletClient) return null;
  const { chain, transport, account } = walletClient;
  if (!chain || !transport || !account) return null;

  const provider = new BrowserProvider(transport, chain.id);
  return new JsonRpcSigner(provider, account.address);
}

export function useEthersSigner() {
  const { data: walletClient } = useWalletClient();

  const signer = useMemo(() => {
    return walletClientToSigner(walletClient);
  }, [walletClient]);

  return signer;
}