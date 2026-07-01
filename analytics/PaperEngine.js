const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const StrategyRegistry = require('../services/strategy/StrategyRegistry');
const CandleStore = require('../lib/CandleStore');
const BacktestEngine = require('./Engine');
const { buildTradeList } = require('../lib/TradeBuilder');
const DeltaOrderbook = require('../services/market-data/DeltaOrderbook');

function formatQuantityByPipSize(symbol, rawQuantity) {
    let pipSize = 0.001; // default fallback
    const sym = symbol.toUpperCase();
    if (sym.includes('BTC')) pipSize = 0.001;
    else if (sym.includes('ETH')) pipSize = 0.01;
    else if (sym.includes('SOL') || sym.includes('AVAX') || sym.includes('LINK')) pipSize = 0.1;
    else if (sym.includes('XRP') || sym.includes('DOGE') || sym.includes('MATIC') || sym.includes('ADA') || sym.includes('TRX')) pipSize = 1;
    else if (sym.includes('SHIB') || sym.includes('PEPE') || sym.includes('FLOKI')) pipSize = 1000;
    else if (sym.includes('BNB')) pipSize = 0.01;
    
    const precision = Math.round(1 / pipSize);
    return Math.floor(rawQuantity * precision) / precision;
}

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

    async startDeployment(id) {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE deployments SET status = 'active' WHERE id = ?`, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async deleteDeployment(id) {
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM deployments WHERE id = ?`, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getAllDeployments() {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM deployments ORDER BY id DESC`, (err, rows) => {
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

    async getStatuses() {
        const deployments = await this.getAllDeployments();
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

        // Ensure we are subscribed to live orderbook for this symbol
        DeltaOrderbook.subscribe(deployment.symbol);

        let feedOhlcv = ohlcv;
        
        // Inject live tick data into the candles array for realistic TP/SL execution
        const ltp = DeltaOrderbook.getLTP(deployment.symbol);
        if (ltp && feedOhlcv.close.length > 0) {
            const lastIdx = feedOhlcv.close.length - 1;
            const lastTime = feedOhlcv.time[lastIdx];
            const nowSecs = Math.floor(Date.now() / 1000);
            
            // Check if we have crossed into a new candle interval boundary
            if (nowSecs >= lastTime + intervalSecs) {
                // Reallocate Float64Arrays to hold the new candle
                const newLength = feedOhlcv.close.length + 1;
                const newOhlcv = {
                    time: new Float64Array(newLength),
                    open: new Float64Array(newLength),
                    high: new Float64Array(newLength),
                    low: new Float64Array(newLength),
                    close: new Float64Array(newLength),
                    volume: new Float64Array(newLength)
                };
                
                newOhlcv.time.set(feedOhlcv.time);
                newOhlcv.open.set(feedOhlcv.open);
                newOhlcv.high.set(feedOhlcv.high);
                newOhlcv.low.set(feedOhlcv.low);
                newOhlcv.close.set(feedOhlcv.close);
                newOhlcv.volume.set(feedOhlcv.volume);
                
                // Initialize the new live candle starting at the exact interval bucket
                const nextBucket = Math.floor(nowSecs / intervalSecs) * intervalSecs;
                const newIdx = newLength - 1;
                newOhlcv.time[newIdx] = nextBucket;
                newOhlcv.open[newIdx] = ltp; // Open at the exact LTP crossover
                newOhlcv.high[newIdx] = ltp;
                newOhlcv.low[newIdx] = ltp;
                newOhlcv.close[newIdx] = ltp;
                newOhlcv.volume[newIdx] = 0;
                
                feedOhlcv = newOhlcv;
            } else {
                // If the latest tick pushes the high/low, expand the current candle
                if (ltp > feedOhlcv.high[lastIdx]) feedOhlcv.high[lastIdx] = ltp;
                if (ltp < feedOhlcv.low[lastIdx]) feedOhlcv.low[lastIdx] = ltp;
                feedOhlcv.close[lastIdx] = ltp;
            }
        }

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
            let entryTimeSecs = 0;
            if (/^\d+$/.test(t.entry_time)) {
                entryTimeSecs = parseInt(t.entry_time, 10);
            } else if (typeof t.entry_time === 'string' && t.entry_time.includes('/')) {
                // DD/MM/YYYY, HH:mm:ss or similar
                const match = t.entry_time.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
                if (match) {
                    entryTimeSecs = Math.floor(new Date(match[3], match[2] - 1, match[1], match[4], match[5], match[6]).getTime() / 1000);
                } else {
                    entryTimeSecs = Math.floor(new Date(t.entry_time).getTime() / 1000);
                }
            } else {
                entryTimeSecs = Math.floor(new Date(t.entry_time).getTime() / 1000);
            }
            
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
            // Reconstruct the exact live state using Orderbook Execution Prices
            const ltp = DeltaOrderbook.getLTP(deployment.symbol) || candles[candles.length - 1].close;
            // Get actual exit price if we were to close this position via market order right now
            const rawBaseQuantity = pos.size_quote / pos.entry_price;
            const baseQuantity = formatQuantityByPipSize(deployment.symbol, rawBaseQuantity);
            const currentPrice = DeltaOrderbook.getExecutionPrice(deployment.symbol, !pos.isLong, baseQuantity) || ltp;
            
            const priceDiff = pos.isLong ? currentPrice - pos.entry_price : pos.entry_price - currentPrice;
            const rawUnrealizedPnLPct = (priceDiff / pos.entry_price) * 100;

            // Real Exchange Simulation (Fees, Spread, Funding)
            // Note: Slippage is already naturally accounted for by getExecutionPrice against the Orderbook!
            const fee = deployment.fee || 0.05;
            const costPerSide = fee; 
            
            const leverage = deployment.leverage || 100;
            const positionSize = pos.size_quote;
            const margin = positionSize / leverage;
            const totalCost = (positionSize * costPerSide / 100) * 2; // Paid on entry + projected exit
            
            const { parseCustomDate } = require('./Observers');
            let holdingHours = 0;
            
            let entryTimeObj;
            if (typeof pos.entry_time === 'number' || (typeof pos.entry_time === 'string' && /^\d+$/.test(pos.entry_time))) {
                const et = Number(pos.entry_time);
                entryTimeObj = new Date(et < 10000000000 ? et * 1000 : et);
            } else {
                entryTimeObj = parseCustomDate(pos.entry_time) || new Date(pos.entry_time);
            }
            
            const lastTime = candles[candles.length - 1].time;
            let currentTimeObj = new Date(Date.now());
            if (lastTime) {
                const lt = Number(lastTime);
                currentTimeObj = new Date(lt < 10000000000 ? lt * 1000 : lt);
            }
            
            if (entryTimeObj && currentTimeObj && !isNaN(entryTimeObj) && !isNaN(currentTimeObj)) {
                holdingHours = (currentTimeObj - entryTimeObj) / (1000 * 60 * 60);
            }

            const fundingCost = (positionSize * (0.01 / 8) / 100) * holdingHours;
            
            const rawPnl = (positionSize * rawUnrealizedPnLPct / 100);
            const netPnl = rawPnl - totalCost - fundingCost;
            const roePct = margin > 0 ? (netPnl / margin) * 100 : 0;
            
            const mmr = 0.005; // 0.5% Maintenance Margin Rate
            const liquidationPrice = pos.isLong
                ? pos.entry_price * (1 - (1/leverage) + mmr)
                : pos.entry_price * (1 + (1/leverage) - mmr);
            
            openPosition = {
                isLong: pos.isLong,
                size: pos.size_quote,
                quantityPct: pos.quantity_pct,
                qnt: baseQuantity,
                entryTime: pos.entry_time,
                entryPrice: pos.entry_price,
                currentPrice: currentPrice,
                stoploss: pos.stoploss,
                takeProfits: pos.tps,
                trailing: pos.trailing,
                highestProfitPrice: pos.highest_profit_price,
                unrealizedPnLPct: roePct,
                unrealizedPnL: netPnl,
                liquidationPrice: liquidationPrice,
                isLiveExecution: true
            };
        } else if (candles.length > 0) {
            // Fallback for legacy strategies (e.g. ImbaAlgo) that write directly to the candle
            const lastCandle = candles[candles.length - 1];
            const hasSignals = candles.some(c => c.new_signal);
            if (!hasSignals && lastCandle.remaining_qty && lastCandle.remaining_qty > 0) {
                const ltp = DeltaOrderbook.getLTP(deployment.symbol) || lastCandle.close;
                const entryPrice = lastCandle.entry_price || lastCandle.close; // Approximate if not provided
                const rawBaseQuantity = lastCandle.remaining_qty / entryPrice;
                const baseQuantity = formatQuantityByPipSize(deployment.symbol, rawBaseQuantity);
                const currentPrice = DeltaOrderbook.getExecutionPrice(deployment.symbol, !lastCandle.isLong, baseQuantity) || ltp;
                const priceDiff = lastCandle.isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
                const rawUnrealizedPnLPct = (priceDiff / entryPrice) * 100;
                
                // Real Exchange Simulation
                const fee = deployment.fee || 0.05;
                const costPerSide = fee;
                
                const positionSize = lastCandle.remaining_qty;
                const leverage = deployment.leverage || 100;
                const margin = positionSize / leverage;
                const totalCost = (positionSize * costPerSide / 100) * 2;
                
                const mmr = 0.005; // 0.5% Maintenance Margin Rate
                const liquidationPrice = (lastCandle.isLong || lastCandle.bullish)
                    ? entryPrice * (1 - (1/leverage) + mmr)
                    : entryPrice * (1 + (1/leverage) - mmr);
                
                const { parseCustomDate } = require('./Observers');
                let holdingHours = 0;
                const entryTimeStr = lastCandle.entry_time || lastCandle.datetime || String(lastCandle.time);
                let entryTimeObj = parseCustomDate(entryTimeStr);
                if (!entryTimeObj && lastCandle.time) {
                    entryTimeObj = new Date(lastCandle.time < 10000000000 ? lastCandle.time * 1000 : lastCandle.time);
                } else if (!entryTimeObj) {
                    entryTimeObj = new Date(entryTimeStr);
                }
                const timeVal = lastCandle.time < 10000000000 ? lastCandle.time * 1000 : lastCandle.time;
                const currentTimeObj = new Date(timeVal || Date.now());
                if (entryTimeObj && currentTimeObj && !isNaN(entryTimeObj) && !isNaN(currentTimeObj)) {
                    holdingHours = (currentTimeObj - entryTimeObj) / (1000 * 60 * 60);
                }
                const fundingCost = (positionSize * (0.01 / 8) / 100) * holdingHours;
                
                const rawPnl = (positionSize * rawUnrealizedPnLPct / 100);
                const netPnl = rawPnl - totalCost - fundingCost;
                const roePct = margin > 0 ? (netPnl / margin) * 100 : 0;
                
                openPosition = {
                    isLong: lastCandle.isLong || lastCandle.bullish,
                    size: lastCandle.remaining_qty,
                    quantityPct: lastCandle.remaining_qty, // legacy approximation
                    qnt: baseQuantity,
                    entryTime: lastCandle.entry_time || lastCandle.datetime || String(lastCandle.time),
                    entryPrice: entryPrice,
                    currentPrice: currentPrice,
                    stoploss: lastCandle.stoploss,
                    takeProfits: [
                        { targetPrice: lastCandle.tp1, hit: lastCandle.tp1_hit },
                        { targetPrice: lastCandle.tp2, hit: lastCandle.tp2_hit },
                        { targetPrice: lastCandle.tp3, hit: lastCandle.tp3_hit },
                        { targetPrice: lastCandle.tp4, hit: lastCandle.tp4_hit },
                    ].filter(tp => tp.targetPrice),
                    unrealizedPnLPct: roePct,
                    unrealizedPnL: netPnl,
                    liquidationPrice: liquidationPrice,
                    isLiveExecution: true
                };
            } else {
                // Universal fallback: scan candles for an unclosed signal
                let activeTrade = null;
                for (const c of candles) {
                    if (activeTrade) {
                        let slHit = false;
                        if (activeTrade.isLong) {
                            if (c.open <= activeTrade.stoploss || c.low <= activeTrade.stoploss) slHit = true;
                        } else {
                            if (c.open >= activeTrade.stoploss || c.high >= activeTrade.stoploss) slHit = true;
                        }
                        if (slHit || c.exit_signal === 'exit') {
                            activeTrade = null;
                        }
                    }
                    
                    if (!activeTrade && typeof c.new_signal === 'string' && (c.new_signal.includes('Buy') || c.new_signal.includes('Sell'))) {
                        activeTrade = {
                            entryPrice: c.close,
                            entryTime: c.datetime || String(c.time),
                            stoploss: c.stoploss,
                            isLong: c.bullish || c.new_signal.includes('Buy'),
                            tps: [
                                { targetPrice: c.tp1 },
                                { targetPrice: c.tp2 },
                                { targetPrice: c.tp3 },
                                { targetPrice: c.tp4 }
                            ].filter(tp => tp.targetPrice != null)
                        };
                    }
                }

                if (activeTrade) {
                    const leverage = deployment.leverage || 100;
                    const positionSize = (currentBalance * (deployment.risk || 1) / 100) * leverage;
                    const margin = positionSize / leverage;
                    
                    const mmr = 0.005;
                    const liquidationPrice = activeTrade.isLong
                        ? activeTrade.entryPrice * (1 - (1/leverage) + mmr)
                        : activeTrade.entryPrice * (1 + (1/leverage) - mmr);
                    
                    const rawBaseQuantity = positionSize / activeTrade.entryPrice;
                    const baseQuantity = formatQuantityByPipSize(deployment.symbol, rawBaseQuantity);
                    
                    const ltp = DeltaOrderbook.getLTP(deployment.symbol) || candles[candles.length - 1].close;
                    // To exit the position, we do the opposite of activeTrade.isLong
                    const currentPrice = DeltaOrderbook.getExecutionPrice(deployment.symbol, !activeTrade.isLong, baseQuantity) || ltp;
                    
                    const priceDiff = activeTrade.isLong ? currentPrice - activeTrade.entryPrice : activeTrade.entryPrice - currentPrice;
                    const rawUnrealizedPnLPct = (priceDiff / activeTrade.entryPrice) * 100;
                    
                    const fee = deployment.fee || 0.05;
                    const totalCost = (positionSize * fee / 100) * 2;
                    
                    const { parseCustomDate } = require('./Observers');
                    let holdingHours = 0;
                    let entryTimeObj = parseCustomDate(activeTrade.entryTime);
                    if (!entryTimeObj && activeTrade.entryTime && !isNaN(Number(activeTrade.entryTime))) {
                        const etNum = Number(activeTrade.entryTime);
                        entryTimeObj = new Date(etNum < 10000000000 ? etNum * 1000 : etNum);
                    } else if (!entryTimeObj) {
                        entryTimeObj = new Date(activeTrade.entryTime);
                    }
                    const lastTime = candles[candles.length - 1].time;
                    const timeVal = lastTime < 10000000000 ? lastTime * 1000 : lastTime;
                    const currentTimeObj = new Date(timeVal || Date.now());
                    if (entryTimeObj && currentTimeObj && !isNaN(entryTimeObj) && !isNaN(currentTimeObj)) {
                        holdingHours = (currentTimeObj - entryTimeObj) / (1000 * 60 * 60);
                    }
                    const fundingCost = (positionSize * (0.01 / 8) / 100) * holdingHours;
                    
                    const rawPnl = (positionSize * rawUnrealizedPnLPct / 100);
                    const netPnl = rawPnl - totalCost - fundingCost;
                    const roePct = margin > 0 ? (netPnl / margin) * 100 : 0;
                    
                    openPosition = {
                        isLong: activeTrade.isLong,
                        size: positionSize,
                        quantityPct: 1, // 100% of risk
                        qnt: baseQuantity,
                        entryTime: activeTrade.entryTime,
                        entryPrice: activeTrade.entryPrice,
                        currentPrice: currentPrice,
                        stoploss: activeTrade.stoploss,
                        takeProfits: activeTrade.tps,
                        unrealizedPnLPct: roePct,
                        unrealizedPnL: netPnl,
                        liquidationPrice: liquidationPrice
                    };
                }
            }
        }

        return {
            deployment,
            balance: currentBalance,
            trades: paperTrades,
            openPosition,
            candles: candles.slice(-100).map(c => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
            }))
        };
    }
}

module.exports = new PaperEngine();
