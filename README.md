# Gas Oracle Bot

TypeScript bot that fetches gas prices from EVM chains and publishes to Sui.

## Structure
```
oracle-bot/
├── src/
│   ├── index.ts      # Main entry point & loop
│   ├── config.ts     # Configuration loader
│   ├── fetcher.ts    # EVM gas price fetcher
│   └── publisher.ts  # Sui transaction publisher
├── .env.example      # Environment template
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript config
```

## How It Works

1. **Fetch** - Queries gas prices from multiple EVM RPCs
2. **Process** - Calculates 24h high/low and buy signals
3. **Publish** - Pushes updates to Sui oracle contract every 30s

> **Note:** Prices are stored in **wei** (u128) for full precision. Each chain's native gas token is tracked separately.

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your values

# Run development
npm run dev

# Build & run production
npm run build
npm start
```

## Environment Variables

See `.env.example` for all required variables:
- `SUI_PRIVATE_KEY` - Bot wallet key
- `ORACLE_PACKAGE_ID` - Deployed Sui package
- `ORACLE_OBJECT_ID` - Oracle object ID
- `ADMIN_CAP_ID` - Admin capability ID
- `*_RPC` - EVM chain RPC endpoints

## Supported Chains

| Chain | Gas Token | Default RPC |
|-------|-----------|-------------|
| Ethereum | ETH | `https://eth.llamarpc.com` |
| Base | ETH | `https://mainnet.base.org` |
| Arbitrum | ETH | `https://arb1.arbitrum.io/rpc` |
| Polygon | MATIC | `https://polygon-rpc.com` |
| Optimism | ETH | `https://mainnet.optimism.io` |
| Arc | USDC | `https://rpc.arc.io` |

## RPC Providers

For better reliability, use:
- [Alchemy](https://alchemy.com)
- [Infura](https://infura.io)
- [QuickNode](https://quicknode.com)
