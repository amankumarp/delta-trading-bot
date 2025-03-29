require("dotenv").config();
const dev = require("./development.js");
const production = require("./production.js");
const prod = require("./production.js");
const {
    DELTA_API_KEY,
    DELTA_API_SECRET,
    NODE_ENV,
    TELEGRAM_BOT_TOKEN,
    CHAT_ID,
    } = process.env;
let config =  NODE_ENV === "production" ? prod : dev;

config = {
    ...config,
    apiKey: DELTA_API_KEY,
    apiSecret:DELTA_API_SECRET,
    botToken:TELEGRAM_BOT_TOKEN,
    chatId:CHAT_ID
}

module.exports = config;