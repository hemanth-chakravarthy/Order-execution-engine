export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper'
}

export enum DEX {
  RAYDIUM = 'raydium',
  METEORA = 'meteora'
}

export interface Order {
  orderId: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  status: OrderStatus;
  dex?: DEX;
  executedPrice?: number;
  txHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
}

export interface DexQuote {
  dex: DEX;
  price: number;
  fee: number;
  estimatedOutput: number;
}

export interface ExecutionResult {
  txHash: string;
  executedPrice: number;
  amountOut: number;
  dex: DEX;
}

export interface WebSocketMessage {
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  data?: {
    dex?: DEX;
    price?: number;
    txHash?: string;
    error?: string;
  };
}