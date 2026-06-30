const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const StrategyRegistry = require('../services/strategy/StrategyRegistry');
const CandleStore = require('../lib/CandleStore');
const BacktestEngine = require('./Engine');
const { buildTradeList } = require('../lib/TradeBuilder');

class PaperEngine {
    constructor() {
        this.dbPath = path.join(__dirname, '../services/market-data/db/data/paper.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.initDb();
    }

    initDb() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS deployments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT,
                interval TEXT,
                strategy TEXT,
                params TEXT,
                balance REAL,
                leverage REAL,
                fee REAL,
                risk REAL,
                deployed_at INTEGER,
                status TEXT
            )
        `);
    }

    async deploy(config) {
        return new Promise((resolve, reject) => {
            const paramsJson = JSON.stringify(config.params || {});
            const now = Math.floor(Date.now() / 1000);
            
            const stmt = this.db.prepare(`
                INSERT INTO deployments 
                (symbol, interval, strategy, params, balance, leverage, fee, risk, deployed_at, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `);
            
            stmt.run(
                config.symbol,
                config.interval,
                config.strategy,
                paramsJson,
                config.balance || 10000,
                config.leverage || 200,
                config.fee || 0.01,
                config.risk || 1,
                now,
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
            stmt.finalize();
        });
    }

    async stopAll() {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE deployments SET status = 'stopped' WHERE status = 'active'`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async stopDeployment(id) {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE deployments SET status = 'stopped' WHERE id = ?`, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getActiveDeployments() {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM deployments WHERE status = 'active' ORDER BY id DESC`, (err, rows) => {
                if (err) reject(err);
                else {
                    const deployments = rows.map(row => {
                        row.params = JSON.parse(row.params);
                        return row;
                    });
                    resolve(deployments);
                }
            });
        });
    }

    // This calculates the live state of all paper deployments deterministically
    async getStatuses() {
        const deployments = await this.getActiveDeployments();
        if (!deployments || deployments.length === 0) return { active: false, deployments: [] };

        const statuses = await Promise.all(deployments.map(async (deployment) => {
            try {
                return await this.calculateDeploymentStatus(deployment);
            } catch (err) {
                console.error(`Failed to calc status for deployment ${deployment.id}:`, err);
                return { active: true, deployment, error: err.message, balance: deployment.balance, trades: [], openPosition: null };
            }
        }));

        return {
            active: true,
            deployments: statuses,
            lastUpdate: Math.floor(Date.now() / 1000)
        };
    }

    async calculateDeploymentStatus(deployment) {
        const warmupCandles = 300;
        
        // interval mapping to seconds
        const intervals = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
        const intervalSecs = intervals[deployment.interval] || 3600;
        const fromTime = deployment.deployed_at - (warmupCandles * intervalSecs);

        const ohlcv = await CandleStore.getAsOHLCV({
            symbol: deployment.symbol,
            interval: deployment.interval,
            from: fromTime
        });

        if (!ohlcv.close || ohlcv.close.length === 0) {
            return { active: true, deployment, balance: deployment.balance, trades: [], openPosition: null };
        }

        const entry = StrategyRegistry.get(deployment.strategy);
        if (!entry) throw new Error(`Strategy ${deployment.strategy} not found`);

        const parsedOpts = entry.parseOpts(deployment.params);
        const strategyInstance = new entry.Cls(parsedOpts);

        let feedOhlcv = ohlcv;
        if (entry.useHeikinAshi) {
            const HeikinAshi = require('../lib/HeikinAshi');
            feedOhlcv = HeikinAshi.transform(ohlcv);
        }

        const { candles } = strategyInstance.generateSignals(feedOhlcv);
        const rawTrades = buildTradeList(candles);

        const engine = new BacktestEngine({ 
            initialBalance: deployment.balance, 
            leverage: deployment.leverage, 
            fee: deployment.fee, 
            riskPercentPerTrade: deployment.risk 
        });

        const { report, trades: processedTrades } = engine.run(rawTrades);

        // Filter out trades that were opened BEFORE deployment time
        // The deterministic engine simulates everything, but for paper trading we only "execute" trades after we deployed.
        const paperTrades = [];
        let currentBalance = deployment.balance;

        for (const t of processedTrades) {
            const entryTimeSecs = Math.floor(new Date(t.entry_time).getTime() / 1000);
            if (entryTimeSecs >= deployment.deployed_at) {
                t.profit = t.pnl || 0;
                t.profitPct = t.avg_profit || 0;
                paperTrades.push(t);
                currentBalance += t.pnl || 0;
            }
        }

        // Check if there is an active position
        let openPosition = null;
        
        // Use the highly detailed TradeManager state if the strategy supports it
        if (strategyInstance.tradeManager && strategyInstance.tradeManager.hasActivePosition()) {
            const pos = strategyInstance.tradeManager.getActivePosition();
            
            // Reconstruct the exact live state
            const currentPrice = candles[candles.length - 1].close;
            const priceDiff = pos.isLong ? currentPrice - pos.entry_price : pos.entry_price - currentPrice;
            const unrealizedPnLPct = (priceDiff / pos.entry_price) * 100;
            
            openPosition = {
                isLong: pos.isLong,
                size: pos.size_quote,
                quantityPct: pos.quantity_pct,
                entryPrice: pos.entry_price,
                currentPrice: currentPrice,
                stoploss: pos.stoploss,
                takeProfits: pos.tps,
                trailing: pos.trailing,
                highestProfitPrice: pos.highest_profit_price,
                unrealizedPnLPct: unrealizedPnLPct
            };
        } else if (candles.length > 0) {
            // Fallback for legacy strategies (e.g. ImbaAlgo) that write directly to the candle
            const lastCandle = candles[candles.length - 1];
            if (lastCandle.remaining_qty && lastCandle.remaining_qty > 0) {
                const currentPrice = lastCandle.close;
                const entryPrice = lastCandle.entry_price || lastCandle.close; // Approximate if not provided
                const priceDiff = lastCandle.isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
                
                openPosition = {
                    isLong: lastCandle.isLong || lastCandle.bullish,
                    size: lastCandle.remaining_qty,
                    quantityPct: lastCandle.remaining_qty, // legacy approximation
                    entryPrice: entryPrice,
                    currentPrice: currentPrice,
                    stoploss: lastCandle.stoploss,
                    takeProfits: [
                        { targetPrice: lastCandle.tp1, hit: lastCandle.tp1_hit },
                        { targetPrice: lastCandle.tp2, hit: lastCandle.tp2_hit },
                        { targetPrice: lastCandle.tp3, hit: lastCandle.tp3_hit },
                        { targetPrice: lastCandle.tp4, hit: lastCandle.tp4_hit },
                    ].filter(tp => tp.targetPrice != null),
                    unrealizedPnLPct: (priceDiff / entryPrice) * 100
                };
            }
        }

        return {
            deployment,
            balance: currentBalance,
            trades: paperTrades,
            openPosition
        };
    }
}

module.exports = new PaperEngine();
