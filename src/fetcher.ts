/**
 * Gas Price Fetcher
 * Fetches current gas prices from multiple EVM chains
 * Returns prices in WEI for full precision
 */

import { JsonRpcProvider } from 'ethers';
import { ChainConfig } from './config';

export interface GasPriceData {
    chain: string;
    priceWei: string;  // Wei as string for precision
    high24h: string;
    low24h: string;
    timestamp: number;
}

// Store historical prices for 24h high/low calculation
const priceHistory: Map<string, string[]> = new Map();
const MAX_HISTORY_SIZE = 1000; // ~8 minutes at 0.5s intervals

/**
 * Fetch gas price from a single chain
 */
async function fetchChainGasPrice(chain: ChainConfig): Promise<GasPriceData | null> {
    try {
        const provider = new JsonRpcProvider(chain.rpcUrl);

        // Use direct eth_gasPrice call - single RPC request
        const gasPrice = await provider.send('eth_gasPrice', []);

        if (!gasPrice) {
            console.warn(`No gas price data for ${chain.name}`);
            return null;
        }

        // Convert hex to wei string
        const priceWei = BigInt(gasPrice).toString();

        // Update price history
        let history = priceHistory.get(chain.name) || [];
        history.push(priceWei);
        if (history.length > MAX_HISTORY_SIZE) {
            history = history.slice(-MAX_HISTORY_SIZE);
        }
        priceHistory.set(chain.name, history);

        // Calculate 24h high/low from history
        const stats = calculateStats(history);

        return {
            chain: chain.name,
            priceWei,
            high24h: stats.max,
            low24h: stats.min,
            timestamp: Date.now(),
        };
    } catch (error) {
        console.error(`Error fetching gas price for ${chain.name}:`, error);
        return null;
    }
}

/**
 * Calculate statistics from price history (wei strings)
 */
function calculateStats(prices: string[]): { max: string; min: string } {
    if (prices.length === 0) {
        return { max: '0', min: '0' };
    }

    let max = BigInt(prices[0]);
    let min = BigInt(prices[0]);

    for (const price of prices) {
        const p = BigInt(price);
        if (p > max) max = p;
        if (p < min) min = p;
    }

    return { max: max.toString(), min: min.toString() };
}

/**
 * Fetch gas prices from all enabled chains
 */
export async function fetchAllGasPrices(chains: ChainConfig[]): Promise<GasPriceData[]> {
    const enabledChains = chains.filter(c => c.enabled);

    const results = await Promise.all(
        enabledChains.map(chain => fetchChainGasPrice(chain))
    );

    return results.filter((r): r is GasPriceData => r !== null);
}

/**
 * Format wei to human-readable gwei (for display only)
 */
export function weiToGwei(weiStr: string): string {
    const wei = BigInt(weiStr);
    const gwei = Number(wei) / 1e9;
    return gwei.toFixed(6);
}

/**
 * Check if a chain has a buy signal (price significantly below average)
 */
export function detectBuySignal(data: GasPriceData): { isBuySignal: boolean; savingsPercent: number } {
    const price = BigInt(data.priceWei);
    const high = BigInt(data.high24h);
    const low = BigInt(data.low24h);

    const avg = (high + low) / 2n;
    if (avg === 0n || price >= avg) {
        return { isBuySignal: false, savingsPercent: 0 };
    }

    const savings = Number(((avg - price) * 100n) / avg);
    return {
        isBuySignal: savings > 10,
        savingsPercent: Math.round(savings),
    };
}
