/**
 * Sui Oracle Publisher
 * Publishes gas price data to the Sui blockchain
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { Config } from './config';
import { GasPriceData } from './fetcher';

export class SuiPublisher {
    private client: SuiClient;
    private keypair: Ed25519Keypair;
    private config: Config;

    constructor(config: Config) {
        this.config = config;
        this.client = new SuiClient({ url: getFullnodeUrl(config.sui.network) });

        // Initialize keypair from private key
        this.keypair = this.initializeKeypair(config.sui.privateKey);
    }

    /**
     * Initialize keypair from various formats
     */
    private initializeKeypair(privateKey: string): Ed25519Keypair {
        if (!privateKey || privateKey === '') {
            // Generate a new keypair for testing
            const keypair = new Ed25519Keypair();
            console.log('No private key provided. Generated new keypair.');
            console.log('Address:', keypair.getPublicKey().toSuiAddress());
            return keypair;
        }

        try {
            // Try Base64 format first (from sui.keystore)
            if (!privateKey.startsWith('0x')) {
                const decoded = fromBase64(privateKey);
                // Sui keystore format: first byte is key scheme, rest is key
                const keyBytes = decoded.slice(1);
                return Ed25519Keypair.fromSecretKey(keyBytes);
            }

            // Try hex format
            const privateKeyBytes = Buffer.from(privateKey.replace('0x', ''), 'hex');
            return Ed25519Keypair.fromSecretKey(privateKeyBytes);
        } catch (error) {
            console.error('Failed to parse private key:', error);
            throw new Error('Invalid private key format. Use Base64 from sui.keystore or hex format.');
        }
    }

    /**
     * Get the bot's Sui address
     */
    getAddress(): string {
        return this.keypair.getPublicKey().toSuiAddress();
    }

    /**
     * Publish a single gas price update
     */
    async publishSingleUpdate(data: GasPriceData): Promise<string | null> {
        try {
            const tx = new Transaction();

            tx.moveCall({
                target: `${this.config.sui.packageId}::oracle::update_gas_price`,
                arguments: [
                    tx.object(this.config.sui.adminCapId),
                    tx.object(this.config.sui.oracleObjectId),
                    tx.object('0x6'), // Clock object
                    tx.pure.string(data.chain),
                    tx.pure.u64(data.priceGwei),
                    tx.pure.u64(data.volatility24h),
                    tx.pure.u64(data.high24h),
                    tx.pure.u64(data.low24h),
                ],
            });

            const result = await this.client.signAndExecuteTransaction({
                signer: this.keypair,
                transaction: tx,
            });

            console.log(`Published ${data.chain}: ${data.priceGwei} gwei (tx: ${result.digest})`);
            return result.digest;
        } catch (error) {
            console.error(`Error publishing ${data.chain}:`, error);
            return null;
        }
    }

    /**
     * Publish batch gas price updates
     */
    async publishBatchUpdate(dataArray: GasPriceData[]): Promise<string | null> {
        if (dataArray.length === 0) return null;

        try {
            const tx = new Transaction();

            const chains = dataArray.map(d => d.chain);
            const prices = dataArray.map(d => d.priceGwei);
            const volatilities = dataArray.map(d => d.volatility24h);

            tx.moveCall({
                target: `${this.config.sui.packageId}::oracle::batch_update_gas_prices`,
                arguments: [
                    tx.object(this.config.sui.adminCapId),
                    tx.object(this.config.sui.oracleObjectId),
                    tx.object('0x6'), // Clock object
                    tx.pure.vector('string', chains),
                    tx.pure.vector('u64', prices),
                    tx.pure.vector('u64', volatilities),
                ],
            });

            const result = await this.client.signAndExecuteTransaction({
                signer: this.keypair,
                transaction: tx,
            });

            const pricesSummary = dataArray.map(d => `${d.chain}:${d.priceGwei}`).join(', ');
            console.log(`Batch published [${pricesSummary}] (tx: ${result.digest})`);
            return result.digest;
        } catch (error) {
            console.error('Error publishing batch update:', error);
            return null;
        }
    }

    /**
     * Check oracle health by reading current data
     */
    async checkOracleHealth(): Promise<boolean> {
        try {
            const object = await this.client.getObject({
                id: this.config.sui.oracleObjectId,
                options: { showContent: true },
            });

            if (object.data) {
                console.log('Oracle object found:', object.data.objectId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Oracle health check failed:', error);
            return false;
        }
    }

    /**
     * Get current SUI balance
     */
    async getBalance(): Promise<string> {
        try {
            const balance = await this.client.getBalance({
                owner: this.getAddress(),
            });
            return balance.totalBalance;
        } catch (error) {
            return '0';
        }
    }
}
