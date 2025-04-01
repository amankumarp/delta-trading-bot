const ExchangeService = require('../services/order-execution/ExchangeService');
const { sendRequest } = require('../services/order-execution/deltaExchange');
const logger = require('../logging/logger');

jest.mock('../services/order-execution/deltaExchange');
jest.mock('../logging/logger');

describe('ExchangeService', () => {
    let exchangeService;
    beforeEach(() => {
        exchangeService = new ExchangeService();
        jest.clearAllMocks();
    });

    test('should fetch OHLCV data', async () => {
        sendRequest.mockResolvedValue({ result: [{ time: 123456789, open: 100, close: 110 }] });
        const candles = await exchangeService.getCandles('BTCUSD', '1m', 1620000000, 1620000600);
        expect(candles).toEqual([{ time: 123456789, open: 100, close: 110 }]);
        expect(sendRequest).toHaveBeenCalledWith('GET', '/history/candles', expect.any(Object));
    });

    test('should fetch product details', async () => {
        sendRequest.mockResolvedValue({ result: { symbol: 'BTCUSD', name: 'Bitcoin' } });
        const product = await exchangeService.getProduct('BTCUSD');
        expect(product).toEqual({ symbol: 'BTCUSD', name: 'Bitcoin' });
        expect(sendRequest).toHaveBeenCalledWith('GET', '/products/BTCUSD');
    });

    test('should place an order', async () => {
        sendRequest.mockResolvedValue({ result: { order_id: '1234' } });
        const order = await exchangeService.placeOrder('BTCUSD', 'buy', 1, 50000, 'limit_order');
        expect(order).toEqual({ order_id: '1234' });
        expect(sendRequest).toHaveBeenCalledWith('POST', '/orders', {}, expect.any(Object));
    });

    test('should cancel an order', async () => {
        sendRequest.mockResolvedValue({ status: 200 });
        await expect(exchangeService.cancelOrder('1234')).resolves.toBeUndefined();
        expect(sendRequest).toHaveBeenCalledWith('DELETE', '/orders/1234', {});
    });

    test('should throw an error if fetching products fails', async () => {
        sendRequest.mockRejectedValue(new Error('Network Error'));
        await expect(exchangeService.getProducts()).rejects.toThrow('Failed to fetch products');
        expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/Error fetching products/));
    });
});
