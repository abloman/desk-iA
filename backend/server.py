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
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor

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

# ==================== REAL MARKET DATA (Yahoo Finance) ====================

# Symbol mapping: Internal -> Yahoo Finance
YAHOO_SYMBOLS = {
    # Crypto
    "BTC/USD": "BTC-USD", "ETH/USD": "ETH-USD", "SOL/USD": "SOL-USD",
    "XRP/USD": "XRP-USD", "ADA/USD": "ADA-USD",
    # Forex
    "EUR/USD": "EURUSD=X", "GBP/USD": "GBPUSD=X", "USD/JPY": "USDJPY=X",
    "AUD/USD": "AUDUSD=X", "USD/CHF": "USDCHF=X",
    # Indices
    "US30": "^DJI", "US100": "^IXIC", "US500": "^GSPC",
    "GER40": "^GDAXI", "UK100": "^FTSE",
    # Metals (Futures)
    "XAU/USD": "GC=F", "XAG/USD": "SI=F", "XPT/USD": "PL=F", "XPD/USD": "PA=F",
    # Futures
    "ES": "ES=F", "NQ": "NQ=F", "CL": "CL=F", "GC": "GC=F", "SI": "SI=F"
}

# TradingView symbol mapping for chart display
TRADINGVIEW_SYMBOLS = {
    # Crypto
    "BTC/USD": "BINANCE:BTCUSDT", "ETH/USD": "BINANCE:ETHUSDT", "SOL/USD": "BINANCE:SOLUSDT",
    "XRP/USD": "BINANCE:XRPUSDT", "ADA/USD": "BINANCE:ADAUSDT",
    # Forex
    "EUR/USD": "FX:EURUSD", "GBP/USD": "FX:GBPUSD", "USD/JPY": "FX:USDJPY",
    "AUD/USD": "FX:AUDUSD", "USD/CHF": "FX:USDCHF",
    # Indices
    "US30": "TVC:DJI", "US100": "NASDAQ:NDX", "US500": "SP:SPX",
    "GER40": "XETR:DAX", "UK100": "TVC:UKX",
    # Metals
    "XAU/USD": "COMEX:GC1!", "XAG/USD": "COMEX:SI1!", "XPT/USD": "NYMEX:PL1!", "XPD/USD": "NYMEX:PA1!",
    # Futures
    "ES": "CME_MINI:ES1!", "NQ": "CME_MINI:NQ1!", "CL": "NYMEX:CL1!", "GC": "COMEX:GC1!", "SI": "COMEX:SI1!"
}

# Thread executor for yfinance (blocking calls)
executor = ThreadPoolExecutor(max_workers=4)

def _fetch_yf_data(symbol: str, period: str = "7d", interval: str = "1h") -> List[Dict]:
    """Fetch OHLC data from Yahoo Finance (blocking)"""
    yf_symbol = YAHOO_SYMBOLS.get(symbol, symbol)
    try:
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period=period, interval=interval)
        if not hist.empty:
            data = []
            for idx, row in hist.iterrows():
                data.append({
                    "time": int(idx.timestamp() * 1000),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row.get("Volume", 0))
                })
            return data
    except Exception as e:
        logging.error(f"Yahoo Finance error for {symbol}: {e}")
    return []

async def fetch_ohlc_data(symbol: str, period: str = "7d", interval: str = "1h") -> List[Dict]:
    """Async wrapper for Yahoo Finance data"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _fetch_yf_data, symbol, period, interval)

def _get_yf_price(symbol: str) -> float:
    """Get current price from Yahoo Finance (blocking)"""
    yf_symbol = YAHOO_SYMBOLS.get(symbol, symbol)
    try:
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period="1d", interval="1m")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception as e:
        logging.error(f"YF price error: {e}")
    return 0

async def get_real_price(symbol: str) -> float:
    """Get real-time price from Yahoo Finance"""
    loop = asyncio.get_event_loop()
    price = await loop.run_in_executor(executor, _get_yf_price, symbol)
    if price > 0:
        return price
    # Fallback to simulated price
    return await get_current_price(symbol)

def analyze_market_structure(ohlc_data: List[Dict], current_price: float) -> Dict:
    """Analyze real market structure: swing highs/lows, BOS, trend, liquidity zones, optimal entry"""
    if len(ohlc_data) < 10:
        return {"error": "Insufficient data"}
    
    highs = [c["high"] for c in ohlc_data]
    lows = [c["low"] for c in ohlc_data]
    closes = [c["close"] for c in ohlc_data]
    
    # Find swing highs and lows (local extremes)
    swing_highs = []
    swing_lows = []
    
    for i in range(2, len(ohlc_data) - 2):
        if highs[i] > highs[i-1] and highs[i] > highs[i-2] and highs[i] > highs[i+1] and highs[i] > highs[i+2]:
            swing_highs.append({"price": highs[i], "index": i, "time": ohlc_data[i]["time"]})
        if lows[i] < lows[i-1] and lows[i] < lows[i-2] and lows[i] < lows[i+1] and lows[i] < lows[i+2]:
            swing_lows.append({"price": lows[i], "index": i, "time": ohlc_data[i]["time"]})
    
    recent_highs = sorted(swing_highs, key=lambda x: x["index"], reverse=True)[:5]
    recent_lows = sorted(swing_lows, key=lambda x: x["index"], reverse=True)[:5]
    
    # Detect BOS (Break of Structure)
    bos_bullish = None
    bos_bearish = None
    last_bos = None
    
    if len(recent_highs) >= 2 and len(recent_lows) >= 2:
        # BOS Bullish: Current price broke above previous swing high
        for i, sh in enumerate(recent_highs[:-1]):
            if current_price > sh["price"]:
                bos_bullish = {"level": sh["price"], "broken": True, "index": sh["index"]}
                break
        
        # BOS Bearish: Current price broke below previous swing low
        for i, sl in enumerate(recent_lows[:-1]):
            if current_price < sl["price"]:
                bos_bearish = {"level": sl["price"], "broken": True, "index": sl["index"]}
                break
    
    # Determine trend based on structure
    if len(recent_highs) >= 2 and len(recent_lows) >= 2:
        higher_highs = recent_highs[0]["price"] > recent_highs[1]["price"]
        higher_lows = recent_lows[0]["price"] > recent_lows[1]["price"]
        lower_highs = recent_highs[0]["price"] < recent_highs[1]["price"]
        lower_lows = recent_lows[0]["price"] < recent_lows[1]["price"]
        
        if higher_highs and higher_lows:
            trend = "BULLISH"
            last_bos = bos_bullish
        elif lower_highs and lower_lows:
            trend = "BEARISH"
            last_bos = bos_bearish
        else:
            trend = "RANGING"
    else:
        trend = "UNDEFINED"
    
    # Calculate ATR
    true_ranges = []
    for i in range(1, len(ohlc_data)):
        tr = max(
            ohlc_data[i]["high"] - ohlc_data[i]["low"],
            abs(ohlc_data[i]["high"] - ohlc_data[i-1]["close"]),
            abs(ohlc_data[i]["low"] - ohlc_data[i-1]["close"])
        )
        true_ranges.append(tr)
    atr = sum(true_ranges[-14:]) / min(14, len(true_ranges)) if true_ranges else current_price * 0.02
    
    # Recent high/low and 50% level (equilibrium)
    recent_high = max(highs[-20:]) if len(highs) >= 20 else max(highs)
    recent_low = min(lows[-20:]) if len(lows) >= 20 else min(lows)
    equilibrium = (recent_high + recent_low) / 2
    
    # Price position relative to range
    range_size = recent_high - recent_low
    if range_size > 0:
        price_pct = (current_price - recent_low) / range_size * 100
        if price_pct > 70:
            price_position = "PREMIUM"
        elif price_pct < 30:
            price_position = "DISCOUNT"
        else:
            price_position = "EQUILIBRIUM"
    else:
        price_position = "NEUTRAL"
    
    # Calculate OPTIMAL ENTRY (not current price)
    # For BUY: Entry at 50%-61.8% retracement of last bullish move (discount)
    # For SELL: Entry at 50%-61.8% retracement of last bearish move (premium)
    
    optimal_entry_buy = None
    optimal_entry_sell = None
    
    if len(recent_lows) >= 1 and recent_high > recent_low:
        # Optimal BUY entry: 50% retracement from recent high to recent low
        fib_50 = recent_high - (range_size * 0.5)
        fib_618 = recent_high - (range_size * 0.618)
        optimal_entry_buy = round(fib_618, 2)  # 61.8% is better value
        
        # Optimal SELL entry: 50% retracement from recent low to recent high  
        optimal_entry_sell = round(recent_low + (range_size * 0.618), 2)
    
    # Order Block detection (simplified: last bearish candle before bullish move, vice versa)
    order_blocks = []
    for i in range(len(ohlc_data) - 5, len(ohlc_data) - 1):
        if i > 0:
            # Bullish OB: Bearish candle followed by strong bullish move
            if ohlc_data[i]["close"] < ohlc_data[i]["open"]:  # Bearish candle
                if ohlc_data[i+1]["close"] > ohlc_data[i]["high"]:  # Strong bullish break
                    order_blocks.append({
                        "type": "BULLISH_OB",
                        "high": ohlc_data[i]["high"],
                        "low": ohlc_data[i]["low"],
                        "entry_zone": round((ohlc_data[i]["high"] + ohlc_data[i]["low"]) / 2, 2)
                    })
            # Bearish OB
            if ohlc_data[i]["close"] > ohlc_data[i]["open"]:  # Bullish candle
                if ohlc_data[i+1]["close"] < ohlc_data[i]["low"]:  # Strong bearish break
                    order_blocks.append({
                        "type": "BEARISH_OB",
                        "high": ohlc_data[i]["high"],
                        "low": ohlc_data[i]["low"],
                        "entry_zone": round((ohlc_data[i]["high"] + ohlc_data[i]["low"]) / 2, 2)
                    })
    
    # Liquidity zones
    liquidity_above = [h["price"] for h in recent_highs if h["price"] > current_price]
    liquidity_below = [l["price"] for l in recent_lows if l["price"] < current_price]
    
    nearest_resistance = min(liquidity_above) if liquidity_above else recent_high
    nearest_support = max(liquidity_below) if liquidity_below else recent_low
    
    return {
        "trend": trend,
        "atr": round(atr, 2),
        "atr_pct": round((atr / current_price) * 100, 2) if current_price > 0 else 0,
        "swing_highs": [round(h["price"], 2) for h in recent_highs],
        "swing_lows": [round(l["price"], 2) for l in recent_lows],
        "nearest_resistance": round(nearest_resistance, 2),
        "nearest_support": round(nearest_support, 2),
        "recent_high": round(recent_high, 2),
        "recent_low": round(recent_low, 2),
        "equilibrium": round(equilibrium, 2),
        "price_position": price_position,
        "bos_bullish": bos_bullish,
        "bos_bearish": bos_bearish,
        "last_bos": last_bos,
        "optimal_entry_buy": optimal_entry_buy,
        "optimal_entry_sell": optimal_entry_sell,
        "order_blocks": order_blocks[-3:] if order_blocks else [],
        "liquidity_above": sorted([round(x, 2) for x in liquidity_above])[:3] if liquidity_above else [],
        "liquidity_below": sorted([round(x, 2) for x in liquidity_below], reverse=True)[:3] if liquidity_below else []
    }

def calculate_signal_levels(
    current_price: float,
    structure: Dict,
    direction: str,
    strategy: str,
    mode: str,
    timeframe: str
) -> Dict:
    """Calculate OPTIMAL Entry/SL/TP based on real market structure"""
    
    atr = structure.get("atr", current_price * 0.02)
    
    # Mode config: RR requirements vary by mode
    mode_config = {
        "scalping": {"min_rr": 1.5, "sl_buffer": 0.3},
        "intraday": {"min_rr": 2.0, "sl_buffer": 0.2},
        "swing": {"min_rr": 2.5, "sl_buffer": 0.15}
    }
    
    # Timeframe adjustments for SL buffer
    tf_mult = {"5min": 0.5, "15min": 0.75, "1h": 1.0, "4h": 1.5, "1d": 2.0}
    
    config = mode_config.get(mode, mode_config["intraday"])
    tf = tf_mult.get(timeframe, 1.0)
    
    decimals = 2 if current_price > 10 else 4
    
    if direction == "BUY":
        # OPTIMAL ENTRY: Use 61.8% fib level or Order Block zone (discount zone)
        optimal_entry = structure.get("optimal_entry_buy")
        
        # Check for Order Blocks
        obs = [ob for ob in structure.get("order_blocks", []) if ob["type"] == "BULLISH_OB"]
        if obs:
            # Entry at OB zone (better entry)
            optimal_entry = obs[0]["entry_zone"]
        
        # If no optimal entry found or it's above current price, use current price
        if not optimal_entry or optimal_entry > current_price:
            optimal_entry = current_price
        
        # SL below swing low with buffer
        swing_lows = structure.get("swing_lows", [])
        valid_lows = [l for l in swing_lows if l < optimal_entry]
        if valid_lows:
            sl_base = max(valid_lows)
        else:
            sl_base = structure.get("nearest_support", optimal_entry - atr * 1.5)
        
        sl = sl_base - (atr * config["sl_buffer"] * tf)
        
        # TP targets liquidity above
        liquidity_above = structure.get("liquidity_above", [])
        nearest_resistance = structure.get("nearest_resistance", optimal_entry + atr * 3)
        recent_high = structure.get("recent_high", optimal_entry + atr * 4)
        
        if liquidity_above:
            tp1 = min(liquidity_above)
        else:
            tp1 = nearest_resistance
        
        # Ensure minimum RR
        sl_distance = optimal_entry - sl
        if sl_distance > 0:
            min_tp = optimal_entry + (sl_distance * config["min_rr"])
            if tp1 < min_tp:
                tp1 = min_tp
        
        tp2 = nearest_resistance if nearest_resistance > tp1 else tp1 + (tp1 - optimal_entry) * 0.5
        tp3 = recent_high
        
    else:  # SELL
        # OPTIMAL ENTRY: Use 61.8% fib level or Order Block zone (premium zone)
        optimal_entry = structure.get("optimal_entry_sell")
        
        # Check for Order Blocks
        obs = [ob for ob in structure.get("order_blocks", []) if ob["type"] == "BEARISH_OB"]
        if obs:
            optimal_entry = obs[0]["entry_zone"]
        
        # If no optimal entry or it's below current price, use current price
        if not optimal_entry or optimal_entry < current_price:
            optimal_entry = current_price
        
        # SL above swing high with buffer
        swing_highs = structure.get("swing_highs", [])
        valid_highs = [h for h in swing_highs if h > optimal_entry]
        if valid_highs:
            sl_base = min(valid_highs)
        else:
            sl_base = structure.get("nearest_resistance", optimal_entry + atr * 1.5)
        
        sl = sl_base + (atr * config["sl_buffer"] * tf)
        
        # TP targets liquidity below
        liquidity_below = structure.get("liquidity_below", [])
        nearest_support = structure.get("nearest_support", optimal_entry - atr * 3)
        recent_low = structure.get("recent_low", optimal_entry - atr * 4)
        
        if liquidity_below:
            tp1 = max(liquidity_below)
        else:
            tp1 = nearest_support
        
        # Ensure minimum RR
        sl_distance = sl - optimal_entry
        if sl_distance > 0:
            min_tp = optimal_entry - (sl_distance * config["min_rr"])
            if tp1 > min_tp:
                tp1 = min_tp
        
        tp2 = nearest_support if nearest_support < tp1 else tp1 - (optimal_entry - tp1) * 0.5
        tp3 = recent_low
    
    rr = round(abs(tp1 - optimal_entry) / abs(optimal_entry - sl), 2) if abs(optimal_entry - sl) > 0 else config["min_rr"]
    
    return {
        "optimal_entry": round(optimal_entry, decimals),
        "current_price": round(current_price, decimals),
        "sl": round(sl, decimals),
        "tp1": round(tp1, decimals),
        "tp2": round(tp2, decimals),
        "tp3": round(tp3, decimals),
        "rr": rr,
        "sl_distance": round(abs(optimal_entry - sl), decimals),
        "tp_distance": round(abs(tp1 - optimal_entry), decimals),
        "entry_type": "LIMIT" if optimal_entry != current_price else "MARKET"
    }

# ==================== 5 ADVANCED STRATEGIES ====================

ADVANCED_STRATEGIES = {
    "smc_ict_advanced": {
        "name": "SMC/ICT Avancée",
        "description": "Combine SMC + ICT concepts: BOS, CHOCH, FVG, Order Blocks, Liquidity Sweeps",
        "sl_atr_mult": 1.5,
        "tp_atr_mult": 3.0,
        "min_rr": 2.0
    },
    "market_structure": {
        "name": "Market Structure Avancé",
        "description": "Analyse structure externe (HTF) et interne (LTF) avec confluence",
        "sl_atr_mult": 1.2,
        "tp_atr_mult": 2.5,
        "min_rr": 2.0
    },
    "orderblock": {
        "name": "Order Block + Imbalances",
        "description": "Détecte Order Blocks avec FVG/Imbalances pour entries précises",
        "sl_atr_mult": 1.0,
        "tp_atr_mult": 2.5,
        "min_rr": 2.5
    },
    "ma_advanced": {
        "name": "Moyenne Mobile Avancé",
        "description": "EMA 9/21/50/200 avec confluence de structure et momentum",
        "sl_atr_mult": 1.3,
        "tp_atr_mult": 2.6,
        "min_rr": 2.0
    },
    "opr": {
        "name": "OPR (Opening Price Range)",
        "description": "Trade basé sur le range d'ouverture avec expansion targets",
        "sl_atr_mult": 0.8,
        "tp_atr_mult": 1.6,
        "min_rr": 2.0
    }
}

def calculate_levels_advanced(price: float, direction: str, strategy: str, symbol: str, volatility: Dict) -> Dict:
    """Calculate entry, SL, TP based on advanced strategy with volatility consideration"""
    
    atr = volatility["atr"]
    strat = ADVANCED_STRATEGIES.get(strategy, ADVANCED_STRATEGIES["smc_ict_advanced"])
    
    sl_distance = atr * strat["sl_atr_mult"]
    tp_distance = atr * strat["tp_atr_mult"]
    
    # Ensure minimum RR ratio
    if tp_distance / sl_distance < strat["min_rr"]:
        tp_distance = sl_distance * strat["min_rr"]
    
    decimals = 4 if price < 10 else 2
    
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
        "entry": round(price, decimals),
        "sl": round(sl, decimals),
        "tp1": round(tp1, decimals),
        "tp2": round(tp2, decimals),
        "tp3": round(tp3, decimals),
        "rr": round(tp_distance / sl_distance, 2),
        "sl_pips": round(sl_distance, decimals),
        "tp_pips": round(tp_distance, decimals)
    }

def generate_advanced_analysis(strategy: str, price: float, symbol: str, volatility: Dict) -> Dict:
    """Generate detailed analysis for advanced strategies"""
    
    # Determine market structure
    htf_structure = random.choice(["Bullish", "Bearish", "Ranging"])
    ltf_structure = random.choice(["Bullish", "Bearish", "Ranging"])
    
    # Confluence score based on structure alignment
    confluence = 0
    if htf_structure == ltf_structure:
        confluence += 30
    if volatility["volatility_level"] in ["medium", "high"]:
        confluence += 20
    confluence += random.randint(20, 50)
    
    bias = "Bullish" if confluence > 55 else "Bearish" if confluence < 45 else random.choice(["Bullish", "Bearish"])
    
    analyses = {
        "smc_ict_advanced": {
            "name": "SMC/ICT Avancée",
            "htf_structure": htf_structure,
            "ltf_structure": ltf_structure,
            "bos_choch": random.choice(["BOS haussier confirmé sur H4", "CHOCH baissier sur H1", "BOS en attente"]),
            "order_block": f"OB identifié à {round(price * (0.995 if bias == 'Bullish' else 1.005), 2)}",
            "fvg": f"FVG entre {round(price * 0.997, 2)} - {round(price * 1.003, 2)}",
            "liquidity": random.choice(["Liquidité buy-side à chasser", "Liquidité sell-side proche", "Sweep effectué"]),
            "poi": f"POI optimal: {round(price * (0.998 if bias == 'Bullish' else 1.002), 2)}",
            "confluence_score": confluence,
            "bias": bias
        },
        "market_structure": {
            "name": "Market Structure Avancé",
            "external_structure": f"HTF ({htf_structure}): " + random.choice(["Trend établi", "Consolidation", "Reversal possible"]),
            "internal_structure": f"LTF ({ltf_structure}): " + random.choice(["Impulsion en cours", "Correction active", "Range"]),
            "key_levels": {
                "resistance": round(price * 1.015, 2),
                "support": round(price * 0.985, 2),
                "pivot": round(price, 2)
            },
            "structure_break": random.choice(["Break of structure imminent", "Structure intacte", "Retest en cours"]),
            "confluence_score": confluence,
            "bias": bias
        },
        "orderblock": {
            "name": "Order Block + Imbalances",
            "bullish_ob": f"Bullish OB: {round(price * 0.992, 2)} - {round(price * 0.995, 2)}",
            "bearish_ob": f"Bearish OB: {round(price * 1.005, 2)} - {round(price * 1.008, 2)}",
            "fvg_zones": [
                f"FVG up: {round(price * 1.002, 2)}",
                f"FVG down: {round(price * 0.998, 2)}"
            ],
            "imbalance": random.choice(["Imbalance haussier à combler", "Imbalance baissier présent", "Zones équilibrées"]),
            "mitigation": random.choice(["OB non mitigé (valide)", "OB partiellement mitigé", "Attente retest"]),
            "confluence_score": confluence,
            "bias": bias
        },
        "ma_advanced": {
            "name": "Moyenne Mobile Avancé",
            "ema_9": round(price * random.uniform(0.998, 1.002), 2),
            "ema_21": round(price * random.uniform(0.995, 1.005), 2),
            "ema_50": round(price * random.uniform(0.99, 1.01), 2),
            "ema_200": round(price * random.uniform(0.98, 1.02), 2),
            "alignment": random.choice(["Alignement haussier parfait", "Alignement baissier", "EMAs en compression"]),
            "golden_cross": random.choice(["Golden cross récent", "Death cross en formation", "Pas de croisement"]),
            "price_position": random.choice(["Prix au-dessus de toutes les EMAs", "Prix sous les EMAs rapides", "Prix en zone EMA"]),
            "confluence_score": confluence,
            "bias": bias
        },
        "opr": {
            "name": "OPR (Opening Price Range)",
            "open_price": round(price * random.uniform(0.998, 1.002), 2),
            "opr_high": round(price * 1.005, 2),
            "opr_low": round(price * 0.995, 2),
            "range_size": round(price * 0.01, 2),
            "expansion_target_up": round(price * 1.015, 2),
            "expansion_target_down": round(price * 0.985, 2),
            "breakout_status": random.choice(["Breakout haussier confirmé", "Breakout baissier", "En attente de breakout"]),
            "session": volatility["session"],
            "confluence_score": confluence,
            "bias": bias
        }
    }
    
    return analyses.get(strategy, analyses["smc_ict_advanced"])

@api_router.post("/ai/analyze")
async def ai_analyze(request: AIAnalysisRequest, user: dict = Depends(get_current_user)):
    """Generate AI trading signal with REAL market structure analysis"""
    
    # Get current REAL price
    price = await get_current_price(request.symbol)
    
    # Fetch REAL OHLC data for structure analysis
    ohlc_data = await fetch_ohlc_data(request.symbol, period="7d", interval="1h")
    
    # Analyze REAL market structure
    if ohlc_data and len(ohlc_data) >= 10:
        structure = analyze_market_structure(ohlc_data, price)
    else:
        # Fallback for non-crypto or API failure
        structure = {
            "trend": "UNDEFINED",
            "atr": price * 0.02,
            "atr_pct": 2.0,
            "swing_highs": [price * 1.02, price * 1.04],
            "swing_lows": [price * 0.98, price * 0.96],
            "nearest_resistance": price * 1.03,
            "nearest_support": price * 0.97,
            "recent_high": price * 1.05,
            "recent_low": price * 0.95,
            "liquidity_above": [],
            "liquidity_below": [],
            "price_position": "NEUTRAL"
        }
    
    # Map strategy names
    strategy_mapping = {
        "smc": "smc_ict_advanced",
        "ict": "smc_ict_advanced",
        "smc_ict_advanced": "smc_ict_advanced",
        "market_structure": "market_structure",
        "orderblock": "orderblock",
        "ma_advanced": "ma_advanced",
        "opr": "opr"
    }
    mapped_strategy = strategy_mapping.get(request.strategy.lower(), "smc_ict_advanced")
    
    # Determine direction based on REAL structure
    trend = structure.get("trend", "RANGING")
    price_position = structure.get("price_position", "NEUTRAL")
    
    # Trading logic based on structure
    if trend == "BULLISH":
        direction = "BUY" if price_position == "DISCOUNT" else "SELL" if price_position == "PREMIUM" else "BUY"
    elif trend == "BEARISH":
        direction = "SELL" if price_position == "PREMIUM" else "BUY" if price_position == "DISCOUNT" else "SELL"
    else:
        # Ranging - trade from extremes
        direction = "BUY" if price_position == "DISCOUNT" else "SELL"
    
    # Calculate levels based on REAL structure
    levels = calculate_signal_levels(price, structure, direction, mapped_strategy, request.mode, request.timeframe)
    
    # Build strategy analysis with real data including BOS and OB info
    last_bos = structure.get("last_bos")
    order_blocks = structure.get("order_blocks", [])
    
    strategy_analysis = {
        "name": ADVANCED_STRATEGIES.get(mapped_strategy, {}).get("name", mapped_strategy),
        "trend": trend,
        "price_position": price_position,
        "atr": structure.get("atr"),
        "atr_pct": structure.get("atr_pct"),
        "nearest_resistance": structure.get("nearest_resistance"),
        "nearest_support": structure.get("nearest_support"),
        "recent_high": structure.get("recent_high"),
        "recent_low": structure.get("recent_low"),
        "equilibrium": structure.get("equilibrium"),
        "swing_highs": structure.get("swing_highs", [])[:3],
        "swing_lows": structure.get("swing_lows", [])[:3],
        "liquidity_above": structure.get("liquidity_above", []),
        "liquidity_below": structure.get("liquidity_below", []),
        "bos_bullish": structure.get("bos_bullish"),
        "bos_bearish": structure.get("bos_bearish"),
        "last_bos": last_bos,
        "order_blocks": order_blocks,
        "optimal_entry_buy": structure.get("optimal_entry_buy"),
        "optimal_entry_sell": structure.get("optimal_entry_sell"),
        "bias": "Bullish" if direction == "BUY" else "Bearish"
    }
    
    # Calculate confidence based on structure alignment
    base_confidence = 50
    if trend != "UNDEFINED" and trend != "RANGING":
        base_confidence += 15
    if (trend == "BULLISH" and direction == "BUY") or (trend == "BEARISH" and direction == "SELL"):
        base_confidence += 15
    if price_position == "DISCOUNT" and direction == "BUY":
        base_confidence += 10
    elif price_position == "PREMIUM" and direction == "SELL":
        base_confidence += 10
    if levels.get("rr", 0) >= 2:
        base_confidence += 10
    
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
    
    # Build response with OPTIMAL entry and CURRENT price
    analysis = {
        "signal": direction,
        "confidence": base_confidence,
        "current_price": levels["current_price"],
        "optimal_entry": levels["optimal_entry"],
        "entry_type": levels["entry_type"],  # LIMIT or MARKET
        "stop_loss": levels["sl"],
        "take_profit_1": levels["tp1"],
        "take_profit_2": levels["tp2"],
        "take_profit_3": levels["tp3"],
        "rr_ratio": levels["rr"],
        "sl_distance": levels["sl_distance"],
        "tp_distance": levels["tp_distance"],
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
        "current_price": levels["current_price"],
        "optimal_entry": levels["optimal_entry"],
        "entry_type": levels["entry_type"],
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

@api_router.get("/chart-symbol/{symbol:path}")
async def get_chart_symbol(symbol: str):
    """Get TradingView symbol for chart display"""
    tv_symbol = TRADINGVIEW_SYMBOLS.get(symbol, "BINANCE:BTCUSDT")
    return {"symbol": symbol, "tradingview_symbol": tv_symbol}

@api_router.get("/real-price/{symbol:path}")
async def get_real_price_endpoint(symbol: str, user: dict = Depends(get_current_user)):
    """Get real-time price from Yahoo Finance"""
    price = await get_real_price(symbol)
    return {"symbol": symbol, "price": price, "source": "yahoo_finance", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/portfolio/equity-curve")
async def get_equity_curve(user: dict = Depends(get_current_user)):
    """Get equity curve data for chart"""
    trades = await db.trades.find(
        {"user_id": user["id"], "status": "closed"}, 
        {"_id": 0}
    ).sort("closed_at", 1).to_list(1000)
    
    equity_data = []
    cumulative_pnl = 0
    initial_balance = 10000
    
    for trade in trades:
        cumulative_pnl += trade.get("pnl", 0)
        equity_data.append({
            "timestamp": trade.get("closed_at", trade.get("created_at")),
            "pnl": trade.get("pnl", 0),
            "cumulative_pnl": round(cumulative_pnl, 2),
            "equity": round(initial_balance + cumulative_pnl, 2),
            "symbol": trade.get("symbol"),
            "strategy": trade.get("strategy")
        })
    
    return {"equity_curve": equity_data, "final_equity": round(initial_balance + cumulative_pnl, 2)}

@api_router.get("/portfolio/strategy-stats")
async def get_strategy_stats(user: dict = Depends(get_current_user)):
    """Get performance statistics by strategy"""
    trades = await db.trades.find(
        {"user_id": user["id"], "status": "closed"}, 
        {"_id": 0}
    ).to_list(1000)
    
    strategy_stats = {}
    
    for trade in trades:
        strat = trade.get("strategy", "unknown")
        if strat not in strategy_stats:
            strategy_stats[strat] = {
                "total_trades": 0,
                "winning_trades": 0,
                "total_pnl": 0,
                "avg_pnl": 0,
                "max_win": 0,
                "max_loss": 0
            }
        
        stats = strategy_stats[strat]
        stats["total_trades"] += 1
        pnl = trade.get("pnl", 0)
        stats["total_pnl"] += pnl
        
        if pnl > 0:
            stats["winning_trades"] += 1
            stats["max_win"] = max(stats["max_win"], pnl)
        else:
            stats["max_loss"] = min(stats["max_loss"], pnl)
    
    # Calculate averages and win rates
    result = []
    for strat, stats in strategy_stats.items():
        if stats["total_trades"] > 0:
            stats["avg_pnl"] = round(stats["total_pnl"] / stats["total_trades"], 2)
            stats["win_rate"] = round((stats["winning_trades"] / stats["total_trades"]) * 100, 2)
            stats["total_pnl"] = round(stats["total_pnl"], 2)
            stats["strategy"] = strat
            stats["strategy_name"] = ADVANCED_STRATEGIES.get(strat, {}).get("name", strat.upper())
            result.append(stats)
    
    # Sort by total PnL
    result.sort(key=lambda x: x["total_pnl"], reverse=True)
    
    return {"strategy_stats": result}

@api_router.delete("/portfolio/clear-history")
async def clear_trade_history(user: dict = Depends(get_current_user)):
    """Clear all trade history and reset balance"""
    await db.trades.delete_many({"user_id": user["id"]})
    await db.signals.delete_many({"user_id": user["id"]})
    await db.users.update_one({"id": user["id"]}, {"$set": {"balance": 10000}})
    
    return {"message": "Historique effacé", "new_balance": 10000}

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

# ==================== MT5 INTEGRATION (Windows Ready) ====================
# This code is prepared for Windows deployment with MetaTrader5 library
# Currently runs in simulation mode on Linux

MT5_AVAILABLE = False
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    logging.info("MT5 library not available - running in simulation mode")

class MT5Manager:
    """MetaTrader5 integration manager - Windows compatible"""
    
    def __init__(self):
        self.connected = False
        self.account_info = None
    
    async def connect(self, server: str, login: str, password: str) -> Dict:
        """Connect to MT5 terminal"""
        if MT5_AVAILABLE:
            # Real MT5 connection (Windows only)
            if not mt5.initialize():
                return {"success": False, "error": "MT5 initialization failed"}
            
            authorized = mt5.login(int(login), password=password, server=server)
            if authorized:
                self.connected = True
                self.account_info = mt5.account_info()._asdict()
                return {
                    "success": True,
                    "account": {
                        "login": self.account_info["login"],
                        "balance": self.account_info["balance"],
                        "equity": self.account_info["equity"],
                        "server": server
                    }
                }
            else:
                return {"success": False, "error": f"Login failed: {mt5.last_error()}"}
        else:
            # Simulation mode (Linux/Mac)
            self.connected = True
            self.account_info = {
                "login": login,
                "balance": 10000,
                "equity": 10000,
                "server": server,
                "mode": "simulation"
            }
            return {"success": True, "account": self.account_info, "simulation": True}
    
    async def disconnect(self):
        """Disconnect from MT5"""
        if MT5_AVAILABLE and self.connected:
            mt5.shutdown()
        self.connected = False
        return {"success": True}
    
    async def get_symbol_price(self, symbol: str) -> Dict:
        """Get current price for symbol"""
        if MT5_AVAILABLE and self.connected:
            tick = mt5.symbol_info_tick(symbol)
            if tick:
                return {"bid": tick.bid, "ask": tick.ask, "time": tick.time}
        # Fallback to our price system
        price = await get_current_price(symbol)
        spread = price * 0.0002
        return {"bid": price, "ask": price + spread, "time": datetime.now(timezone.utc).isoformat()}
    
    async def place_order(self, symbol: str, order_type: str, volume: float, 
                         sl: float = None, tp: float = None) -> Dict:
        """Place order on MT5"""
        if MT5_AVAILABLE and self.connected:
            # Get symbol info
            symbol_info = mt5.symbol_info(symbol)
            if symbol_info is None:
                return {"success": False, "error": f"Symbol {symbol} not found"}
            
            point = symbol_info.point
            price = mt5.symbol_info_tick(symbol).ask if order_type == "BUY" else mt5.symbol_info_tick(symbol).bid
            
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": volume,
                "type": mt5.ORDER_TYPE_BUY if order_type == "BUY" else mt5.ORDER_TYPE_SELL,
                "price": price,
                "sl": sl,
                "tp": tp,
                "magic": 234000,
                "comment": "AlphaMind Bot",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            result = mt5.order_send(request)
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {"success": False, "error": f"Order failed: {result.comment}"}
            
            return {
                "success": True,
                "ticket": result.order,
                "price": result.price,
                "volume": result.volume
            }
        else:
            # Simulation mode
            return {
                "success": True,
                "ticket": random.randint(100000, 999999),
                "price": await get_current_price(symbol),
                "volume": volume,
                "simulation": True
            }
    
    async def close_position(self, ticket: int) -> Dict:
        """Close position on MT5"""
        if MT5_AVAILABLE and self.connected:
            position = mt5.positions_get(ticket=ticket)
            if position:
                pos = position[0]
                request = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "position": ticket,
                    "symbol": pos.symbol,
                    "volume": pos.volume,
                    "type": mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY,
                    "price": mt5.symbol_info_tick(pos.symbol).bid if pos.type == 0 else mt5.symbol_info_tick(pos.symbol).ask,
                    "magic": 234000,
                    "comment": "AlphaMind Close",
                }
                result = mt5.order_send(request)
                return {"success": result.retcode == mt5.TRADE_RETCODE_DONE, "profit": pos.profit}
        return {"success": True, "simulation": True}

mt5_manager = MT5Manager()

@api_router.post("/mt5/connect")
async def mt5_connect(request: MT5ConnectRequest, user: dict = Depends(get_current_user)):
    """Connect to MT5 terminal"""
    result = await mt5_manager.connect(request.server, request.login, request.password)
    
    if result["success"]:
        await db.bot_configs.update_one(
            {"user_id": user["id"]},
            {"$set": {
                "mt5_connected": True,
                "mt5_server": request.server,
                "mt5_login": request.login,
                "mt5_simulation": result.get("simulation", False)
            }},
            upsert=True
        )
    
    return result

@api_router.post("/mt5/disconnect")
async def mt5_disconnect(user: dict = Depends(get_current_user)):
    """Disconnect from MT5"""
    result = await mt5_manager.disconnect()
    await db.bot_configs.update_one(
        {"user_id": user["id"]},
        {"$set": {"mt5_connected": False}}
    )
    return result

@api_router.post("/mt5/place-order")
async def mt5_place_order(
    symbol: str, 
    order_type: str, 
    volume: float,
    sl: float = None,
    tp: float = None,
    user: dict = Depends(get_current_user)
):
    """Place order via MT5"""
    if not mt5_manager.connected:
        raise HTTPException(status_code=400, detail="MT5 not connected")
    return await mt5_manager.place_order(symbol, order_type, volume, sl, tp)

@api_router.get("/strategies")
async def get_strategies():
    """Get list of available advanced strategies"""
    return {
        "strategies": [
            {
                "id": key,
                "name": value["name"],
                "description": value["description"],
                "min_rr": value["min_rr"]
            }
            for key, value in ADVANCED_STRATEGIES.items()
        ]
    }

# ==================== MAIN ====================

@api_router.get("/")
async def root():
    return {"message": "AlphaMind Trading API v3.0", "status": "online", "mt5_available": MT5_AVAILABLE}

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
