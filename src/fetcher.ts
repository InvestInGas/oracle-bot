/**
 * Gas Price Fetcher
 * Fetches current gas prices from multiple EVM chains
 */

import { JsonRpcProvider, formatUnits } from 'ethers';
import { ChainConfig } from './config';

export interface GasPriceData {
    chain: string;
    priceGwei: number;
    volatility24h: number;
    high24h: number;
    low24h: number;
    timestamp: number;
}

// Store historical prices for volatility calculation
const priceHistory: Map<string, number[]> = new Map();
const MAX_HISTORY_SIZE = 1000; // ~8 minutes at 0.5s intervals

/**
 * Fetch gas price from a single chain
 */
async function fetchChainGasPrice(chain: ChainConfig): Promise<GasPriceData | null> {
    try {
        const provider = new JsonRpcProvider(chain.rpcUrl);
        const feeData = await provider.getFeeData();

        if (!feeData.gasPrice) {
            console.warn(`No gas price data for ${chain.name}`);
            return null;
        }

        // Convert to gwei
        const priceGwei = parseFloat(formatUnits(feeData.gasPrice, 'gwei'));

        // Update price history
        let history = priceHistory.get(chain.name) || [];
        history.push(priceGwei);
        if (history.length > MAX_HISTORY_SIZE) {
            history = history.slice(-MAX_HISTORY_SIZE);
        }
        priceHistory.set(chain.name, history);

        // Calculate statistics
        const stats = calculateStats(history);

        return {
            chain: chain.name,
            priceGwei: Math.round(priceGwei),
            volatility24h: Math.round(stats.stdDev),
            high24h: Math.round(stats.max),
            low24h: Math.round(stats.min),
            timestamp: Date.now(),
        };
    } catch (error) {
        console.error(`Error fetching gas price for ${chain.name}:`, error);
        return null;
    }
}

/**
 * Calculate statistics from price history
 */
function calculateStats(prices: number[]): { mean: number; stdDev: number; max: number; min: number } {
    if (prices.length === 0) {
        return { mean: 0, stdDev: 0, max: 0, min: 0 };
    }

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    const max = Math.max(...prices);
    const min = Math.min(...prices);

    return { mean, stdDev, max, min };
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
 * Check if a chain has a buy signal (price significantly below average)
 */
export function detectBuySignal(data: GasPriceData): { isBuySignal: boolean; savingsPercent: number } {
    const avg = (data.high24h + data.low24h) / 2;
    if (avg === 0 || data.priceGwei >= avg) {
        return { isBuySignal: false, savingsPercent: 0 };
    }

    const savingsPercent = Math.round(((avg - data.priceGwei) / avg) * 100);
    return {
        isBuySignal: savingsPercent > 10,
        savingsPercent,
    };
}
