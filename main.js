
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
// function main(){
//     telegramService.getTradeSignalMessage("smart","BTCUSD","32343","2343234","<b>234234<b>");
// }

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
                if(candle?.time==prevTrade?.time){
                    prevTrade = null;
                } 
            } 

            let candletimestamp = candle.time;
            
            if(lastCandleTimestamp === 0){
                lastCandleTimestamp = candle.time;
            }
            else if(candletimestamp > lastCandleTimestamp){
                lastCandleTimestamp = candletimestamp;
                console.log('New Candle Detected');
                console.log('Signal:', candle);
                
                if(prevCandle!=null && prevTrade!=null && Number(prevCandle.supertrend)!=Number(candle.supertrend)&& candle.exit_signal==null && candle.bullish===null){
                    await telegramService.getTrailingStopMessage(config.SYMBOL,Number(candle.supertrend).toFixed(2),`Profit: ${candle.profit}%`);
                }

                if(candle.exit_signal && prevTrade!=null) {
                    await telegramService.getExitNotificationMessage(config.SYMBOL,candle.close, candle.profit,"exit");
                    prevTrade =null;
                }

                if(candle.bullish==true){
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
    },  1000);
}

main();