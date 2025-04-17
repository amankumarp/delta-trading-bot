const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PaperTrade {
    constructor({ initialBalance = 10000, leverage = 1, mode = 'futures' }) {
        this.balance = initialBalance;
        this.leverage = leverage;
        this.mode = mode;
        this.positions = []; // multiple open trades allowed
    }

    async openPosition({ symbol, price, size, isLong, sl, tp }) {
        const position = await prisma.trade.create({
            data: {
                symbol,
                isLong,
                entryPrice: price,
                positionSize: size,
                status: 'open',
                entryTime: new Date(),
                stopLoss: sl,
                takeProfit: tp
            }
        });
        this.positions.push(position);
        return position;
    }

    async closePosition(positionId, exitPrice) {
        const position = await prisma.trade.findUnique({ where: { id: positionId } });
        if (!position || position.status === 'closed') return null;

        const pnl = position.isLong
            ? (exitPrice - position.entryPrice) * position.positionSize
            : (position.entryPrice - exitPrice) * position.positionSize;

        this.balance += pnl;

        const updated = await prisma.trade.update({
            where: { id: positionId },
            data: {
                exitPrice,
                pnl,
                status: 'closed',
                exitTime: new Date()
            }
        });

        this.positions = this.positions.filter(p => p.id !== positionId);
        return updated;
    }

    async partialExit(positionId, exitPrice) {
        const position = await prisma.trade.findUnique({ where: { id: positionId } });
        if (!position || position.status !== 'open') return null;

        const halfSize = position.positionSize / 2;
        const pnl = position.isLong
            ? (exitPrice - position.entryPrice) * halfSize
            : (position.entryPrice - exitPrice) * halfSize;

        this.balance += pnl;

        await prisma.trade.update({
            where: { id: positionId },
            data: {
                positionSize: halfSize,
                updatedAt: new Date()
            }
        });

        return { pnl, newSize: halfSize };
    }

    async handlePriceUpdate(symbol, currentPrice) {
        const openPositions = await prisma.trade.findMany({
            where: {
                symbol,
                status: 'open'
            }
        });

        for (const pos of openPositions) {
            const hitSL = pos.isLong ? currentPrice <= pos.stopLoss : currentPrice >= pos.stopLoss;
            const hitTP = pos.isLong ? currentPrice >= pos.takeProfit : currentPrice <= pos.takeProfit;

            if (hitSL || hitTP) {
                await this.closePosition(pos.id, currentPrice);
            }
        }
    }

    getBalance() {
        return this.balance;
    }

    async getOpenPositions() {
        return await prisma.trade.findMany({ where: { status: 'open' } });
    }

    // New: Add a strategy
    async addStrategy({ userId, strategyId, initialBalance }) {
        const user = await prisma.user.findUnique({ where: { userId } });
        if (!user) throw new Error('User not found');

        if (user.balance < initialBalance) throw new Error('Insufficient balance');

        await prisma.user.update({
            where: { userId },
            data: { balance: user.balance - initialBalance }
        });

        const strategy = await prisma.strategy.create({
            data: {
                userId,
                strategyId,
                initialBalance
            }
        });

        return strategy;
    }

    // New: Get all strategies for a user
    async getStrategies(userId) {
        return await prisma.strategy.findMany({ where: { userId } });
    }

    // New: Get trades for a specific strategy
    async getTradesForStrategy(strategyId) {
        return await prisma.trade.findMany({ where: { strategyId } });
    }

    // New: Close all positions for a strategy
    async closeAllPositionsForStrategy(strategyId, exitPrice) {
        const positions = await prisma.trade.findMany({
            where: { strategyId, status: 'open' }
        });

        const closedPositions = [];
        for (const pos of positions) {
            const closed = await this.closePosition(pos.id, exitPrice);
            closedPositions.push(closed);
        }

        return closedPositions;
    }
}

module.exports = PaperTrade;