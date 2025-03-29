const logger = require('../services/logging/logger');

describe('Logger Service', () => {
    it('should log an info message', () => {
        logger.info('This is an info message');
    });

    it('should log a warning message', () => {
        logger.warn('This is a warning message');
    });

    it('should log an error message', () => {
        logger.error('This is an error message');
    });
});