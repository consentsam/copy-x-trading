import styled from "styled-components";
import { useRouter, NextRouter } from "next/router";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { NetworkSwitcher } from "../NetworkSwitcher";

const NavbarContainer = styled.div`
  height: 64px;
  width: 100%;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
  background-color: ${({ theme }) => theme.colors.navBackground};
  color: ${({ theme }) => theme.colors.navText};
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  border-bottom: 1px solid ${({ theme }) => theme.colors.subtleBorder};
`;

const Logo = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.navText};
  cursor: pointer;
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const UserAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  background-color: ${({ theme }) => theme.colors.primaryMuted};
  color: ${({ theme }) => theme.colors.navText};
  border: 1px solid ${({ theme }) => theme.colors.subtleBorder};
`;

const RegisterButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const RegisterButton = styled.button<{ variant?: 'generator' | 'consumer' }>`
  background-color: ${({ theme, variant }) =>
    variant === 'generator' ? theme.colors.primary :
    variant === 'consumer' ? theme.colors.primary :
    theme.colors.navText};
  color: ${({ theme }) => theme.colors.navText || '#fff'};
  border: 1px solid ${({ theme, variant }) =>
    variant === 'generator' ? theme.colors.primary :
    variant === 'consumer' ? theme.colors.primary :
    theme.colors.navText};
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows?.focus};
  }
`;

const ThemeToggle = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.subtleBorder};
  background: transparent;
  color: ${({ theme }) => theme.colors.navText};
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryMuted};
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

function handleLogoClick(router: NextRouter) {
  router.push("/");
}

const Navbar = () => {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isLoggedIn = true; // You can replace this with actual auth state

  useEffect(() => setMounted(true), []);

  const handleCreateStrategy = () => {
    console.log("[Navbar] Navigating to Create Strategy");
    router.push("/alpha-generator/strategies/create");
  };

  const handleCopyStrategy = () => {
    console.log("[Navbar] Navigating to Copy Strategy");
    router.push("/alpha-consumer/strategies");
  };

  const handleToggleTheme = () => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  // Prevent hydration mismatch by not rendering theme-dependent content on server
  if (!mounted) {
    return (
      <NavbarContainer>
        <Logo onClick={() => handleLogoClick(router)}>CopyX</Logo>
        <UserSection>
          <NetworkSwitcher />
          {/* Placeholder for theme toggle during SSR */}
          <ThemeToggle as="div" style={{ visibility: 'hidden' }}>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'>
              <circle cx='12' cy='12' r='4' />
            </svg>
          </ThemeToggle>
          {isLoggedIn ? (
            <UserAvatar>
              {router.pathname.startsWith("/alpha-generator") ? "AG" : "AC"}
            </UserAvatar>
          ) : (
            <RegisterButtonGroup>
              <RegisterButton variant="generator" onClick={handleCreateStrategy}>
                <svg
                  width='16'
                  height='16'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'>
                  <path d='M12 2v20M2 12h20' />
                </svg>
                Create Strategy
              </RegisterButton>
              <RegisterButton variant="consumer" onClick={handleCopyStrategy}>
                <svg
                  width='16'
                  height='16'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'>
                  <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
                  <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
                </svg>
                Copy Strategy
              </RegisterButton>
            </RegisterButtonGroup>
          )}
        </UserSection>
      </NavbarContainer>
    );
  }

  return (
    <NavbarContainer>
      <Logo onClick={() => handleLogoClick(router)}>Alpha Engine</Logo>
      <UserSection>
        <NetworkSwitcher />
        <ThemeToggle
          onClick={handleToggleTheme}
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}>
          {resolvedTheme === 'dark' ? (
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'>
              <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z' />
            </svg>
          ) : (
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'>
              <circle cx='12' cy='12' r='4' />
              <path d='M12 4V2' />
              <path d='M12 22v-2' />
              <path d='m17 7 1.5-1.5' />
              <path d='m5.5 18.5 1.5-1.5' />
              <path d='M4 12H2' />
              <path d='M22 12h-2' />
              <path d='m7 7-1.5-1.5' />
              <path d='m18.5 18.5-1.5-1.5' />
            </svg>
          )}
        </ThemeToggle>
        {isLoggedIn ? (
          <UserAvatar>
            {router.pathname.startsWith("/alpha-generator") ? "AG" : "AC"}
          </UserAvatar>
        ) : (
          <RegisterButtonGroup>
            <RegisterButton variant="generator" onClick={handleCreateStrategy}>
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'>
                <path d='M12 2v20M2 12h20' />
              </svg>
              Create Strategy
            </RegisterButton>
            <RegisterButton variant="consumer" onClick={handleCopyStrategy}>
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'>
                <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
                <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
              </svg>
              Copy Strategy
            </RegisterButton>
          </RegisterButtonGroup>
        )}
      </UserSection>
    </NavbarContainer>
  );
};

export default Navbar;
