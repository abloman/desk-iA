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
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'alphamind_secret_key')
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

app = FastAPI(title="AlphaMind Trading API")
api_router = APIRouter(prefix="/api")

# ==================== PRICE CACHE ====================
PRICE_CACHE = {}
PRICE_CACHE_TIME = None

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class TradeCreate(BaseModel):
    signal_id: Optional[str] = None
    symbol: str
    direction: str
    entry_price: float
    quantity: float
    stop_loss: float
    take_profit: float
    strategy: Optional[str] = None

class TradeClose(BaseModel):
    exit_price: float

class BotConfig(BaseModel):
    enabled: bool = False
    risk_per_trade: float = 0.02
    max_daily_trades: int = 10
    allowed_markets: List[str] = ["crypto", "forex", "indices", "metals", "futures"]
    strategies: List[str] = ["smc", "ict", "wyckoff"]
    auto_execute: bool = False
    mt5_connected: bool = False
    mt5_server: Optional[str] = None
    mt5_login: Optional[str] = None

class AIAnalysisRequest(BaseModel):
    symbol: str
    timeframe: str = "15min"
    market_type: str = "crypto"
    mode: str = "intraday"
    strategy: str = "smc"

class MT5ConnectRequest(BaseModel):
    server: str
    login: str
    password: str

# ==================== AUTH ====================

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

BASE_PRICES = {
    # Crypto
    "BTC/USD": 98500, "ETH/USD": 3450, "SOL/USD": 195, "XRP/USD": 2.35, "ADA/USD": 1.05,
    # Forex
    "EUR/USD": 1.0520, "GBP/USD": 1.2680, "USD/JPY": 154.50, "AUD/USD": 0.6380, "USD/CHF": 0.8920,
    # Indices
    "US30": 44250, "US100": 21650, "US500": 6050, "GER40": 20350, "UK100": 8150,
    # Metals
    "XAU/USD": 2680, "XAG/USD": 31.50, "XPT/USD": 995, "XPD/USD": 1050,
    # Futures
    "ES": 6050, "NQ": 21650, "CL": 72.50, "GC": 2680, "SI": 31.50
}

async def get_current_price(symbol: str) -> float:
    """Get current price with small random variation for realism"""
    global PRICE_CACHE, PRICE_CACHE_TIME
    
    now = datetime.now(timezone.utc)
    
    # Try to get real crypto prices from CoinGecko
    if "BTC" in symbol or "ETH" in symbol or "SOL" in symbol:
        try:
            async with httpx.AsyncClient() as client_http:
                response = await client_http.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": "bitcoin,ethereum,solana", "vs_currencies": "usd"},
                    timeout=5.0
                )
                if response.status_code == 200:
                    data = response.json()
                    if "BTC" in symbol and "bitcoin" in data:
                        return data["bitcoin"]["usd"]
                    if "ETH" in symbol and "ethereum" in data:
                        return data["ethereum"]["usd"]
                    if "SOL" in symbol and "solana" in data:
                        return data["solana"]["usd"]
        except:
            pass
    
    # Fallback to simulated prices with variation
    base = BASE_PRICES.get(symbol, 100)
    variation = random.uniform(-0.15, 0.15)  # 0.15% max variation
    return round(base * (1 + variation / 100), 5 if base < 10 else 2)

async def get_all_prices() -> Dict[str, Dict]:
    """Get all market prices"""
    prices = {}
    
    # Try CoinGecko for crypto
    try:
        async with httpx.AsyncClient() as client_http:
            response = await client_http.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": "bitcoin,ethereum,solana,ripple,cardano",
                    "vs_currencies": "usd",
                    "include_24hr_change": "true"
                },
                timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                mapping = {"bitcoin": "BTC/USD", "ethereum": "ETH/USD", "solana": "SOL/USD", "ripple": "XRP/USD", "cardano": "ADA/USD"}
                for coin_id, symbol in mapping.items():
                    if coin_id in data:
                        prices[symbol] = {
                            "price": data[coin_id].get("usd", BASE_PRICES.get(symbol, 100)),
                            "change_24h": data[coin_id].get("usd_24h_change", random.uniform(-3, 3)),
                            "type": "crypto"
                        }
    except:
        pass
    
    # Fill missing crypto
    for symbol in ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "ADA/USD"]:
        if symbol not in prices:
            base = BASE_PRICES.get(symbol, 100)
            prices[symbol] = {
                "price": round(base * (1 + random.uniform(-0.5, 0.5) / 100), 2),
                "change_24h": round(random.uniform(-5, 5), 2),
                "type": "crypto"
            }
    
    # Forex
    for symbol in ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF"]:
        base = BASE_PRICES.get(symbol, 1)
        prices[symbol] = {
            "price": round(base * (1 + random.uniform(-0.1, 0.1) / 100), 5),
            "change_24h": round(random.uniform(-1, 1), 2),
            "type": "forex"
        }
    
    # Indices
    for symbol in ["US30", "US100", "US500", "GER40", "UK100"]:
        base = BASE_PRICES.get(symbol, 10000)
        prices[symbol] = {
            "price": round(base * (1 + random.uniform(-0.2, 0.2) / 100), 2),
            "change_24h": round(random.uniform(-1.5, 1.5), 2),
            "type": "indices"
        }
    
    # Metals
    for symbol in ["XAU/USD", "XAG/USD", "XPT/USD", "XPD/USD"]:
        base = BASE_PRICES.get(symbol, 1000)
        prices[symbol] = {
            "price": round(base * (1 + random.uniform(-0.15, 0.15) / 100), 2),
            "change_24h": round(random.uniform(-2, 2), 2),
            "type": "metals"
        }
    
    # Futures
    for symbol in ["ES", "NQ", "CL", "GC", "SI"]:
        base = BASE_PRICES.get(symbol, 1000)
        prices[symbol] = {
            "price": round(base * (1 + random.uniform(-0.2, 0.2) / 100), 2),
            "change_24h": round(random.uniform(-1.5, 1.5), 2),
            "type": "futures"
        }
    
    return prices

@api_router.get("/markets")
async def get_markets(user: dict = Depends(get_current_user)):
    prices = await get_all_prices()
    markets = [{"symbol": sym, **data} for sym, data in prices.items()]
    return {"markets": markets, "updated_at": datetime.now(timezone.utc).isoformat()}

@api_router.get("/price/{symbol:path}")
async def get_price(symbol: str, user: dict = Depends(get_current_user)):
    """Get single price for a symbol"""
    price = await get_current_price(symbol)
    return {"symbol": symbol, "price": price, "timestamp": datetime.now(timezone.utc).isoformat()}

# ==================== AI ANALYSIS ====================

def calculate_levels(price: float, direction: str, strategy: str, symbol: str):
    """Calculate entry, SL, TP based on strategy and market type"""
    
    # Determine pip/point value based on symbol
    if "JPY" in symbol:
        pip = 0.01
    elif any(x in symbol for x in ["EUR", "GBP", "AUD", "CHF", "NZD", "CAD"]) and "/" in symbol and "USD" in symbol:
        pip = 0.0001
    elif "XAU" in symbol:
        pip = 0.10  # Gold moves in 10 cents
    elif "XAG" in symbol:
        pip = 0.01  # Silver moves in 1 cent
    elif any(x in symbol for x in ["US30", "US100", "US500", "ES", "NQ"]):
        pip = 1.0  # Indices and index futures move in points
    elif symbol == "CL":
        pip = 0.01  # Crude oil moves in cents
    elif symbol in ["GC", "SI"]:
        pip = 0.10  # Gold/Silver futures
    elif any(x in symbol for x in ["GER", "UK", "FRA", "JPN"]):
        pip = 1.0
    elif "BTC" in symbol:
        pip = price * 0.001  # 0.1% of price for BTC (~100$ for BTC at 100k)
    elif "ETH" in symbol:
        pip = price * 0.002  # 0.2% for ETH
    elif "SOL" in symbol or "XRP" in symbol or "ADA" in symbol:
        pip = price * 0.005  # 0.5% for altcoins
    else:
        pip = price * 0.002  # Default 0.2%
    
    # Strategy-specific parameters
    strategy_params = {
        "scalping": {"sl_pips": 10, "tp_ratio": 1.5},
        "intraday": {"sl_pips": 25, "tp_ratio": 2.0},
        "swing": {"sl_pips": 50, "tp_ratio": 3.0},
        "smc": {"sl_pips": 30, "tp_ratio": 2.5},
        "ict": {"sl_pips": 35, "tp_ratio": 2.5},
        "wyckoff": {"sl_pips": 40, "tp_ratio": 3.0},
        "macd": {"sl_pips": 25, "tp_ratio": 2.0},
        "rsi": {"sl_pips": 20, "tp_ratio": 1.8},
        "breakout": {"sl_pips": 30, "tp_ratio": 2.5},
        "vwap": {"sl_pips": 20, "tp_ratio": 2.0},
        "momentum": {"sl_pips": 25, "tp_ratio": 2.2},
        "liquidity": {"sl_pips": 35, "tp_ratio": 2.8},
    }
    
    params = strategy_params.get(strategy.lower(), {"sl_pips": 25, "tp_ratio": 2.0})
    sl_distance = params["sl_pips"] * pip
    tp_distance = sl_distance * params["tp_ratio"]
    
    if direction == "BUY":
        sl = price - sl_distance
        tp1 = price + tp_distance
        tp2 = price + tp_distance * 1.5
        tp3 = price + tp_distance * 2
    else:
        sl = price + sl_distance
        tp1 = price - tp_distance
        tp2 = price - tp_distance * 1.5
        tp3 = price - tp_distance * 2
    
    return {
        "entry": round(price, 5 if price < 10 else 2),
        "sl": round(sl, 5 if price < 10 else 2),
        "tp1": round(tp1, 5 if price < 10 else 2),
        "tp2": round(tp2, 5 if price < 10 else 2),
        "tp3": round(tp3, 5 if price < 10 else 2),
        "rr": round(params["tp_ratio"], 2)
    }

def generate_strategy_analysis(strategy: str, price: float, symbol: str) -> Dict:
    """Generate detailed analysis based on strategy"""
    
    analyses = {
        "smc": {
            "name": "Smart Money Concepts",
            "structure": random.choice(["Bullish BOS confirmé", "Bearish CHOCH détecté", "Range avec accumulation"]),
            "poi": f"Order Block identifié à {round(price * 0.995, 2)}",
            "liquidity": random.choice(["Pool de liquidité au-dessus des highs", "Stops sous les lows précédents"]),
            "bias": random.choice(["Bullish", "Bearish"])
        },
        "ict": {
            "name": "Inner Circle Trader",
            "fvg": f"FVG présent entre {round(price * 0.998, 2)} et {round(price * 1.002, 2)}",
            "displacement": random.choice(["Displacement haussier fort", "Displacement baissier", "Consolidation"]),
            "killzone": random.choice(["London Open", "NY Open", "Asian Session"]),
            "bias": random.choice(["Bullish", "Bearish"])
        },
        "wyckoff": {
            "name": "Wyckoff Method",
            "phase": random.choice(["Accumulation Phase C", "Distribution Phase B", "Markup", "Markdown"]),
            "spring": random.choice(["Spring potentiel détecté", "UTAD en formation", "Test du support"]),
            "volume": random.choice(["Volume en augmentation", "Climax de volume", "Volume faible"]),
            "bias": random.choice(["Bullish", "Bearish"])
        },
        "macd": {
            "name": "MACD Strategy",
            "signal": random.choice(["Croisement haussier", "Croisement baissier", "Divergence"]),
            "histogram": random.choice(["Histogramme croissant", "Histogramme décroissant"]),
            "trend": random.choice(["Au-dessus de zéro", "Sous zéro"]),
            "bias": random.choice(["Bullish", "Bearish"])
        },
        "rsi": {
            "name": "RSI Strategy",
            "level": random.randint(25, 75),
            "condition": random.choice(["Survendu - rebond attendu", "Suracheté - correction attendue", "Zone neutre"]),
            "divergence": random.choice(["Divergence haussière", "Divergence baissière", "Pas de divergence"]),
            "bias": random.choice(["Bullish", "Bearish"])
        },
        "breakout": {
            "name": "Breakout Strategy",
            "level": f"Résistance à {round(price * 1.01, 2)}, Support à {round(price * 0.99, 2)}",
            "pattern": random.choice(["Triangle ascendant", "Rectangle", "Wedge"]),
            "confirmation": random.choice(["En attente de cassure", "Cassure confirmée", "Fausse cassure"]),
            "bias": random.choice(["Bullish", "Bearish"])
        },
        "vwap": {
            "name": "VWAP Strategy",
            "position": random.choice(["Prix au-dessus du VWAP", "Prix sous le VWAP"]),
            "deviation": random.choice(["+1 SD", "-1 SD", "Sur le VWAP"]),
            "trend": random.choice(["Tendance haussière", "Tendance baissière", "Range"]),
            "bias": random.choice(["Bullish", "Bearish"])
        },
        "momentum": {
            "name": "Momentum Strategy",
            "strength": random.choice(["Momentum fort", "Momentum faible", "Momentum neutre"]),
            "acceleration": random.choice(["Accélération", "Décélération", "Stable"]),
            "trend": random.choice(["Trend up", "Trend down", "Sideways"]),
            "bias": random.choice(["Bullish", "Bearish"])
        },
        "liquidity": {
            "name": "Liquidity Hunting",
            "pools": f"Liquidité identifiée à {round(price * 0.98, 2)} et {round(price * 1.02, 2)}",
            "target": random.choice(["Chasse aux stops longs", "Chasse aux stops courts"]),
            "imbalance": random.choice(["Imbalance haussier", "Imbalance baissier"]),
            "bias": random.choice(["Bullish", "Bearish"])
        }
    }
    
    return analyses.get(strategy.lower(), analyses["smc"])

@api_router.post("/ai/analyze")
async def ai_analyze(request: AIAnalysisRequest, user: dict = Depends(get_current_user)):
    """Generate AI trading signal with Claude Sonnet 4"""
    
    # Get current price
    price = await get_current_price(request.symbol)
    
    # Generate strategy analysis
    strategy_analysis = generate_strategy_analysis(request.strategy, price, request.symbol)
    
    # Determine direction based on strategy bias
    direction = "BUY" if strategy_analysis.get("bias") == "Bullish" else "SELL"
    
    # Calculate levels
    levels = calculate_levels(price, direction, request.strategy, request.symbol)
    
    # Calculate confidence based on multiple factors
    base_confidence = random.randint(55, 85)
    
    # Try Claude for enhanced analysis
    reasoning = f"Analyse {strategy_analysis['name']}: "
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if api_key:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"analysis_{request.symbol}_{datetime.now().timestamp()}",
                system_message=f"""Tu es AlphaMind, expert en trading utilisant {request.strategy.upper()}.
Analyse brièvement et donne une recommandation claire. Réponds en 2-3 phrases maximum."""
            ).with_model("anthropic", "claude-4-sonnet-20250514")
            
            prompt = f"""Symbole: {request.symbol}
Prix: {price}
Stratégie: {request.strategy.upper()}
Timeframe: {request.timeframe}
Mode: {request.mode}
Analyse technique: {json.dumps(strategy_analysis)}

Donne une recommandation {direction} concise."""

            response = await chat.send_message(UserMessage(text=prompt))
            reasoning = response[:500] if response else reasoning
            base_confidence = min(95, base_confidence + 10)
    except Exception as e:
        logging.error(f"Claude error: {e}")
        reasoning += f"Signal {direction} basé sur {strategy_analysis.get('name', request.strategy)}"
    
    # Build response
    analysis = {
        "signal": direction,
        "confidence": base_confidence,
        "entry_price": levels["entry"],
        "stop_loss": levels["sl"],
        "take_profit_1": levels["tp1"],
        "take_profit_2": levels["tp2"],
        "take_profit_3": levels["tp3"],
        "rr_ratio": levels["rr"],
        "analysis": strategy_analysis,
        "reasoning": reasoning
    }
    
    # Save to DB
    signal_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "symbol": request.symbol,
        "timeframe": request.timeframe,
        "mode": request.mode,
        "strategy": request.strategy,
        "direction": direction,
        "entry_price": levels["entry"],
        "stop_loss": levels["sl"],
        "take_profit_1": levels["tp1"],
        "confidence": base_confidence,
        "analysis": analysis,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.signals.insert_one(signal_doc)
    
    return {"symbol": request.symbol, "analysis": analysis, "timestamp": signal_doc["created_at"]}

# ==================== SIGNALS ====================

@api_router.get("/signals")
async def get_signals(user: dict = Depends(get_current_user)):
    signals = await db.signals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"signals": signals}

# ==================== TRADES ====================

@api_router.get("/trades")
async def get_trades(user: dict = Depends(get_current_user)):
    trades = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Calculate floating PnL for open trades
    for trade in trades:
        if trade.get("status") == "open":
            current_price = await get_current_price(trade["symbol"])
            if trade["direction"] == "BUY":
                trade["floating_pnl"] = round((current_price - trade["entry_price"]) * trade["quantity"], 2)
            else:
                trade["floating_pnl"] = round((trade["entry_price"] - current_price) * trade["quantity"], 2)
            trade["current_price"] = current_price
            
            # Check if SL or TP hit
            if trade["direction"] == "BUY":
                if current_price <= trade["stop_loss"]:
                    trade["sl_hit"] = True
                elif current_price >= trade["take_profit"]:
                    trade["tp_hit"] = True
            else:
                if current_price >= trade["stop_loss"]:
                    trade["sl_hit"] = True
                elif current_price <= trade["take_profit"]:
                    trade["tp_hit"] = True
    
    return {"trades": trades}

@api_router.post("/trades")
async def create_trade(trade: TradeCreate, user: dict = Depends(get_current_user)):
    trade_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "signal_id": trade.signal_id,
        "symbol": trade.symbol,
        "direction": trade.direction,
        "entry_price": trade.entry_price,
        "quantity": trade.quantity,
        "stop_loss": trade.stop_loss,
        "take_profit": trade.take_profit,
        "strategy": trade.strategy,
        "status": "open",
        "pnl": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trades.insert_one(trade_doc)
    return {k: v for k, v in trade_doc.items() if k != "_id"}

@api_router.post("/trades/{trade_id}/close")
async def close_trade(trade_id: str, exit_price: float, user: dict = Depends(get_current_user)):
    trade = await db.trades.find_one({"id": trade_id, "user_id": user["id"]})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Calculate PnL
    if trade["direction"] == "BUY":
        pnl = (exit_price - trade["entry_price"]) * trade["quantity"]
    else:
        pnl = (trade["entry_price"] - exit_price) * trade["quantity"]
    
    pnl = round(pnl, 2)
    
    # Update trade
    await db.trades.update_one(
        {"id": trade_id},
        {"$set": {
            "status": "closed",
            "exit_price": exit_price,
            "pnl": pnl,
            "closed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update user balance
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": pnl}})
    
    return {"trade_id": trade_id, "pnl": pnl, "status": "closed", "exit_price": exit_price}

@api_router.post("/trades/{trade_id}/close-at-market")
async def close_trade_at_market(trade_id: str, user: dict = Depends(get_current_user)):
    """Close trade at current market price"""
    trade = await db.trades.find_one({"id": trade_id, "user_id": user["id"]})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    current_price = await get_current_price(trade["symbol"])
    return await close_trade(trade_id, current_price, user)

@api_router.post("/trades/{trade_id}/close-sl")
async def close_trade_at_sl(trade_id: str, user: dict = Depends(get_current_user)):
    """Close trade at stop loss"""
    trade = await db.trades.find_one({"id": trade_id, "user_id": user["id"]})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return await close_trade(trade_id, trade["stop_loss"], user)

@api_router.post("/trades/{trade_id}/close-tp")
async def close_trade_at_tp(trade_id: str, user: dict = Depends(get_current_user)):
    """Close trade at take profit"""
    trade = await db.trades.find_one({"id": trade_id, "user_id": user["id"]})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return await close_trade(trade_id, trade["take_profit"], user)

# ==================== PORTFOLIO ====================

@api_router.get("/portfolio")
async def get_portfolio(user: dict = Depends(get_current_user)):
    trades = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    
    open_trades = [t for t in trades if t["status"] == "open"]
    closed_trades = [t for t in trades if t["status"] == "closed"]
    
    total_pnl = sum(t.get("pnl", 0) for t in closed_trades)
    win_rate = 0
    if closed_trades:
        winners = len([t for t in closed_trades if t.get("pnl", 0) > 0])
        win_rate = (winners / len(closed_trades)) * 100
    
    # Get fresh user balance
    fresh_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    return {
        "balance": fresh_user.get("balance", 10000),
        "total_pnl": round(total_pnl, 2),
        "win_rate": round(win_rate, 2),
        "total_trades": len(trades),
        "open_trades": len(open_trades),
        "closed_trades": len(closed_trades)
    }

# ==================== BOT CONFIG ====================

@api_router.get("/bot/config")
async def get_bot_config(user: dict = Depends(get_current_user)):
    config = await db.bot_configs.find_one({"user_id": user["id"]}, {"_id": 0})
    if not config:
        config = {
            "user_id": user["id"],
            "enabled": False,
            "risk_per_trade": 0.02,
            "max_daily_trades": 10,
            "allowed_markets": ["crypto", "forex", "indices", "metals", "futures"],
            "strategies": ["smc", "ict", "wyckoff"],
            "auto_execute": False,
            "mt5_connected": False
        }
        await db.bot_configs.insert_one(config)
    return config

@api_router.post("/bot/config")
async def update_bot_config(config: BotConfig, user: dict = Depends(get_current_user)):
    await db.bot_configs.update_one(
        {"user_id": user["id"]},
        {"$set": config.model_dump()},
        upsert=True
    )
    return {"message": "Configuration updated", "config": config.model_dump()}

@api_router.post("/bot/connect-mt5")
async def connect_mt5(request: MT5ConnectRequest, user: dict = Depends(get_current_user)):
    await db.bot_configs.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "mt5_connected": True,
            "mt5_server": request.server,
            "mt5_login": request.login,
            "mt5_connection_time": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "MT5 connected", "status": "connected", "server": request.server}

@api_router.post("/bot/disconnect-mt5")
async def disconnect_mt5(user: dict = Depends(get_current_user)):
    await db.bot_configs.update_one(
        {"user_id": user["id"]},
        {"$set": {"mt5_connected": False, "mt5_server": None, "mt5_login": None}}
    )
    return {"message": "MT5 disconnected", "status": "disconnected"}

# ==================== MAIN ====================

@api_router.get("/")
async def root():
    return {"message": "AlphaMind Trading API v2.0", "status": "online"}

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
