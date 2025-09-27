#!/bin/bash
# Protocol Strategy Integration - Setup Verification Script
# Run this to verify everything is properly configured

echo "🔍 Protocol Strategy Integration - Setup Verification"
echo "====================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contract address we expect
EXPECTED_CONTRACT="0x5fbdb2315678afecb367f032d93f642f64180aa3"

# Check PostgreSQL
echo "1. Checking PostgreSQL..."
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
    echo "  Start with: brew services start postgresql@16"
fi

# Check Anvil
echo ""
echo "2. Checking Anvil..."
if nc -z localhost 8545 2>/dev/null; then
    echo -e "${GREEN}✓ Anvil is running on port 8545${NC}"
else
    echo -e "${RED}✗ Anvil is not running${NC}"
    echo "  Start with: anvil"
fi

# Check contract deployment
echo ""
echo "3. Checking Smart Contract..."
if [ -f "../contracts/broadcast/Deploy.s.sol/31337/run-latest.json" ]; then
    DEPLOYED_CONTRACT=$(cat ../contracts/broadcast/Deploy.s.sol/31337/run-latest.json | jq -r '.transactions[] | select(.contractName == "AlphaEngineSubscription") | .contractAddress')
    if [ "$DEPLOYED_CONTRACT" = "$EXPECTED_CONTRACT" ]; then
        echo -e "${GREEN}✓ Contract deployed at: $DEPLOYED_CONTRACT${NC}"
    else
        echo -e "${YELLOW}⚠ Contract at different address: $DEPLOYED_CONTRACT${NC}"
        echo "  Expected: $EXPECTED_CONTRACT"
    fi
else
    echo -e "${RED}✗ No contract deployment found${NC}"
fi

# Check backend .env.local
echo ""
echo "4. Checking Backend Configuration..."
if [ -f ".env.local" ]; then
    BACKEND_CONTRACT=$(grep "ALPHA_ENGINE_CONTRACT_ADDRESS" .env.local | cut -d'=' -f2)
    if [ "$BACKEND_CONTRACT" = "$EXPECTED_CONTRACT" ]; then
        echo -e "${GREEN}✓ Backend contract address correct${NC}"
    else
        echo -e "${RED}✗ Backend has wrong contract: $BACKEND_CONTRACT${NC}"
        echo "  Should be: $EXPECTED_CONTRACT"
    fi
else
    echo -e "${RED}✗ Backend .env.local not found${NC}"
fi

# Check frontend .env.local
echo ""
echo "5. Checking Frontend Configuration..."
if [ -f "../frontend/.env.local" ]; then
    FRONTEND_CONTRACT=$(grep "NEXT_PUBLIC_CONTRACT_ADDRESS" ../frontend/.env.local | head -1 | cut -d'=' -f2)
    if [ "$FRONTEND_CONTRACT" = "0x5FbDB2315678afecb367f032d93F642f64180aa3" ]; then
        echo -e "${GREEN}✓ Frontend contract address correct${NC}"
    else
        echo -e "${RED}✗ Frontend has wrong contract: $FRONTEND_CONTRACT${NC}"
    fi
else
    echo -e "${RED}✗ Frontend .env.local not found${NC}"
fi

# Check database tables
echo ""
echo "6. Checking Database Tables..."
TABLES=$(psql -U postgres -d alphaengine -t -c "SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'protocol_%';" 2>/dev/null | tr -d ' ')
if [ "$TABLES" -ge "3" ]; then
    echo -e "${GREEN}✓ Protocol tables exist ($TABLES found)${NC}"

    # Check for compatibility views
    VIEWS=$(psql -U postgres -d alphaengine -t -c "SELECT COUNT(*) FROM pg_views WHERE viewname IN ('strategies', 'trade_confirmations', 'protocols');" 2>/dev/null | tr -d ' ')
    if [ "$VIEWS" = "3" ]; then
        echo -e "${GREEN}✓ Compatibility views exist${NC}"
    else
        echo -e "${YELLOW}⚠ Compatibility views missing ($VIEWS/3)${NC}"
        echo "  Run: psql -U postgres -d alphaengine < drizzle/0005_protocol_strategies_compatibility.sql"
    fi
else
    echo -e "${RED}✗ Protocol tables missing${NC}"
    echo "  Run: bun run db:push"
fi

# Check CLI commands in package.json
echo ""
echo "7. Checking CLI Commands..."
if grep -q "strategies:cli" package.json && grep -q "executor:cli" package.json && grep -q "broadcast:cli" package.json; then
    echo -e "${GREEN}✓ All CLI commands configured${NC}"
else
    echo -e "${RED}✗ Some CLI commands missing in package.json${NC}"
fi

# Check ports
echo ""
echo "8. Checking Port Availability..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 3000 is in use (frontend)${NC}"
else
    echo -e "${GREEN}✓ Port 3000 is available${NC}"
fi

if lsof -i :3001 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 3001 is in use (backend)${NC}"
else
    echo -e "${GREEN}✓ Port 3001 is available${NC}"
fi

# Summary
echo ""
echo "====================================================="
echo "📊 Summary:"
echo ""

# Count issues
ISSUES=0
[ "$DEPLOYED_CONTRACT" != "$EXPECTED_CONTRACT" ] && ((ISSUES++))
[ "$BACKEND_CONTRACT" != "$EXPECTED_CONTRACT" ] && ((ISSUES++))
[ "$VIEWS" != "3" ] && ((ISSUES++))

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All systems ready for testing!${NC}"
    echo ""
    echo "Start backend with: PORT=3001 bun run dev"
    echo "Start frontend with: PORT=3000 bun run dev"
else
    echo -e "${YELLOW}⚠ $ISSUES issues need attention${NC}"
    echo "Fix the issues above before testing"
fi

echo ""
echo "For detailed testing instructions, see:"
echo "  - END_TO_END_TEST_CHECKLIST.md"
echo "  - BRANCH_SYNCHRONIZATION.md"