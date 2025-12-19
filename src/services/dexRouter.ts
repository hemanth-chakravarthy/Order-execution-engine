import { DEX, DexQuote, ExecutionResult, Order } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockDexRouter {
  private networkDelay: number;
  private executionDelay: number;

  constructor() {
    this.networkDelay = parseInt(process.env.MOCK_NETWORK_DELAY_MS || '200');
    this.executionDelay = parseInt(process.env.MOCK_EXECUTION_DELAY_MS || '2500');
  }

  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    await sleep(this.networkDelay);
    
    const basePrice = 0.05 + Math.random() * 0.1;
    const price = basePrice * (0.98 + Math.random() * 0.04);
    const fee = 0.003;
    
    return {
      dex: DEX.RAYDIUM,
      price,
      fee,
      estimatedOutput: amount * price * (1 - fee)
    };
  }

  async getMeteorQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    await sleep(this.networkDelay);
    
    const basePrice = 0.05 + Math.random() * 0.1;
    const price = basePrice * (0.97 + Math.random() * 0.05);
    const fee = 0.002;
    
    return {
      dex: DEX.METEORA,
      price,
      fee,
      estimatedOutput: amount * price * (1 - fee)
    };
  }

  async getBestQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount)
    ]);

    console.log(`📊 Quote Comparison:
      Raydium: ${raydiumQuote.estimatedOutput.toFixed(6)} (fee: ${raydiumQuote.fee * 100}%)
      Meteora: ${meteoraQuote.estimatedOutput.toFixed(6)} (fee: ${meteoraQuote.fee * 100}%)`);

    return raydiumQuote.estimatedOutput > meteoraQuote.estimatedOutput 
      ? raydiumQuote 
      : meteoraQuote;
  }

  async executeSwap(order: Order, quote: DexQuote): Promise<ExecutionResult> {
    await sleep(this.executionDelay + Math.random() * 1000);
    
    const slippage = Math.random() * 0.01;
    const executedPrice = quote.price * (1 - slippage);
    
    return {
      txHash: this.generateMockTxHash(),
      executedPrice,
      amountOut: order.amountIn * executedPrice * (1 - quote.fee),
      dex: quote.dex
    };
  }

  private generateMockTxHash(): string {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }
}