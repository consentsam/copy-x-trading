import styled from "styled-components";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useConnect, useAccount, useDisconnect, useChainId } from "wagmi";
import { NetworkSwitcher } from "../../Components/NetworkSwitcher";

const Container = styled.div`
  display: flex;
  min-height: 100vh;
  width: 100%;
`;

const LeftSection = styled.div`
  flex: 1;
  background: linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 65%, transparent) 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  position: relative;
`;

const LogoPattern = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-repeat: repeat;
  opacity: 0.1;
`;

const Logo = styled.div`
  position: relative;
  z-index: 1;
  text-align: center;
  color: var(--color-nav-text);
  display: flex;
  flex-direction: column;
  align-items: center;

  h1 {
    font-size: 2.5rem;
    font-weight: bold;
    margin-top: 1rem;
  }
`;

const RightSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem;
`;

const Title = styled.h2`
  font-size: 2rem;
  color: var(--color-text);
  margin-bottom: 2rem;
  transition: color 0.2s ease;
`;

const ConnectButton = styled.button`
  background-color: var(--color-primary);
  color: var(--color-nav-text);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  min-width: 200px;
  justify-content: center;

  &:hover {
    background-color: var(--color-primary-hover);
  }

  &:disabled {
    background-color: var(--color-neutral-surface);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-muted);
  }
`;

const StatusMessage = styled.p`
  margin-top: 1rem;
  color: ${(props) => props.color || 'var(--color-text)'};
  font-size: 0.9rem;
`;

const ErrorMessage = styled.div`
  color: var(--color-danger);
  margin-top: 1rem;
  font-size: 0.9rem;
  max-width: 320px;
  text-align: center;
`;

function Login() {
  const router = useRouter();
  const chainId = useChainId();
  const [connectStatus, setConnectStatus] = useState("");
  const [statusColor, setStatusColor] = useState('var(--color-text)');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Wagmi hooks
  const { connect, connectors, error, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();

  // Ensure component is mounted before showing wallet state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Watch for wallet connection
  useEffect(() => {
    if (isConnected && address) {
      setConnectStatus(
        `Connected: ${address.substring(0, 6)}...${address.substring(
          address.length - 4
        )}`
      );
      setStatusColor('var(--color-success)');
    }
  }, [isConnected, address]);

  const handleConnect = async () => {
    try {
      // Check if on correct network
      if (chainId !== 31337) {
        setConnectStatus("Please switch to Anvil Local network (Chain ID: 31337) first");
        setStatusColor('var(--color-danger)');
        return;
      }

      // Find MetaMask connector
      const metamaskConnector = connectors.find(
        (connector) => connector.id === 'injected' || connector.name === 'MetaMask'
      );

      if (metamaskConnector) {
        await connect({ connector: metamaskConnector });
      } else {
        setConnectStatus("MetaMask not found. Please install MetaMask extension.");
        setStatusColor('var(--color-danger)');
      }
    } catch (error) {
      console.error("Connection error:", error);
      setConnectStatus("Failed to connect wallet");
      setStatusColor('var(--color-danger)');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setConnectStatus("");
    setIsRedirecting(false);
  };

  const handleContinue = () => {
    setIsRedirecting(true);
    router.push("/login/selectUserType");
  };

  const handleSwitchWallet = () => {
    // Disconnect current wallet to allow switching
    disconnect();
    setConnectStatus("");
    // Clear any existing status
    setTimeout(() => {
      // Trigger wallet selection again
      handleConnect();
    }, 500);
  };

  return (
    <Container>
      <LeftSection>
        <LogoPattern />
        <Logo>
          <div style={{
            width: '120px',
            height: '120px',
            backgroundColor: 'var(--color-primary)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            color: 'white',
            fontWeight: 'bold'
          }}>
            cX
          </div>
          <h1>CopyX</h1>
        </Logo>
      </LeftSection>

      <RightSection>
        <Title>Connect Your Wallet</Title>

        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
          <NetworkSwitcher />
        </div>

        {!isMounted ? (
          // Show default connect button during SSR and initial hydration
          <ConnectButton
            onClick={handleConnect}
            disabled={true}
          >
            Connect MetaMask
          </ConnectButton>
        ) : !isConnected ? (
          <ConnectButton
            onClick={handleConnect}
            disabled={isPending}
          >
            {isPending
              ? "Connecting..."
              : "Connect MetaMask"}
          </ConnectButton>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <ConnectButton onClick={handleContinue}>
              Continue →
            </ConnectButton>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <ConnectButton
                onClick={handleSwitchWallet}
                style={{ backgroundColor: 'var(--color-neutral-surface)', color: 'var(--color-text)', minWidth: '120px' }}
              >
                Switch Wallet
              </ConnectButton>
              <ConnectButton
                onClick={handleDisconnect}
                style={{ backgroundColor: 'var(--color-danger)', minWidth: '120px' }}
              >
                Disconnect
              </ConnectButton>
            </div>
          </div>
        )}
        
        {connectStatus && (
          <StatusMessage color={statusColor}>{connectStatus}</StatusMessage>
        )}

        {isRedirecting && (
          <StatusMessage color='var(--color-success)'>
            Redirecting...
          </StatusMessage>
        )}
        
        {error && (
          <ErrorMessage>Error: {error.message}</ErrorMessage>
        )}
      </RightSection>
    </Container>
  );
}

export default Login;
