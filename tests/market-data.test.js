const request = require('supertest');
const express = require('express');
const app = express();
const axios = require('axios');

// Mock logger to avoid actual logging during tests
jest.mock('../services/logging/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

// Mock axios for API calls
jest.mock('axios');

// Import the router
const marketDataRouter = require('../services/market-data/index');

// Attach the routes to the app
app.use('/', marketDataRouter);

// Test cases for /ohlcv endpoint
describe('GET /ohlcv', () => {
    it('should return OHLCV data for a valid request', async () => {
        const mockResponse = {
            data: {
                result: [
                    { time: 1685618835, open: 47000, high: 47100, low: 46900, close: 47050, volume: 120.5 },
                ],
            },
        };

        axios.get.mockResolvedValue(mockResponse);

        const response = await request(app).get('/ohlcv').query({
            symbol: 'BTCUSD',
            interval: '5m',
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockResponse.data.result);
    });

    it('should return 400 if required query parameters are missing', async () => {
        const response = await request(app).get('/ohlcv');
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Missing required query parameters: symbol, interval' });
    });

    it('should return 500 if the API call fails', async () => {
        axios.get.mockRejectedValue(new Error('API error'));

        const response = await request(app).get('/ohlcv').query({
            symbol: 'BTCUSD',
            interval: '5m',
        });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch OHLCV data' });
    });
});

// Test cases for /symbols endpoint
describe('GET /symbols', () => {
    it('should return a list of futures symbols', async () => {
        const mockResponse = {
            data: {
                result: [
                    { symbol: 'BTCUSD', contract_type: 'perpetual_futures' },
                    { symbol: 'ETHUSD', contract_type: 'perpetual_futures' },
                ],
            },
        };

        axios.get.mockResolvedValue(mockResponse);

        const response = await request(app).get('/symbols');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(['BTCUSD', 'ETHUSD']);
    });

    it('should return 500 if the API call fails', async () => {
        axios.get.mockRejectedValue(new Error('API error'));

        const response = await request(app).get('/symbols');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch futures symbols' });
    });
});

// Test cases for /symbol-info endpoint
describe('GET /symbol-info', () => {
    it('should return detailed information about a symbol', async () => {
        const mockResponse = {
            data: {
                result: {
                    symbol: 'BTCUSD',
                    description: 'Bitcoin perpetual futures',
                    tick_size: 0.5,
                    contract_type: 'perpetual_futures',
                    state: 'active',
                    underlying_asset: { symbol: 'BTC' },
                    initial_margin: 0.05,
                    maintenance_margin: 0.025,
                    max_leverage: 100,
                    maker_commission_rate: 0.0002,
                    taker_commission_rate: 0.0005,
                },
            },
        };

        axios.get.mockResolvedValue(mockResponse);

        const response = await request(app).get('/symbol-info').query({ symbol: 'BTCUSD' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            symbol: 'BTCUSD',
            description: 'Bitcoin perpetual futures',
            tick_size: 0.5,
            contract_type: 'perpetual_futures',
            trading_status: 'active',
            underlying_asset: 'BTC',
            initial_margin: 0.05,
            maintenance_margin: 0.025,
            max_leverage: 100,
            maker_fee: 0.0002,
            taker_fee: 0.0005,
        });
    });

    it('should return 400 if the symbol query parameter is missing', async () => {
        const response = await request(app).get('/symbol-info');
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Missing required query parameter: symbol' });
    });

    it('should return 404 if the symbol is not found', async () => {
        axios.get.mockRejectedValue({ response: { status: 404 } });

        const response = await request(app).get('/symbol-info').query({ symbol: 'INVALID' });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Symbol not found: INVALID' });
    });

    it('should return 500 if the API call fails', async () => {
        axios.get.mockRejectedValue(new Error('API error'));

        const response = await request(app).get('/symbol-info').query({ symbol: 'BTCUSD' });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch symbol info' });
    });
});