
const config = require("./config/index");
const axios = require("axios");
const TelegramService = require("./services/notification/telegram");
const ExchangeService = require("./services/order-execution/ExchangeService");
const MarketDataService = require("./services/market-data/MarketDataService");
const SupertrendAI = require("./services/strategy/SupertrendStrategy");
const { CandleList } = require("technicalindicators");
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
                    let position = await getPosition(config.SYMBOL);
                    if(position!=null){
                        await exchagneService.exitOrder(position.product_id, -Number(position.size), Number(position.size) < 0 ? "buy" : "sell");
                    }
                    prevTrade = null;
                }

                if(candle.partial_exit!=null && prevTrade!=null){
                    console.log("partial_exit called!")
                    await telegramService.getPartialExitMessage(config.SYMBOL, candle.close, "30%", "40%");
                }

                if(prevCandle!=null && prevTrade!=null && Number(prevCandle.supertrend)!=Number(candle.supertrend)&& candle.exit_signal==null && candle.bullish===null && candle.partial_exit==null){
                    await telegramService.getTrailingStopMessage(config.SYMBOL,Number(candle.supertrend).toFixed(2),`Profit: ${candle.profit}%`);
                    let slOrder = await getSLOrder();
                    if(slOrder!=null){
                        await exchagneService.editOrder(slOrder.order_id, slOrder.product_id, Number(candle.supertrend).toFixed(2));    
                    }
                    console.log("edit order called!")
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
                    let orderMarket = await exchagneService.placeOrder(config.SYMBOL, "buy", 1, 10000, "market_order",Number(candle.supertrend).toFixed(2));
                    console.log("orderMarket:",orderMarket.result);
        

                }
                if(candle.bullish==false){
                    // Place Sell Order
                    console.log("sell order called!")
                    prevTrade = candle;
                    await telegramService.getTradeSignalMessage(candle.new_signal,config.SYMBOL, candle.close, "", Number(candle.supertrend).toFixed(2));
                    // placeOrder(config.SYMBOL, 'sell', 10, candle.close, 'limit_order', sl = candle.supertrend);

                    let orderMarket = await exchagneService.placeOrder(config.SYMBOL, "sell",1, 10000, "market_order",Number(candle.supertrend).toFixed(2));
                    console.log("orderMarket:",orderMarket.result);
                }
                prevCandle = candle;
            }
        })
        .catch((error)=>{
            console.log(error);
        })
    },  1000);
}



// main();


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


async function getSLOrder(){
    let orders = await exchagneService.getOrders();
    let order = orders.result.filter((order)=>order.stop_order_type==="stop_loss_order");
    if(order.length==0){
        return null;
    }
    order = order[0];
    return {order_id:order.id, product_id:order.product_id, exit_lots:order.size, side:order.side};
}


async function getTPOrder(){
    let orders = await exchagneService.getOrders();
    let order = orders.result.filter((order)=>order.stop_order_type==="take_profit_order");
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


async function checkService(){
    console.log('checking service');
    let products = await exchagneService.getProducts();
    // console.log(products);
    let product = await exchagneService.getProduct("BTCUSD");
    //  console.log(product);

    let assets = await exchagneService.getAssets();
    // console.log(assets);

    let orderbook = await exchagneService.getOrderBook("BTCUSD");
    console.log(orderbook);

    let balance = await exchagneService.getWalletBalances();
    console.log("balance:",balance.result[0].available_balance_for_robo);

    let orders = await exchagneService.getOrders();
    console.log("orders:",orders.result);
    // let orderMarket = await exchagneService.placeOrder("BTCUSD", "sell", 1, 10000, "market_order");
    // let stoploss = await exchagneService.bracketOrder(orderMarket.result, 82940, 0);
    // console.log("stoploss:",stoploss.result);

    let positions = await exchagneService.getMarginedPositions();
    console.log("positions:",positions.result);

    
    // let orderLimit = await exchagneService.placeOrder("BTCUSD", "sell", 1, 10000, "limit_order");
    // let orderLimit = await exchagneService.placeOrder("BTCUSD", "sell", 1, 10000, "limit_order");
    // console.log("order:",orderMarket);

    // let cancle = await exchagneService.cancelOrder(orders.result[0]);
    // console.log(cancle);

}
// checkService();