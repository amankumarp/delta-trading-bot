const WebSocket = require("ws");
const {  SYMBOL, } = require("../../config/index");

const WEBSOCKET_URL ="wss://socket.india.delta.exchange";

class WebSocketService {
    constructor() {
        this.ws = new WebSocket(WEBSOCKET_URL);
        this.ws.on("open", this.subscribeToMarketData.bind(this));
        this.ws.on("message", this.handleMessage.bind(this));
        this.ws.on("error", (err) => console.error("WebSocket Error:", err));
        this.ws.on("close", () => console.log("WebSocket Disconnected"));
    }

    subscribeToMarketData() {
        console.log("Connected to Delta Exchange WebSocket");

        // SYMBOLS.forEach((symbol) => {
            this.ws.send(
                JSON.stringify({
                    type: "subscribe",
                    payload: {
                        channels: [`tickers:${SYMBOL}`]
                    },
                })
            );
        // });
    }

    async handleMessage(data) {
        const message = JSON.parse(data);
        if (message.type === "ticker") {
            console.log("Live Price Update:", message.payload);

            // Send real-time market data to Communicator Service
            // await axios.post(`${COMMUNICATOR_URL}/market/update`, { 
            //     symbol: message.payload.symbol,
            //     price: message.payload.price,
            //     timestamp: Date.now()
            // }).catch(err => console.error("Error sending data to Communicator:", err));
        }
    }
}

module.exports = new WebSocketService();
