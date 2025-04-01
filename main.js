
const config = require("./config/index");
const axios = require("axios");
const TelegramService = require("./services/notification/telegram");
const ExchangeService = require("./services/order-execution/ExchangeService");
const MarketDataService = require("./services/market-data/MarketDataService");
const SupertrendAI = require("./services/strategy/SupertrendStrategy");
const telegramService = new TelegramService(config.botToken, config.chatId);
const exchagneService = new ExchangeService(config.apiKey, config.apiSecret);
const marketDataService = new MarketDataService();
const strategyService = new SupertrendAI();

let lastCandleTimestamp = 0;
var clock; 
var prevTrade;
function main(){
    console.log('Bot is running');
    clearInterval(clock);
    clock = setInterval(function (){
        axios.get(`http://localhost:3002/strategy/${config.STRATEGY}?symbol=${config.SYMBOL}&interval=1m`)
        .then(async (response)=>{
            let candle = response.data.candles[0];
            let prevCandle = response.data.candles[1];
            if(response.data.signal[0]&& response.data.signal[0].signal!="exit"){
                prevTrade = response.data.signal[0];
            } 

            let candletimestamp = candle.time;
            
            if(lastCandleTimestamp === 0){
                lastCandleTimestamp = candle.time;
            }
            else if(candletimestamp > lastCandleTimestamp){
                lastCandleTimestamp = candletimestamp;
                console.log('New Candle Detected');
                console.log('Signal:', candle);

                if(candle.exit_signal!=null && prevTrade!=null) {
                    console.log("exit called!")
                    await telegramService.getExitNotificationMessage(config.SYMBOL,candle.close, candle.profit,"exit");
                    prevTrade = null;
                }

                if(candle.partial_exit!=null && prevTrade!=null){
                    console.log("partial_exit called!")
                    await telegramService.getPartialExitMessage(config.SYMBOL, candle.close, "60%", "40%");
                }

                if(prevCandle!=null && prevTrade!=null && Number(prevCandle.supertrend)!=Number(candle.supertrend)&& candle.exit_signal==null && candle.bullish===null && candle.partial_exit==null){
                    await telegramService.getTrailingStopMessage(config.SYMBOL,Number(candle.supertrend).toFixed(2),`Profit: ${candle.profit}%`);
                }

                if(candle.bullish==true){
                    console.log("buy order called!")
                    // Place Buy Order
                    prevTrade = candle;
                    await telegramService.getTradeSignalMessage(candle.new_signal,config.SYMBOL, 
                    candle.close, 
                    "", 
                    Number(candle.supertrend).toFixed(2)
                    );
                    // placeOrder(config.SYMBOL, 'buy', 10, candle.close, 'limit_order', sl = candle.supertrend);

                }
                if(candle.bullish==false){
                    // Place Sell Order
                    console.log("sell order called!")
                    prevTrade = candle;
                    await telegramService.getTradeSignalMessage(candle.new_signal,config.SYMBOL, candle.close, "", Number(candle.supertrend).toFixed(2));
                    // placeOrder(config.SYMBOL, 'sell', 10, candle.close, 'limit_order', sl = candle.supertrend);
                }
                prevCandle = candle;
            }
        })
        .catch((error)=>{
            console.log(error);
        })
    },  100);
}

main();


function mainService(){
    console.log('Bot is running');
    clearInterval(clock);
    clock = setInterval(async function (){
        let ohlcvArr = (await marketDataService.getReverseOHLCVArray(config.SYMBOL,config.TIMEFRAME));
        const response =  strategyService.generateSignals(ohlcvArr);
        let candle = response.candles[0];
        let prevCandle = response.candles[1];

        let candletimestamp = candle.time;

        if(response.signals[0]&& response.signals[0].signal!="exit"){
            prevTrade = response.signals[0];
        } 
    
        if(lastCandleTimestamp === 0){
            lastCandleTimestamp = candle.time;
        }

        else if(candletimestamp > lastCandleTimestamp){
            lastCandleTimestamp = candletimestamp;
            console.log('New Candle Detected');
            console.log('Signal:', candle);

            if(candle.exit_signal!=null && prevTrade!=null) {
                console.log("exit called!")
                await telegramService.getExitNotificationMessage(config.SYMBOL,candle.close, candle.profit,"exit");
                prevTrade = null;
            }

            if(candle.partial_exit!=null && prevTrade!=null){
                console.log("partial_exit called!")
                await telegramService.getPartialExitMessage(config.SYMBOL, candle.close, "60%", "40%");
            }

            if(prevCandle!=null && prevTrade!=null && Number(prevCandle.supertrend)!=Number(candle.supertrend)&& candle.exit_signal==null && candle.bullish===null && candle.partial_exit==null){
                await telegramService.getTrailingStopMessage(config.SYMBOL,Number(candle.supertrend).toFixed(2),`Profit: ${candle.profit}%`);
            }

            if(candle.bullish==true){
                console.log("buy order called!")
                // Place Buy Order
                prevTrade = candle;
                await telegramService.getTradeSignalMessage(candle.new_signal,config.SYMBOL, 
                candle.close, 
                "", 
                Number(candle.supertrend).toFixed(2)
                );
                // placeOrder(config.SYMBOL, 'buy', 10, candle.close, 'limit_order', sl = candle.supertrend);

            }
            if(candle.bullish==false){
                // Place Sell Order
                console.log("sell order called!")
                prevTrade = candle;
                await telegramService.getTradeSignalMessage(candle.new_signal,config.SYMBOL, candle.close, "", Number(candle.supertrend).toFixed(2));
                // placeOrder(config.SYMBOL, 'sell', 10, candle.close, 'limit_order', sl = candle.supertrend);
            }
            prevCandle = candle;
        }
    },  1000);
}

// mainService();

async function checkService(){
    console.log('checking service');
    // let product = await exchagneService.getProducts();
    // console.log(product);
    // let product = await exchagneService.getProduct("BTCUSD");
    //  console.log(product);

    // let assets = await exchagneService.getAssets();
    // console.log(assets);

    // let orderbook = await exchagneService.getOrderBook("BTCUSD");
    // console.log(orderbook);

    let balance = await exchagneService.getWalletBalances();
    console.log("balance:",balance.result[0].available_balance_for_robo);

    let orders = await exchagneService.getOrders();
    console.log("orders:",orders.result);



}
// checkService();