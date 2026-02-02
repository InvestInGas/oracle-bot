/**
 * Configuration for the Gas Oracle Bot
 */

export interface ChainConfig {
    name: string;
    rpcUrl: string;
    enabled: boolean;
}

export interface Config {
    // Sui configuration
    sui: {
        network: 'testnet' | 'mainnet' | 'devnet';
        privateKey: string;
        packageId: string;
        oracleObjectId: string;
        adminCapId: string;
    };

    // Chain configurations
    chains: ChainConfig[];

    // Update settings
    updateIntervalMs: number;
    batchSize: number;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
    return {
        sui: {
            network: (process.env.SUI_NETWORK as 'testnet' | 'mainnet' | 'devnet') || 'testnet',
            privateKey: process.env.SUI_PRIVATE_KEY || '',
            packageId: process.env.ORACLE_PACKAGE_ID || '0x0',
            oracleObjectId: process.env.ORACLE_OBJECT_ID || '0x0',
            adminCapId: process.env.ADMIN_CAP_ID || '0x0',
        },
        chains: [
            {
                name: 'ethereum',
                rpcUrl: process.env.ETHEREUM_RPC || 'https://eth.llamarpc.com',
                enabled: true,
            },
            {
                name: 'base',
                rpcUrl: process.env.BASE_RPC || 'https://mainnet.base.org',
                enabled: true,
            },
            {
                name: 'arbitrum',
                rpcUrl: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
                enabled: true,
            },
            {
                name: 'polygon',
                rpcUrl: process.env.POLYGON_RPC || 'https://polygon-rpc.com',
                enabled: true,
            },
            {
                name: 'optimism',
                rpcUrl: process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io',
                enabled: true,
            },
            {
                name: 'arc',
                rpcUrl: process.env.ARC_RPC || 'https://rpc.arc.io',
                enabled: true,
            },
        ],
        updateIntervalMs: parseInt(process.env.UPDATE_INTERVAL_MS || '500'),
        batchSize: parseInt(process.env.BATCH_SIZE || '5'),
    };
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.sui.privateKey) {
        errors.push('SUI_PRIVATE_KEY is required');
    }

    if (config.sui.packageId === '0x0') {
        errors.push('ORACLE_PACKAGE_ID not set (will run in demo mode)');
    }

    if (config.sui.oracleObjectId === '0x0') {
        errors.push('ORACLE_OBJECT_ID not set');
    }

    if (config.sui.adminCapId === '0x0') {
        errors.push('ADMIN_CAP_ID not set');
    }

    return {
        valid: errors.filter(e => !e.includes('demo mode')).length === 0,
        errors,
    };
}
