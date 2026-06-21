const config = require("./config/index");
const TelegramService = require("./services/notification/telegram");
const ExchangeService = require("./services/order-execution/ExchangeService");
const { getCandles } = require("./services/market-data/candleService");
const SupertrendAI = require("./services/strategy/SupertrendStrategy");
const { convertOHLCVtoArray } = require("./services/strategy/utils");

const telegramService = new TelegramService(config.botToken, config.chatId);
const exchagneService = new ExchangeService(config.apiKey, config.apiSecret);
const strategyService = new SupertrendAI();

let lastCandleTimestamp = 0;
let clock; 
let prevTrade;

async function main() {
    console.log('Bot is running (Low Latency Mode - In-Memory Execution)');
    clearInterval(clock);
    clock = setInterval(async function () {
        try {
            // Fetch directly from local memory/DB instead of HTTP polling
            const rawCandles = await getCandles({ 
                symbol: config.SYMBOL || 'BTCUSD', 
                interval: config.TIMEFRAME || '15m' 
            });

            if (!rawCandles || rawCandles.length < 50) return;

            const candlesArray = convertOHLCVtoArray(rawCandles);
            const response = strategyService.generateSignals(candlesArray);

            let candles = response.candles.reverse();
            let signals = response.signals.reverse();

            let candle = candles[1];
            let prevCandle = candles[2];
            let signal = signals[0];

            if(signal && signal.signal !== "exit"){
                if(signal.signal === "partial_exit") {
                    prevTrade = signal.active;
                } else{
                    prevTrade = signal;
                }
            } 

            let candletimestamp = candle.time;
            
            if(lastCandleTimestamp === 0){
                lastCandleTimestamp = candle.time;
            }
            else if(candletimestamp > lastCandleTimestamp){
                lastCandleTimestamp = candletimestamp;
                console.log('New Candle Detected');
                console.log('prevCandle:', prevCandle);
                console.log('Signal:', candle);

                if(candle.exit_signal != null && prevTrade != null) {
                    console.log("exit called!");
                    await telegramService.getExitNotificationMessage(config.SYMBOL || 'BTCUSD', candle.close, candle.profit, "exit");
                    let position = await getPosition(config.SYMBOL || 'BTCUSD');
                    if(position != null){
                        await exchagneService.exitOrder(position.product_id, -Number(position.size), Number(position.size) < 0 ? "buy" : "sell");
                    }
                    prevTrade = null;
                }

                if(candle.partial_exit != null && prevTrade != null){
                    console.log("partial_exit called!");
                    await telegramService.getPartialExitMessage(config.SYMBOL || 'BTCUSD', candle.close, "30%", "40%");
                    let position = await getPosition(config.SYMBOL || 'BTCUSD');
                    if(position != null){
                        let exit = Math.abs(position.size) > 1 ? Number(position.size) * 0.5 : Number(position.size);
                        await exchagneService.exitOrder(position.product_id, -Number(exit), Number(position.size) < 0 ? "buy" : "sell");
                    }
                }

                if(prevCandle != null && prevTrade != null && Number(prevCandle.supertrend) != Number(candle.supertrend) && candle.exit_signal == null && candle.bullish === null && candle.partial_exit == null){
                    await telegramService.getTrailingStopMessage(config.SYMBOL || 'BTCUSD', Number(candle.supertrend).toFixed(2), `Profit: ${candle.profit}%`);
                    console.log("edit order called!");
                }

                if(["Buy", "Smart Buy"].includes(candle.new_signal)){
                    console.log("buy order called!");
                    prevTrade = candle;
                    await telegramService.getTradeSignalMessage(candle.new_signal, config.SYMBOL || 'BTCUSD', candle.close, "", Number(candle.stoploss).toFixed(2));
                    let orderMarket = await exchagneService.placeOrder(config.SYMBOL || 'BTCUSD', "buy", 2, candle.close, "market_order", Number(candle.stoploss).toFixed(2));
                    console.log("orderMarket:", orderMarket.result);
                }

                if(["Sell", "Smart Sell"].includes(candle.new_signal)){
                    console.log("sell order called!");
                    prevTrade = candle;
                    await telegramService.getTradeSignalMessage(candle.new_signal, config.SYMBOL || 'BTCUSD', candle.close, "", Number(candle.stoploss).toFixed(2));
                    let orderMarket = await exchagneService.placeOrder(config.SYMBOL || 'BTCUSD', "sell", 2, candle.close, "market_order", Number(candle.stoploss).toFixed(2));
                    console.log("orderMarket:", orderMarket.result);
                }

                prevCandle = candle;
            }
        } catch (error) {
            console.log("Trading loop error:", error.message);
        }
    }, 1000);
}

main();

async function getSLOrder(){
    let orders = await exchagneService.getOrders();
    let order = orders.result.filter((order)=>order.stop_order_type==="stop_loss_order");
    if(order.length==0){
        return null;
    }
    order = order[0];
    return {order_id:order.id, product_id:order.product_id, exit_lots:order.size, side:order.side};
}

async function getPosition(symbol) {
    let positions = await exchagneService.getMarginedPositions();
    let position = positions.result.filter((position)=>position.product_symbol===symbol);
    if(position.length==0){
        return null;
    }
    position = position[0];
    return {product_id:position.product_id, size:position.size};
}