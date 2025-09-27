import { toast } from 'react-toastify';

/**
 * Extracts a user-friendly error message from contract errors
 */
export function getContractErrorMessage(error: unknown): string {
  console.error('[Contract Error]', error);

  // Handle different error types
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    // Check for specific error patterns
    if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
      return 'Insufficient funds in your wallet. Please add ETH to complete this transaction.';
    }

    if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
      return 'Transaction was cancelled by user.';
    }

    if (errorMessage.includes('gas required exceeds')) {
      return 'Transaction requires more gas than the block limit. Try reducing the transaction size.';
    }

    if (errorMessage.includes('nonce too low')) {
      return 'Transaction nonce error. Please refresh and try again.';
    }

    if (errorMessage.includes('already registered')) {
      return 'This wallet address is already registered.';
    }

    if (errorMessage.includes('minimum subscription fee')) {
      return 'Subscription fee is below the minimum required amount.';
    }

    if (errorMessage.includes('maximum subscription fee')) {
      return 'Subscription fee exceeds the maximum allowed amount.';
    }

    if (errorMessage.includes('network') || errorMessage.includes('rpc')) {
      return 'Network connection error. Please check your connection and try again.';
    }

    if (errorMessage.includes('reverted')) {
      // Try to extract the revert reason if available
      const revertMatch = errorMessage.match(/reason:\s*"([^"]+)"/);
      if (revertMatch && revertMatch[1]) {
        return `Transaction failed: ${revertMatch[1]}`;
      }
      return 'Transaction was reverted by the smart contract. Please check your input and try again.';
    }

    // Check if there's a nested error object with more details
    const errorObj = error as any;
    if (errorObj.cause?.reason) {
      return `Transaction failed: ${errorObj.cause.reason}`;
    }

    if (errorObj.shortMessage) {
      return errorObj.shortMessage;
    }

    // Return the original error message if no specific pattern matches
    return error.message;
  }

  // Fallback for unknown error types
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Shows a toast error for contract failures
 */
export function showContractError(error: unknown): void {
  const message = getContractErrorMessage(error);
  toast.error(message, {
    position: 'top-center',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
}

/**
 * Shows a success toast for contract transactions
 */
export function showContractSuccess(message: string, txHash?: string): void {
  const content = txHash
    ? `${message}\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`
    : message;

  toast.success(content, {
    position: 'top-center',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
}

/**
 * Shows an info toast for pending transactions
 */
export function showContractPending(message: string = 'Transaction pending...'): void {
  toast.info(message, {
    position: 'top-center',
    autoClose: false,
    hideProgressBar: false,
    closeOnClick: false,
    pauseOnHover: true,
    draggable: false,
  });
}

/**
 * Dismisses all toasts (useful when transaction completes)
 */
export function dismissAllToasts(): void {
  toast.dismiss();
}