require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");
const config = require("../../config/index");
const BASE_URL = config.EXCHANGE_API;
const API_KEY = process.env.DELTA_API_KEY;
const API_SECRET = process.env.DELTA_API_SECRET;

/**
 * Generate HMAC SHA256 signature
 * @param {string} secret - API secret key
 * @param {string} message - String to sign
 * @returns {string} - HMAC SHA256 signature
 */
function generateSignature(secret, message) {
    return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Make an authenticated API request to Delta Exchange
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @param {object} query - Query parameters
 * @param {object} body - Request body
 */
async function sendRequest(method, path, query = {}, body = {}) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const queryString = new URLSearchParams(query).toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;
    const payload = method === "GET" ? "" : JSON.stringify(body);
    // Create signature string
    const signatureData = method + timestamp + "/v2"+fullPath + payload;
    const signature = generateSignature(API_SECRET, signatureData);

    // Set request headers
    const headers = {
        "api-key": API_KEY,
        "timestamp": timestamp,
        "signature": signature,
        "User-Agent": "node-rest-client",
        "Content-Type": "application/json",
    };

    try {
        const response = await axios({
            method,
            url: `${BASE_URL}${fullPath}`,
            headers,
            data: method === "GET" ? undefined : body,
            params: method === "GET" ? query : undefined,
            timeout: 30000, // 30s timeout
        });

        return response.data;
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

module.exports = { sendRequest };
