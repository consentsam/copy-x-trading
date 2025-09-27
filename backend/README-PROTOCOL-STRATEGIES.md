# Protocol Strategy Integration

## Overview

The Protocol Strategy Integration feature enables AlphaGenerators to create and execute reusable DeFi protocol strategies consisting of 2-3 functions. These strategies can be executed with specific parameters and broadcast to active subscribers (AlphaConsumers) who can modify value/amount parameters before accepting trades.

## Features

- **Protocol Support**: AAVE (lending/borrowing) and Uniswap (swapping)
- **Strategy Management**: Create, update, and manage reusable strategies
- **Trade Broadcasting**: Real-time SSE-based trade propagation to subscribers
- **Parameter Modification**: AlphaConsumers can modify value/amount parameters
- **Gas Estimation**: On-demand gas estimation with 30-second caching
- **Correlation Tracking**: End-to-end trade tracking with correlation IDs

## Architecture

### Core Libraries

1. **protocol-strategies** (`src/lib/protocol-strategies/`)
   - Strategy CRUD operations
   - Global name uniqueness enforcement
   - CLI interface for testing

2. **protocol-executor** (`src/lib/protocol-executor/`)
   - AAVE and Uniswap protocol execution
   - Gas estimation with caching
   - Transaction validation and execution

3. **trade-broadcast** (`src/lib/trade-broadcast/`)
   - Trade broadcasting to subscribers
   - Correlation ID generation
   - Trade confirmation management

### API Endpoints

#### Protocol Strategies

- `GET /api/v1/protocol-strategies` - List strategies
- `POST /api/v1/protocol-strategies` - Create strategy
- `GET /api/v1/protocol-strategies/:id` - Get strategy
- `PUT /api/v1/protocol-strategies/:id` - Update strategy
- `DELETE /api/v1/protocol-strategies/:id` - Delete strategy
- `POST /api/v1/protocol-strategies/:id/execute` - Execute and broadcast

#### Trade Confirmations

- `GET /api/v1/trade-confirmations` - List pending trades
- `GET /api/v1/trade-confirmations/:id` - Get confirmation
- `PATCH /api/v1/trade-confirmations/:id` - Accept/reject trade
- `POST /api/v1/trade-confirmations/:id/execute` - Execute on-chain

#### SSE Streaming

- `GET /api/v1/sse/trades` - Real-time trade stream

## CLI Commands

### Strategy Management

```bash
# List strategies
bun run strategies:cli list --generator <id>

# Create strategy
bun run strategies:cli create --generator <id> --name "My Strategy" --protocol AAVE

# Update strategy
bun run strategies:cli update --id <strategy-id> --name "Updated Name"

# Delete strategy
bun run strategies:cli delete --id <strategy-id>
```

### Protocol Execution

```bash
# Execute function (dry run)
bun run executor:cli execute --protocol AAVE --function supply --address <user> --dry-run --params '{"asset":"0x...", "amount":"1000000000000000000"}'

# Estimate gas
bun run executor:cli estimate --protocol UNISWAP --function exactInputSingle --address <user> --params '{...}'

# List supported functions
bun run executor:cli list-functions --protocol AAVE
```

### Trade Broadcasting

```bash
# Send broadcast
bun run broadcast:cli send --strategy <id> --generator <id> --function supply --protocol AAVE --params '{...}'

# View pending trades
bun run broadcast:cli pending --consumer <id>

# Accept trade
bun run broadcast:cli accept --id <confirmation-id> --params '{"amount":"2000000000000000000"}'

# View statistics
bun run broadcast:cli stats --generator <id>

# Cleanup expired
bun run broadcast:cli cleanup
```

## Testing

### Run Tests

```bash
# Unit tests
bun test strategies.test.ts
bun test executor.test.ts
bun test broadcast.test.ts

# Contract tests
bun test contracts/

# Integration tests
bun test integration/strategy-flow.test.ts
```

### End-to-End Flow Test

```bash
# 1. Create strategy
curl -X POST http://localhost:3001/api/v1/protocol-strategies \
  -H "Content-Type: application/json" \
  -H "X-Alpha-Generator-Id: generator-123" \
  -d '{
    "name": "AAVE Supply Strategy",
    "protocol": "AAVE",
    "functions": [{
      "functionName": "supply",
      "displayName": "Supply Asset",
      "requiredParams": ["asset", "amount", "onBehalfOf", "referralCode"],
      "modifiableParams": ["amount"]
    }]
  }'

# 2. Execute and broadcast
curl -X POST http://localhost:3001/api/v1/protocol-strategies/{id}/execute \
  -H "Content-Type: application/json" \
  -H "X-Alpha-Generator-Id: generator-123" \
  -d '{
    "functions": [{
      "functionName": "supply",
      "parameters": {
        "asset": "0x...",
        "amount": "1000000000000000000",
        "onBehalfOf": "0x...",
        "referralCode": 0
      }
    }]
  }'

# 3. Connect to SSE stream (consumer)
curl -N http://localhost:3001/api/v1/sse/trades?consumerId=consumer-456

# 4. Accept trade with modifications
curl -X PATCH http://localhost:3001/api/v1/trade-confirmations/{id} \
  -H "Content-Type: application/json" \
  -H "X-Alpha-Consumer-Id: consumer-456" \
  -d '{
    "action": "accept",
    "modifiedParameters": {
      "amount": "2000000000000000000"
    }
  }'
```

## Database Schema

### New Tables

- `strategies` - Protocol strategy definitions
- `trade_broadcasts` - Broadcast trade records
- `trade_confirmations` - Consumer trade confirmations
- `protocol_contracts` - Protocol contract ABIs and addresses

### Migrations

```bash
# Apply migrations
bun run db:push

# Seed protocol contracts
bun run backend/scripts/seed-protocol-contracts.ts
```

## Performance Targets

- Strategy management: < 1 second response
- Trade broadcast: < 500ms to all subscribers
- Gas estimation: 30-second cache TTL
- SSE heartbeat: Every 30 seconds

## Security Considerations

- **Parameter Validation**: Only modifiable parameters can be changed
- **Authorization**: Strategies can only be modified by their creators
- **Gas Estimation**: 20% buffer applied to estimates
- **Trade Expiry**: 5-minute default expiry for broadcasts

## Common Issues

### Issue: Strategy name already exists
**Solution**: Strategy names must be globally unique. Choose a different name.

### Issue: Trade broadcast expired
**Solution**: Trades expire after 5 minutes by default. Accept/reject before expiry.

### Issue: Cannot modify parameter
**Solution**: Only parameters in `modifiableParams` can be changed by consumers.

### Issue: SSE connection drops
**Solution**: Heartbeat mechanism automatically detects and cleans up dead connections.

## Future Enhancements

- Additional protocol support (Compound, MakerDAO)
- Batch execution optimization
- Redis caching for hot strategies
- WebSocket fallback for SSE
- Cross-chain execution

## Support

For issues or questions, please refer to:
- Main documentation: `/CLAUDE.md`
- Backend challenges: `/backend/CHALLENGES.md`
- Feature specification: `/specs/003-protocol-strategy-integration/spec.md`