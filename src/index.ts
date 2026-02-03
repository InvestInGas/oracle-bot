/**
 * Gas Oracle Bot - Main Entry Point
 * 
 * Fetches gas prices from EVM chains every 0.5 seconds
 * and publishes them to the Sui blockchain.
 */

import 'dotenv/config';
import { loadConfig, validateConfig } from './config';
import { fetchAllGasPrices, detectBuySignal, weiToGwei } from './fetcher';
import { SuiPublisher } from './publisher';

async function main() {
    console.log('Starting Gas Oracle Bot...');
    console.log('================================');

    // Load configuration
    const config = loadConfig();

    // Validate configuration
    const validation = validateConfig(config);
    if (!validation.valid) {
        console.error('\nConfiguration errors:');
        validation.errors.forEach(e => console.error(`   - ${e}`));
        process.exit(1);
    }

    if (validation.errors.length > 0) {
        console.log('\nConfiguration warnings:');
        validation.errors.forEach(e => console.log(`   - ${e}`));
    }

    console.log(`\nNetwork: ${config.sui.network}`);
    console.log(`Update interval: ${config.updateIntervalMs}ms`);
    console.log(`Chains: ${config.chains.filter(c => c.enabled).map(c => c.name).join(', ')}`);

    // Initialize publisher
    const publisher = new SuiPublisher(config);
    console.log(`\nBot address: ${publisher.getAddress()}`);

    // Check balance
    const balance = await publisher.getBalance();
    const balanceSui = (parseInt(balance) / 1_000_000_000).toFixed(4);
    console.log(`Balance: ${balanceSui} SUI`);

    if (parseInt(balance) === 0 && config.sui.packageId !== '0x0') {
        console.warn('\nWarning: Bot has 0 SUI balance. Transactions will fail.');
        console.warn('Get testnet SUI: sui client faucet');
    }

    // Check if we have valid contract addresses
    if (config.sui.packageId === '0x0') {
        console.log('\nRunning in DEMO MODE (no package ID)');
        console.log('Gas prices will be fetched but not published to Sui.');
        console.log('Set ORACLE_PACKAGE_ID in .env after deployment.\n');
    } else {
        // Verify oracle exists
        console.log('\nChecking oracle health...');
        const healthy = await publisher.checkOracleHealth();
        if (!healthy) {
            console.error('Oracle health check failed. Check your configuration.');
            process.exit(1);
        }
    }

    // Track statistics
    let updateCount = 0;
    let errorCount = 0;
    const startTime = Date.now();

    // Main update loop
    async function runUpdateCycle() {
        try {
            // Fetch all gas prices
            const prices = await fetchAllGasPrices(config.chains);

            if (prices.length === 0) {
                console.warn('No prices fetched in this cycle');
                return;
            }

            // Log current prices (show both wei and gwei for clarity)
            const timestamp = new Date().toLocaleTimeString();
            console.log(`\n[${timestamp}] Gas Prices:`);

            for (const price of prices) {
                const signal = detectBuySignal(price);
                const buyIndicator = signal.isBuySignal ? ` 🟢 BUY (${signal.savingsPercent}% savings)` : '';
                const gweiDisplay = weiToGwei(price.priceWei);
                console.log(`  ${price.chain.padEnd(10)}: ${price.priceWei} wei (${gweiDisplay} gwei)${buyIndicator}`);
            }

            // Publish to Sui (if configured)
            if (config.sui.packageId !== '0x0') {
                if (prices.length >= config.batchSize) {
                    // Use batch update for efficiency
                    await publisher.publishBatchUpdate(prices);
                } else {
                    // Publish individually
                    for (const price of prices) {
                        await publisher.publishSingleUpdate(price);
                    }
                }
            }

            updateCount++;
        } catch (error) {
            errorCount++;
            console.error('Update cycle error:', error);
        }
    }

    // Print stats periodically
    setInterval(() => {
        const uptime = Math.round((Date.now() - startTime) / 1000);
        const uptimeMin = Math.floor(uptime / 60);
        const uptimeSec = uptime % 60;
        console.log(`\nStats: ${updateCount} updates | ${errorCount} errors | Uptime: ${uptimeMin}m ${uptimeSec}s`);
    }, 60000); // Every minute

    // Run the update loop
    console.log('\nStarting update loop...\n');

    // Initial run
    await runUpdateCycle();

    // Schedule recurring updates
    setInterval(runUpdateCycle, config.updateIntervalMs);

    // Keep process alive
    console.log('\nBot is running. Press Ctrl+C to stop.\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down Gas Oracle Bot...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\nShutting down Gas Oracle Bot...');
    process.exit(0);
});

// Run main
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
