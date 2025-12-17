from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import asyncio
import httpx
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'alphamind_secret_key')
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

app = FastAPI(title="AlphaMind Trading API")
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class SignalCreate(BaseModel):
    symbol: str
    direction: str  # BUY/SELL
    entry_price: float
    stop_loss: float
    take_profit_1: float
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None
    confidence: float
    strategy: str
    analysis: Optional[str] = None

class TradeCreate(BaseModel):
    signal_id: str
    symbol: str
    direction: str
    entry_price: float
    quantity: float
    stop_loss: float
    take_profit: float

class BotConfig(BaseModel):
    enabled: bool
    risk_per_trade: float = 0.02
    max_daily_trades: int = 10
    allowed_markets: List[str] = ["crypto", "forex", "stocks"]
    strategies: List[str] = ["ICT", "SMC", "WYCKOFF"]
    auto_execute: bool = False

class AIAnalysisRequest(BaseModel):
    symbol: str
    timeframe: str = "1h"
    market_type: str = "crypto"

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name or data.email.split("@")[0],
        "balance": 10000.0,
        "pnl": 0.0,
        "total_trades": 0,
        "winning_trades": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {k: v for k, v in user.items() if k not in ["password", "_id"]}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {k: v for k, v in user.items() if k not in ["password", "_id"]}}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password"}

# ==================== MARKET DATA ====================

CRYPTO_SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "ADA/USD", "DOGE/USD", "AVAX/USD", "DOT/USD"]
FOREX_SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD"]
INDICES_SYMBOLS = ["US30", "US100", "US500", "GER40", "UK100", "FRA40", "JPN225"]
METALS_SYMBOLS = ["XAU/USD", "XAG/USD", "XPT/USD", "XPD/USD"]

async def fetch_crypto_prices():
    """Fetch crypto prices from CoinGecko API"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": "bitcoin,ethereum,solana,ripple,cardano,dogecoin,avalanche-2,polkadot",
                    "vs_currencies": "usd",
                    "include_24hr_change": "true",
                    "include_24hr_vol": "true"
                },
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                mapping = {
                    "bitcoin": "BTC/USD", "ethereum": "ETH/USD", "solana": "SOL/USD",
                    "ripple": "XRP/USD", "cardano": "ADA/USD", "dogecoin": "DOGE/USD",
                    "avalanche-2": "AVAX/USD", "polkadot": "DOT/USD"
                }
                result = {}
                for coin_id, symbol in mapping.items():
                    if coin_id in data:
                        result[symbol] = {
                            "price": data[coin_id].get("usd", 0),
                            "change_24h": data[coin_id].get("usd_24h_change", 0),
                            "volume_24h": data[coin_id].get("usd_24h_vol", 0)
                        }
                return result
    except Exception as e:
        logging.error(f"Crypto fetch error: {e}")
    return {}

async def fetch_forex_prices():
    """Simulated forex data - in production use real API"""
    import random
    base_prices = {
        "EUR/USD": 1.0850, "GBP/USD": 1.2650, "USD/JPY": 149.50,
        "USD/CHF": 0.8850, "AUD/USD": 0.6550, "USD/CAD": 1.3650, "NZD/USD": 0.6150
    }
    result = {}
    for symbol, base in base_prices.items():
        change = random.uniform(-0.5, 0.5)
        result[symbol] = {
            "price": round(base * (1 + change/100), 5),
            "change_24h": round(change, 2),
            "volume_24h": random.randint(1000000, 5000000)
        }
    return result

async def fetch_indices_prices():
    """Simulated indices data"""
    import random
    base_prices = {
        "US30": 43250.00, "US100": 21450.00, "US500": 5950.00, 
        "GER40": 20150.00, "UK100": 8250.00, "FRA40": 7850.00, "JPN225": 38500.00
    }
    result = {}
    for symbol, base in base_prices.items():
        change = random.uniform(-1.5, 1.5)
        result[symbol] = {
            "price": round(base * (1 + change/100), 2),
            "change_24h": round(change, 2),
            "volume_24h": random.randint(50000000, 200000000)
        }
    return result

async def fetch_metals_prices():
    """Simulated metals data - XAU=Gold, XAG=Silver, XPT=Platinum, XPD=Palladium"""
    import random
    base_prices = {
        "XAU/USD": 2650.50, "XAG/USD": 31.25, "XPT/USD": 985.00, "XPD/USD": 1025.00
    }
    result = {}
    for symbol, base in base_prices.items():
        change = random.uniform(-1, 1)
        result[symbol] = {
            "price": round(base * (1 + change/100), 2),
            "change_24h": round(change, 2),
            "volume_24h": random.randint(5000000, 20000000)
        }
    return result

@api_router.get("/markets")
async def get_markets(user: dict = Depends(get_current_user)):
    crypto = await fetch_crypto_prices()
    forex = await fetch_forex_prices()
    stocks = await fetch_stock_prices()
    
    markets = []
    for symbol, data in crypto.items():
        markets.append({"symbol": symbol, "type": "crypto", **data})
    for symbol, data in forex.items():
        markets.append({"symbol": symbol, "type": "forex", **data})
    for symbol, data in stocks.items():
        markets.append({"symbol": symbol, "type": "stocks", **data})
    
    return {"markets": markets, "updated_at": datetime.now(timezone.utc).isoformat()}

@api_router.get("/markets/{symbol:path}")
async def get_market_detail(symbol: str, user: dict = Depends(get_current_user)):
    """Get detailed market data with historical prices"""
    import random
    
    # Generate mock historical data
    now = datetime.now(timezone.utc)
    history = []
    base_price = 100.0
    
    if "BTC" in symbol:
        base_price = 67500
    elif "ETH" in symbol:
        base_price = 3650
    elif "EUR" in symbol:
        base_price = 1.085
    elif "AAPL" in symbol:
        base_price = 195
    
    for i in range(100):
        timestamp = now - timedelta(hours=i)
        change = random.uniform(-0.5, 0.5)
        price = base_price * (1 + change/100)
        history.append({
            "timestamp": timestamp.isoformat(),
            "open": round(price * 0.999, 4),
            "high": round(price * 1.002, 4),
            "low": round(price * 0.998, 4),
            "close": round(price, 4),
            "volume": random.randint(1000, 10000)
        })
        base_price = price
    
    return {
        "symbol": symbol,
        "current_price": history[0]["close"],
        "change_24h": round(random.uniform(-3, 3), 2),
        "history": list(reversed(history))
    }

# ==================== AI ANALYSIS ====================

async def analyze_with_claude(symbol: str, market_data: dict) -> dict:
    """Use Claude Sonnet 4 for advanced market analysis"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"error": "No API key configured"}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"analysis_{symbol}_{datetime.now().timestamp()}",
            system_message="""Tu es AlphaMind, un expert en analyse technique et trading. 
Tu analyses les marchés en utilisant les méthodologies ICT (Inner Circle Trader), SMC (Smart Money Concepts) et Wyckoff.
Fournis des analyses précises avec des niveaux d'entrée, stop loss et take profit.
Réponds toujours en JSON structuré."""
        ).with_model("anthropic", "claude-4-sonnet-20250514")
        
        prompt = f"""Analyse le marché {symbol} avec les données suivantes:
- Prix actuel: {market_data.get('price', 'N/A')}
- Variation 24h: {market_data.get('change_24h', 'N/A')}%
- Volume 24h: {market_data.get('volume_24h', 'N/A')}

Fournis ton analyse en JSON avec cette structure:
{{
    "signal": "BUY" ou "SELL" ou "NEUTRAL",
    "confidence": 0-100,
    "entry_price": number,
    "stop_loss": number,
    "take_profit_1": number,
    "take_profit_2": number,
    "take_profit_3": number,
    "analysis": {{
        "ict": "analyse ICT détaillée",
        "smc": "analyse SMC détaillée", 
        "wyckoff": "analyse Wyckoff détaillée",
        "trend": "up/down/sideways",
        "key_levels": [niveaux clés]
    }},
    "reasoning": "explication du signal"
}}"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        try:
            # Extract JSON from response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0]
            else:
                json_str = response
            
            analysis = json.loads(json_str.strip())
            return analysis
        except:
            return {
                "signal": "NEUTRAL",
                "confidence": 50,
                "reasoning": response,
                "analysis": {"raw": response}
            }
            
    except Exception as e:
        logging.error(f"Claude analysis error: {e}")
        return {"error": str(e)}

@api_router.post("/ai/analyze")
async def ai_analyze(request: AIAnalysisRequest, user: dict = Depends(get_current_user)):
    """Get AI-powered market analysis using Claude Sonnet 4"""
    
    # Fetch current market data
    if request.market_type == "crypto":
        prices = await fetch_crypto_prices()
    elif request.market_type == "forex":
        prices = await fetch_forex_prices()
    else:
        prices = await fetch_stock_prices()
    
    market_data = prices.get(request.symbol, {})
    if not market_data:
        market_data = {"price": 0, "change_24h": 0, "volume_24h": 0}
    
    analysis = await analyze_with_claude(request.symbol, market_data)
    
    # Save analysis to database
    analysis_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "symbol": request.symbol,
        "timeframe": request.timeframe,
        "market_type": request.market_type,
        "analysis": analysis,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.analyses.insert_one(analysis_doc)
    
    return {"symbol": request.symbol, "analysis": analysis, "timestamp": analysis_doc["created_at"]}

# ==================== SIGNALS ====================

@api_router.get("/signals")
async def get_signals(user: dict = Depends(get_current_user)):
    """Get active trading signals"""
    signals = await db.signals.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"signals": signals}

@api_router.post("/signals")
async def create_signal(signal: SignalCreate, user: dict = Depends(get_current_user)):
    """Create a new trading signal"""
    signal_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        **signal.model_dump(),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.signals.insert_one(signal_doc)
    return {k: v for k, v in signal_doc.items() if k != "_id"}

@api_router.post("/signals/generate")
async def generate_signals(user: dict = Depends(get_current_user)):
    """Generate AI signals for all markets"""
    signals = []
    
    # Analyze top crypto pairs
    for symbol in ["BTC/USD", "ETH/USD", "SOL/USD"]:
        prices = await fetch_crypto_prices()
        market_data = prices.get(symbol, {})
        analysis = await analyze_with_claude(symbol, market_data)
        
        if analysis.get("signal") in ["BUY", "SELL"]:
            signal_doc = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "symbol": symbol,
                "direction": analysis.get("signal"),
                "entry_price": analysis.get("entry_price", market_data.get("price", 0)),
                "stop_loss": analysis.get("stop_loss", 0),
                "take_profit_1": analysis.get("take_profit_1", 0),
                "take_profit_2": analysis.get("take_profit_2"),
                "take_profit_3": analysis.get("take_profit_3"),
                "confidence": analysis.get("confidence", 50),
                "strategy": "AI_MULTI",
                "analysis": analysis.get("reasoning", ""),
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.signals.insert_one(signal_doc)
            signals.append({k: v for k, v in signal_doc.items() if k != "_id"})
    
    return {"signals": signals, "count": len(signals)}

# ==================== TRADES ====================

@api_router.get("/trades")
async def get_trades(user: dict = Depends(get_current_user)):
    """Get user's trades"""
    trades = await db.trades.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"trades": trades}

@api_router.post("/trades")
async def create_trade(trade: TradeCreate, user: dict = Depends(get_current_user)):
    """Execute a trade (semi-automatic mode)"""
    trade_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        **trade.model_dump(),
        "status": "open",
        "pnl": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trades.insert_one(trade_doc)
    
    # Update user stats
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"total_trades": 1}}
    )
    
    return {k: v for k, v in trade_doc.items() if k != "_id"}

@api_router.post("/trades/{trade_id}/close")
async def close_trade(trade_id: str, exit_price: float, user: dict = Depends(get_current_user)):
    """Close a trade"""
    trade = await db.trades.find_one({"id": trade_id, "user_id": user["id"]})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Calculate PnL
    if trade["direction"] == "BUY":
        pnl = (exit_price - trade["entry_price"]) * trade["quantity"]
    else:
        pnl = (trade["entry_price"] - exit_price) * trade["quantity"]
    
    # Update trade
    await db.trades.update_one(
        {"id": trade_id},
        {
            "$set": {
                "status": "closed",
                "exit_price": exit_price,
                "pnl": pnl,
                "closed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update user stats
    update = {"$inc": {"pnl": pnl, "balance": pnl}}
    if pnl > 0:
        update["$inc"]["winning_trades"] = 1
    await db.users.update_one({"id": user["id"]}, update)
    
    return {"trade_id": trade_id, "pnl": pnl, "status": "closed"}

# ==================== PORTFOLIO ====================

@api_router.get("/portfolio")
async def get_portfolio(user: dict = Depends(get_current_user)):
    """Get user's portfolio summary"""
    trades = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    
    open_trades = [t for t in trades if t["status"] == "open"]
    closed_trades = [t for t in trades if t["status"] == "closed"]
    
    total_pnl = sum(t.get("pnl", 0) for t in closed_trades)
    win_rate = 0
    if closed_trades:
        winners = len([t for t in closed_trades if t.get("pnl", 0) > 0])
        win_rate = (winners / len(closed_trades)) * 100
    
    return {
        "balance": user.get("balance", 10000),
        "total_pnl": total_pnl,
        "win_rate": round(win_rate, 2),
        "total_trades": len(trades),
        "open_trades": len(open_trades),
        "closed_trades": len(closed_trades),
        "open_positions": open_trades
    }

# ==================== BOT CONFIGURATION ====================

@api_router.get("/bot/config")
async def get_bot_config(user: dict = Depends(get_current_user)):
    """Get bot configuration"""
    config = await db.bot_configs.find_one({"user_id": user["id"]}, {"_id": 0})
    if not config:
        config = {
            "user_id": user["id"],
            "enabled": False,
            "risk_per_trade": 0.02,
            "max_daily_trades": 10,
            "allowed_markets": ["crypto", "forex", "stocks"],
            "strategies": ["ICT", "SMC", "WYCKOFF"],
            "auto_execute": False
        }
        await db.bot_configs.insert_one({**config, "_id": None})
    return {k: v for k, v in config.items() if k != "_id"}

@api_router.post("/bot/config")
async def update_bot_config(config: BotConfig, user: dict = Depends(get_current_user)):
    """Update bot configuration"""
    await db.bot_configs.update_one(
        {"user_id": user["id"]},
        {"$set": config.model_dump()},
        upsert=True
    )
    return {"message": "Configuration updated", "config": config.model_dump()}

# ==================== WATCHLIST ====================

@api_router.get("/watchlist")
async def get_watchlist(user: dict = Depends(get_current_user)):
    """Get user's watchlist"""
    watchlist = await db.watchlists.find_one({"user_id": user["id"]}, {"_id": 0})
    if not watchlist:
        watchlist = {"user_id": user["id"], "symbols": ["BTC/USD", "ETH/USD", "EUR/USD"]}
        await db.watchlists.insert_one({**watchlist, "_id": None})
    return {k: v for k, v in watchlist.items() if k != "_id"}

@api_router.post("/watchlist/add")
async def add_to_watchlist(symbol: str, user: dict = Depends(get_current_user)):
    """Add symbol to watchlist"""
    await db.watchlists.update_one(
        {"user_id": user["id"]},
        {"$addToSet": {"symbols": symbol}},
        upsert=True
    )
    return {"message": f"{symbol} added to watchlist"}

@api_router.post("/watchlist/remove")
async def remove_from_watchlist(symbol: str, user: dict = Depends(get_current_user)):
    """Remove symbol from watchlist"""
    await db.watchlists.update_one(
        {"user_id": user["id"]},
        {"$pull": {"symbols": symbol}}
    )
    return {"message": f"{symbol} removed from watchlist"}

# ==================== WEBSOCKET ====================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws/market")
async def websocket_market(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Send market updates every 5 seconds
            crypto = await fetch_crypto_prices()
            forex = await fetch_forex_prices()
            stocks = await fetch_stock_prices()
            
            await websocket.send_json({
                "type": "market_update",
                "data": {
                    "crypto": crypto,
                    "forex": forex,
                    "stocks": stocks
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ==================== MAIN ====================

@api_router.get("/")
async def root():
    return {"message": "AlphaMind Trading API v1.0", "status": "online"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
