# Order Execution Engine

A high-performance order execution engine for DEX trading with intelligent routing, real-time WebSocket updates, and concurrent order processing.

## 🚀 Live Demo

- **Live API**: [https://order-execution-engine-production-2c02.up.railway.app/)](https://order-execution-engine-production-2c02.up.railway.app/)
- **Demo Video**: https://youtu.be/YOUR_VIDEO_ID (Will be updated after recording)
---

## 🎯 Overview

This order execution engine processes **Market Orders** with intelligent DEX routing between Raydium and Meteora. The system compares quotes from both DEXs and automatically routes to the best price, providing real-time status updates via WebSocket.

### Why Market Orders?

Market orders were chosen for implementation because they:
- Execute immediately at current market price
- Are the most common order type in trading
- Demonstrate core routing and execution logic effectively
- Provide clear, predictable behavior for testing

### Extensibility to Other Order Types

The architecture is designed to easily support **Limit Orders** and **Sniper Orders**:

**Limit Orders**: Add a price monitoring service that checks if market price reaches target price, then triggers the existing execution flow.

**Sniper Orders**: Implement a token launch detector that monitors for new token events/migrations, then immediately executes using the existing routing logic.

Both would reuse the current DEX routing, queue management, and WebSocket infrastructure.

---

## ✨ Features

### Core Functionality
- ✅ Market order execution with immediate settlement
- ✅ Intelligent DEX routing (Raydium vs Meteora)
- ✅ Real-time WebSocket status updates
- ✅ Concurrent processing (10 orders simultaneously)
- ✅ Exponential backoff retry (up to 3 attempts)
- ✅ Complete order lifecycle tracking

### Technical Features
- ✅ HTTP → WebSocket upgrade pattern
- ✅ Queue-based order management with BullMQ
- ✅ PostgreSQL for order history persistence
- ✅ Redis for active order state
- ✅ Mock DEX implementation with realistic delays
- ✅ Comprehensive error handling and logging

---

## 🏗️ Architecture

### System Flow

```
Client Request (POST /api/orders/execute)
    ↓
API validates order → Returns orderId
    ↓
Order added to BullMQ Queue
    ↓
Worker picks up order (10 concurrent workers)
    ↓
Status: PENDING → WebSocket update
    ↓
Status: ROUTING → Query Raydium & Meteora
    ↓
Compare quotes → Select best DEX
    ↓
Status: BUILDING → Build transaction
    ↓
Status: SUBMITTED → Execute swap
    ↓
Status: CONFIRMED → Return txHash
    ↓
Persist to PostgreSQL
```

### Order Status Lifecycle

1. **PENDING** - Order received and queued
2. **ROUTING** - Comparing DEX prices (Raydium vs Meteora)
3. **BUILDING** - Creating transaction on chosen DEX
4. **SUBMITTED** - Transaction sent to network
5. **CONFIRMED** - Transaction successful (includes txHash)
6. **FAILED** - Execution failed (includes error message)

### Component Architecture

```
┌─────────────────┐
│   Fastify API   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│ Queue │ │WebSocket│
│Manager│ │ Manager │
└───┬───┘ └─────────┘
    │
┌───▼──────────┐
│ BullMQ Queue │
└───┬──────────┘
    │
┌───▼────────┐
│ 10 Workers │
└───┬────────┘
    │
┌───▼─────────┐
│ DEX Router  │
│  Raydium    │
│  Meteora    │
└─────────────┘
```

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **API Framework**: Fastify (WebSocket support)
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL
- **Testing**: Jest with 77% code coverage
- **Deployment**: Render (free tier)

---

## 📦 Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Redis 6+

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/order-execution-engine.git
cd order-execution-engine
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up PostgreSQL**

**Windows:**
```bash
# Create database
psql -U postgres -c "CREATE DATABASE order_execution;"
```

**macOS/Linux:**
```bash
createdb order_execution
```

4. **Set up Redis**

**Windows (Memurai):**
```bash
# Start Memurai service
net start memurai
# Verify
memurai-cli ping
```

**macOS:**
```bash
brew services start redis
redis-cli ping
```

**Linux:**
```bash
sudo systemctl start redis
redis-cli ping
```

5. **Configure environment**
```bash
# Create .env file
cp .env.example .env
```

Edit `.env` with your credentials:
```env
PORT=3000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# PostgreSQL
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/order_execution

# Mock DEX Settings
MOCK_NETWORK_DELAY_MS=200
MOCK_EXECUTION_DELAY_MS=2500
```

6. **Run the application**
```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

7. **Access the application**
- API: http://localhost:3000
- Test UI: http://localhost:3000 (opens the WebSocket test page)
- Health Check: http://localhost:3000/health

### Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch
```

**Test Results:**
- 19 tests passing
- 77% code coverage
- Tests cover: DEX routing, queue behavior, WebSocket lifecycle

---

## 📚 API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints

#### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-19T10:30:00.000Z"
}
```

---

#### 2. Submit Order
```http
POST /api/orders/execute
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "market",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 100
}
```

**Response (201):**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Order submitted. Connect to WebSocket for live updates.",
  "websocketUrl": "/api/orders/550e8400-e29b-41d4-a716-446655440000/ws"
}
```

**Error Response (400):**
```json
{
  "error": "Invalid order parameters"
}
```

---

#### 3. WebSocket Status Updates
```
WS /api/orders/:orderId/ws
```

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/550e8400-e29b-41d4-a716-446655440000/ws');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(update);
};
```

**Message Format:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "routing",
  "timestamp": "2025-12-19T10:30:01.500Z",
  "data": {
    "dex": "raydium",
    "price": 0.0987
  }
}
```

**Status Updates Sequence:**
1. `pending` - Order queued
2. `routing` - Comparing DEX prices
3. `building` - Building transaction (includes `dex` and `price`)
4. `submitted` - Transaction sent
5. `confirmed` - Success (includes `txHash`, `price`, `dex`)
6. `failed` - Error (includes `error` message)

---

#### 4. Get Order Details
```http
GET /api/orders/:orderId
```

**Response (200):**
```json
{
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "market",
  "token_in": "SOL",
  "token_out": "USDC",
  "amount_in": "100",
  "status": "confirmed",
  "dex": "raydium",
  "executed_price": "0.0987",
  "tx_hash": "abc123...",
  "created_at": "2025-12-19T10:30:00.000Z",
  "updated_at": "2025-12-19T10:30:03.500Z",
  "attempts": 1
}
```

---

#### 5. List All Orders
```http
GET /api/orders
```

**Response (200):**
```json
[
  {
    "order_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "market",
    "status": "confirmed",
    "created_at": "2025-12-19T10:30:00.000Z"
  },
  ...
]
```

---

#### 6. Queue Statistics
```http
GET /api/queue/stats
```

**Response (200):**
```json
{
  "waiting": 2,
  "active": 5,
  "completed": 150,
  "failed": 3
}
```

---

## 🎨 Design Decisions

### 1. Mock Implementation vs Real Devnet

**Decision**: Mock implementation with realistic delays

**Rationale**:
- Focus on architecture and system design
- Faster development and testing
- No dependency on external blockchain infrastructure
- Easier to demonstrate and reproduce results
- Production-ready architecture that can be swapped with real SDKs

**Mock Characteristics**:
- 200ms network delay for quote fetching
- 2-3 second execution delay
- 2-5% price variance between DEXs
- Realistic fee structures (0.3% Raydium, 0.2% Meteora)

### 2. Queue-Based Architecture

**Decision**: BullMQ with Redis for order processing

**Rationale**:
- **Concurrency**: Process 10 orders simultaneously
- **Reliability**: Automatic retry with exponential backoff
- **Scalability**: Can handle 100+ orders/minute
- **Persistence**: Failed orders are logged for analysis
- **Monitoring**: Real-time queue statistics

### 3. HTTP → WebSocket Pattern

**Decision**: Single endpoint for order submission + WebSocket upgrade

**Rationale**:
- **User Experience**: Immediate feedback via orderId
- **Real-time Updates**: Live progress without polling
- **Efficiency**: Single connection for entire order lifecycle
- **Clean API**: RESTful submission, streaming updates

### 4. Database Schema Design

**Decision**: PostgreSQL for order history, Redis for active state

**Rationale**:
- **PostgreSQL**: Persistent storage for auditing and analytics
- **Redis**: Fast access for active orders and queue state
- **Separation**: Historical data vs real-time data
- **Performance**: Optimal for both read and write patterns

### 5. Error Handling Strategy

**Decision**: Exponential backoff with 3 retry attempts

**Rationale**:
- **Resilience**: Temporary failures don't lose orders
- **Network Issues**: Handles transient connectivity problems
- **Rate Limiting**: Backoff prevents overwhelming the system
- **Transparency**: Failed orders are logged with reason

---

## 🧪 Testing

### Test Coverage

```
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
All files             |   77.77 |    95.45 |   73.07 |   77.08 |
 services             |   74.11 |    93.75 |   69.56 |   73.17 |
  dexRouter.ts        |     100 |    83.33 |     100 |     100 |
  orderQueue.ts       |   46.34 |      100 |      30 |   46.34 |
  websocketManager.ts |     100 |      100 |     100 |     100 |
----------------------|---------|----------|---------|---------|
```

### Test Suites

1. **DEX Router Tests** (7 tests)
   - Quote structure validation
   - Fee calculations
   - Best quote selection
   - Swap execution
   - Network delays

2. **Order Queue Tests** (3 tests)
   - Order submission
   - Queue statistics
   - Concurrent processing

3. **WebSocket Tests** (6 tests)
   - Connection management
   - Message delivery
   - Error handling
   - Multiple connections

4. **Integration Tests** (3 tests)
   - Order validation
   - End-to-end flow

---

## 📁 Project Structure

```
order-execution-engine/
├── src/
│   ├── config/
│   │   └── database.ts          # PostgreSQL setup
│   ├── services/
│   │   ├── dexRouter.ts         # Mock DEX routing logic
│   │   ├── orderQueue.ts        # BullMQ queue management
│   │   └── websocketManager.ts  # WebSocket connections
│   ├── routes/
│   │   └── orders.ts            # API endpoints
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   └── server.ts                # Fastify server setup
├── tests/
│   ├── dexRouter.test.ts
│   ├── orderQueue.test.ts
│   ├── websocket.test.ts
│   └── integration.test.ts
├── public/
│   └── index.html               # WebSocket test UI
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔧 Troubleshooting

### Common Issues

**Issue**: `Error: SASL authentication failed`
- **Solution**: Check PostgreSQL password in `.env`

**Issue**: `Redis connection refused`
- **Solution**: Ensure Redis is running: `redis-cli ping`

**Issue**: WebSocket not connecting
- **Solution**: Check CORS settings, ensure server is running

**Issue**: Tests hanging
- **Solution**: This is expected due to BullMQ workers, tests still pass

---

## 📝 License

MIT

---

## 👤 Author

**Hemanth Chakravarthy Kancharla**
- GitHub: [https://github.com/hemanth-chakravrthy/Order-Execution-Engine](https://github.com/hemanth-chakravarthy/Order-execution-engine)
- Email: khchakri@gmail.com

---



