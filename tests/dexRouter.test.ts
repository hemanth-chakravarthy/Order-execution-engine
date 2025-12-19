import { MockDexRouter } from '../src/services/dexRouter';
import { DEX } from '../src/types';

describe('MockDexRouter', () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter();
  });

  test('should return Raydium quote with correct structure', async () => {
    const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);
    
    expect(quote).toHaveProperty('dex', DEX.RAYDIUM);
    expect(quote).toHaveProperty('price');
    expect(quote).toHaveProperty('fee', 0.003);
    expect(quote).toHaveProperty('estimatedOutput');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.estimatedOutput).toBeGreaterThan(0);
  });

  test('should return Meteora quote with correct structure', async () => {
    const quote = await router.getMeteorQuote('SOL', 'USDC', 100);
    
    expect(quote).toHaveProperty('dex', DEX.METEORA);
    expect(quote).toHaveProperty('price');
    expect(quote).toHaveProperty('fee', 0.002);
    expect(quote).toHaveProperty('estimatedOutput');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.estimatedOutput).toBeGreaterThan(0);
  });

  test('should have different fees for Raydium and Meteora', async () => {
    const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', 100);
    const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', 100);
    
    expect(raydiumQuote.fee).toBe(0.003);
    expect(meteoraQuote.fee).toBe(0.002);
    expect(raydiumQuote.fee).toBeGreaterThan(meteoraQuote.fee);
  });

  test('should return best quote based on estimated output', async () => {
    const bestQuote = await router.getBestQuote('SOL', 'USDC', 100);
    
    expect(bestQuote).toHaveProperty('dex');
    expect(bestQuote).toHaveProperty('estimatedOutput');
    expect([DEX.RAYDIUM, DEX.METEORA]).toContain(bestQuote.dex);
  });

  test('should execute swap and return transaction result', async () => {
    const mockOrder = {
      orderId: 'test-123',
      type: 'market' as any,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100,
      status: 'pending' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0
    };

    const mockQuote = {
      dex: DEX.RAYDIUM,
      price: 0.1,
      fee: 0.003,
      estimatedOutput: 9.97
    };

    const result = await router.executeSwap(mockOrder, mockQuote);
    
    expect(result).toHaveProperty('txHash');
    expect(result).toHaveProperty('executedPrice');
    expect(result).toHaveProperty('amountOut');
    expect(result).toHaveProperty('dex', DEX.RAYDIUM);
    expect(result.txHash).toHaveLength(64);
    expect(result.executedPrice).toBeGreaterThan(0);
  });

  test('should simulate network delay for quotes', async () => {
    const startTime = Date.now();
    await router.getRaydiumQuote('SOL', 'USDC', 100);
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeGreaterThanOrEqual(200);
  });

  test('should simulate execution delay for swaps', async () => {
    const mockOrder = {
      orderId: 'test-123',
      type: 'market' as any,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100,
      status: 'pending' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0
    };

    const mockQuote = {
      dex: DEX.RAYDIUM,
      price: 0.1,
      fee: 0.003,
      estimatedOutput: 9.97
    };

    const startTime = Date.now();
    await router.executeSwap(mockOrder, mockQuote);
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeGreaterThanOrEqual(2000);
  });
});