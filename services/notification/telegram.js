const axios = require('axios');


class TelegramService {
    constructor(botToken, chatId) {
        this.botToken = botToken;
        this.chatId = chatId;
        this.apiUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    }

    async sendNotification(message) {
        try {
            const response = await axios.post(this.apiUrl, {
                chat_id: this.chatId,
                text: message,
                parse_mode: "markdown"
            });
            console.log('Notification sent:', response.data);
        } catch (error) {
            console.error('Error sending notification:', error.response?.data || error.message);
        }
    }

    // Function for trailing stop notification
    async getTrailingStopMessage(asset, newStopLoss, reason) {
        let message = `
🔄 *Trailing Stop Update!* 🔄
💰 *Asset*: ${asset}
📉 *New Stop Loss*: $${newStopLoss}
⚡ *Reason*: ${reason} 🚀

🛡️ Protecting those gains! 💪
        `;
        this.sendNotification(message);
    }

    // Function for partial exit notification
    async getPartialExitMessage(asset, exitPrice, quantitySold, remainingTarget) {
        let message = `
✂️ *Partial Exit!* ✂️
💸 *Asset*: ${asset}
📊 *Exit Price*: $${exitPrice}
📈 *Quantity Sold*: ${quantitySold}%
🎯 *Remaining Target*: $${remainingTarget}

💵 Locking in profits while we ride the rest! 🚀
        `;
        this.sendNotification(message);
    }

    // Function for exit notification
    async getExitNotificationMessage(asset, exitPrice, profit, status) {
        let profitMessage = `
✅ *Trade Closed!* ✅
💸 *Asset*: ${asset}
📊 *Exit Price*: $${exitPrice}
📈 *Profit*: ${profit}%
🎉 *Status*: ${status} 🎯

💪 Great job, team! Keep hustling! 🚀
        `;

        let lossMessage = `
❌ *Trade Closed!* ❌
💸 *Asset*: ${asset}
📉 *Exit Price*: $${exitPrice}
📉 *Loss*: ${profit}%
🛑 *Status*: ${status} 🚨

😔 Tough luck this time, but we’ll bounce back stronger! 💪
                `;
        this.sendNotification(Number(profit) > 0 ? profitMessage : lossMessage);
    }

    // Function for trade signal notification
    async getTradeSignalMessage(signal, asset, entryPrice, target, stopLoss) {
        let message = `
🚀 *Trade Alert!* 🚀
📈 *Signal*: ${signal}
💰 *Asset*: ${asset}
⚡ *Entry Price*: $${entryPrice}
🎯 *Target*: $${target}
🛡️ *Stop Loss*: $${stopLoss}

🔥 Let's ride the wave! 🌊
        `;
        this.sendNotification(message);
    }

    // Function for market alerts (Patterns/Indicators)
    async getMarketAlertMessage(asset, timeframe, alerts) {
        if (!alerts || alerts.length === 0) return;

        const alertList = alerts.map(a => `- ${a.message}`).join('\n');

        let message = `
🚨 *Market Alert* 🚨
💰 *Asset*: ${asset}
⏱️ *Timeframe*: ${timeframe}

🔍 *Detections*:
${alertList}

Stay analytical! 📊
        `;

        this.sendNotification(message);
    }
}




module.exports = TelegramService;