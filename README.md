# Gas Oracle Bot

The **Gas Oracle Bot** is a high-frequency TypeScript service that aggregates real-time gas prices from multiple EVM chains and publishes them to the Sui blockchain. It ensures that the InvestInGas protocol always has access to accurate and up-to-date market data.

## Operation Flow

1. **Fetch**: Queries `eth_gasPrice` from multiple EVM RPC endpoints simultaneously.
2. **Process**: Maintains a rolling window of recent prices to calculate 24-hour high/low values and identify "Buy Signals" (when gas is >10% cheaper than the average).
3. **Publish**: Batches updates and submits them to the Sui `GasOracle` module using the `OracleAdminCap` for authorization.

## Source Code (`src/`)

### `index.ts`
The main entry point and orchestration layer.
- **Update Loop**: Manages the recurring execution of fetch and publish cycles (default every 500ms).
- **Graceful Shutdown**: Handles OS signals (SIGINT, SIGTERM) to ensure clean exits.
- **Statistics Tracking**: Monitors uptime, successful updates, and error counts.

### `fetcher.ts`
The data acquisition engine.
- **EVM Integration**: Uses `ethers.js` to communicate with multiple EVM chains (Ethereum, Base, Arbitrum, etc.).
- **Precision Management**: Handles gas prices as `bigint` (wei) to avoid floating-point inaccuracies.
- **Buy Detection**: Implements the logic for detecting favorable gas market conditions.

### `publisher.ts`
The bridge to the Sui blockchain.
- **Transaction Building**: Constructs and signs Sui Move calls for `update_gas_price` and `batch_update_gas_prices`.
- **Keypair Management**: Securely handles Sui private keys from various formats (Hex, Base64).
- **Health Monitoring**: Periodically verifies that the Sui `GasOracle` object is responsive and correctly configured.

### `config.ts`
Centrally manages environment variables and chain settings.
- **Validation**: Ensures all required keys (`SUI_PRIVATE_KEY`, `ORACLE_PACKAGE_ID`, etc.) are present before starting.
- **Chain Definitions**: Configures RPC URLs and enabled status for all supported networks.

## Quick Start

```bash
# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env with your Sui private key and oracle IDs

# Run development mode (auto-reload)
npm run dev

# Build & run production
npm run build
npm start
```

## Environment Variables

See `.env.example` for all required variables:
- `SUI_PRIVATE_KEY`: Your bot's Sui wallet key.
- `ORACLE_PACKAGE_ID`: The ID of your deployed Sui Move package.
- `ORACLE_OBJECT_ID`: The ID of the shared `GasOracle` object on Sui.
- `ADMIN_CAP_ID`: The ID of your `OracleAdminCap` object.
- `*_RPC`: RPC endpoints for each EVM chain.

## Supported Chains

| Chain | Gas Token | Default RPC |
|-------|-----------|-------------|
| **Ethereum** | ETH | `https://eth.llamarpc.com` |
| **Base** | ETH | `https://mainnet.base.org` |
| **Arbitrum** | ETH | `https://arb1.arbitrum.io/rpc` |
| **Polygon** | MATIC | `https://polygon-rpc.com` |
| **Optimism** | ETH | `https://mainnet.optimism.io` |

## RPC Best Practices
For production deployments, it's recommended to use dedicated RPC providers to avoid rate limits and ensure maximum uptime:
- [Alchemy](https://alchemy.com)
- [Infura](https://infura.io)
- [QuickNode](https://quicknode.com)

