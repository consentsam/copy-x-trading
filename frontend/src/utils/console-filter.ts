/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Console Filter for Browser Extension Errors
 * Filters out noise from browser extensions like MetaMask
 */

if (typeof window !== 'undefined') {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;

  // Filter error messages
  console.error = (...args: any[]) => {
    const errorString = args.join(' ');

    // Skip SES/lockdown errors from browser extensions
    if (errorString.includes('lockdown-install.js') ||
        errorString.includes('SES') ||
        errorString.includes('moz-extension://') ||
        errorString.includes('chrome-extension://') ||
        errorString.includes('Removing unpermitted intrinsics') ||
        errorString.includes('Removing intrinsics')) {
      return;
    }

    // Skip React hydration errors that are non-critical
    if (errorString.includes('Text content does not match') ||
        errorString.includes('checkForUnmatchedText') ||
        errorString.includes('diffHydratedProperties') ||
        errorString.includes('hydrateInstance') ||
        errorString.includes('throwOnHydrationMismatch') ||
        errorString.includes('tryToClaimNextHydratableInstance') ||
        errorString.includes('updateHostComponent') ||
        errorString.includes('updateHostRoot') ||
        errorString.includes('performUnitOfWork') ||
        errorString.includes('workLoopSync') ||
        errorString.includes('renderRootSync') ||
        errorString.includes('performConcurrentWorkOnRoot') ||
        errorString.includes('recoverFromConcurrentError') ||
        (errorString.includes('react-dom') &&
         (errorString.includes('development.js') || errorString.includes('scheduler'))) ||
        errorString.includes('beginWork') ||
        errorString.includes('flushWork')) {
      return;
    }

    // Call original error function for legitimate errors
    originalError.apply(console, args);
  };

  // Filter warning messages
  console.warn = (...args: any[]) => {
    const warnString = args.join(' ');

    // Skip extension-related warnings
    if (warnString.includes('lockdown-install.js') ||
        warnString.includes('SES') ||
        warnString.includes('moz-extension://') ||
        warnString.includes('chrome-extension://')) {
      return;
    }

    // Call original warn function for legitimate warnings
    originalWarn.apply(console, args);
  };

  // Also suppress React error boundary errors in development
  if (process.env.NODE_ENV === 'development') {
    const originalConsoleError = window.console.error;
    window.console.error = (...args) => {
      const errorStr = args.join(' ');

      // Filter React development warnings
      if (errorStr.includes('Warning: React.jsx') ||
          errorStr.includes('Warning: ReactDOM') ||
          errorStr.includes('validateDOMNesting') ||
          errorStr.includes('Each child in a list should have a unique "key"') ||
          errorStr.includes('Hydration failed') ||
          errorStr.includes('There was an error while hydrating') ||
          errorStr.includes('The server could not finish this Suspense boundary')) {
        return;
      }

      originalConsoleError.apply(window.console, args);
    };

    // Suppress React hydration warnings globally
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && typeof event.reason === 'string') {
        if (event.reason.includes('Hydration') ||
            event.reason.includes('Text content does not match')) {
          event.preventDefault();
        }
      }
    });
  }

  console.log('[Console Filter] Browser extension and React hydration error filtering enabled');
}

export {};