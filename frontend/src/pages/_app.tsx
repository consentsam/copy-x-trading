import '../styles/globals.css';
import '../utils/console-filter'; // Filter browser extension errors
import type { AppProps } from 'next/app';
import React, { useEffect, useMemo } from 'react';
import { ThemeProvider as NextThemeProvider, useTheme } from 'next-themes';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from '../Components/Layout';
import { WagmiProvider } from 'wagmi';
import { config } from '../libs/wagmi-config';
import { AppTheme, darkTheme, lightTheme } from '../styles/theme';
import { useActivityLogger } from '../hooks/useActivityLogger';
import { useAccount } from 'wagmi';
import { apiClient } from '../utils/api-client';
import { getContractErrorMessage } from '../utils/contract-error-handler';

const queryClient = new QueryClient();

const CSS_VARIABLE_PREFIX = '--color-';

const ThemeBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();

  const theme = useMemo<AppTheme>(() => {
    return resolvedTheme === 'dark' ? darkTheme : lightTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = document.documentElement;
    root.style.colorScheme = theme.mode;

    Object.entries(theme.colors).forEach(([key, value]) => {
      const property = `${CSS_VARIABLE_PREFIX}${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(property, value);
    });
  }, [theme]);

  return <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>;
};

const ThemedToastContainer: React.FC = () => {
  const { resolvedTheme } = useTheme();

  return (
    <ToastContainer
      position='top-right'
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      style={{ zIndex: 9999 }}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    />
  );
};

function ApiClientSyncer({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();

  useEffect(() => {
    // Sync wallet address with API client
    if (isConnected && address) {
      apiClient.setWalletAddress(address);
      console.log('[ApiClient] Wallet address set:', address);
    } else {
      apiClient.clearWalletAddress();
      console.log('[ApiClient] Wallet address cleared');
    }
  }, [address, isConnected]);

  return <>{children}</>;
}

function ActivityLoggerWrapper({ children }: { children: React.ReactNode }) {
  const { stats, forceFlush, isLogging } = useActivityLogger({
    flushInterval: 3000,
    batchSize: 25,
    debug: process.env.NODE_ENV === 'development'
  });

  // Flush logs on page unload
  useEffect(() => {
    const handleUnload = () => forceFlush();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [forceFlush]);

  // Log stats in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ActivityLogger Stats]', {
        isLogging,
        ...stats
      });
    }
  }, [stats, isLogging]);

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[Global Error Handler] Unhandled promise rejection:', event.reason);

      // Check if it's a contract/blockchain error
      const errorMessage = event.reason?.message || '';
      if (errorMessage.includes('contract') ||
          errorMessage.includes('insufficient funds') ||
          errorMessage.includes('reverted') ||
          errorMessage.includes('transaction') ||
          errorMessage.includes('registerGenerator') ||
          errorMessage.includes('subscribe')) {
        // Show user-friendly error message
        const friendlyMessage = getContractErrorMessage(event.reason);
        toast.error(friendlyMessage);
        // Prevent the default error handling
        event.preventDefault();
      }
    };

    // Add global error handler
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <NextThemeProvider
      attribute='class'
      defaultTheme='system'
      enableSystem
      themes={['light', 'dark']}
      value={{ light: 'light', dark: 'dark' }}>
      <ThemeBridge>
        <Web3Wrapper>
          <ActivityLoggerWrapper>
            <Layout>
              <Component {...pageProps} />
            </Layout>
            <ThemedToastContainer />
          </ActivityLoggerWrapper>
      </Web3Wrapper>
      </ThemeBridge>
    </NextThemeProvider>
  );
}

export function Web3Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ApiClientSyncer>
          {children}
        </ApiClientSyncer>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
