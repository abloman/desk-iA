import { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { createChart, ColorType, LineStyle } from "lightweight-charts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("trading");

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch (e) {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, password, name) => {
    const res = await axios.post(`${API}/auth/register`, { email, password, name });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!token) {
    return <LoginPage login={login} register={register} />;
  }

  return (
    <AuthContext.Provider value={{ user, token, logout }}>
      <div className="min-h-screen bg-slate-950 text-white">
        <Header logout={logout} currentPage={currentPage} setCurrentPage={setCurrentPage} />
        {currentPage === "trading" && <TradingPage />}
        {currentPage === "performance" && <PerformancePage />}
        {currentPage === "settings" && <SettingsPage />}
      </div>
    </AuthContext.Provider>
  );
}

// ==================== LOGIN ====================
function LoginPage({ login, register }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-xl p-8 border border-slate-800">
        <h1 className="text-3xl font-bold text-blue-400 text-center mb-2">Alphamind</h1>
        <p className="text-slate-400 text-sm text-center mb-8">Assistant de trading IA</p>
        
        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? "Chargement..." : (isLogin ? "Connexion" : "Inscription")}
          </button>
        </form>
        
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-4 text-slate-400 text-sm hover:text-blue-400"
        >
          {isLogin ? "Créer un compte" : "Déjà un compte ?"}
        </button>
      </div>
    </div>
  );
}

// ==================== HEADER ====================
function Header({ logout, currentPage, setCurrentPage }) {
  return (
    <header className="flex items-center justify-between p-4 border-b border-slate-800">
      <div>
        <h1 className="text-2xl font-bold text-blue-400">Alphamind</h1>
        <p className="text-xs text-slate-500">Trading IA multi-marchés</p>
      </div>
      <nav className="flex gap-2">
        <button
          onClick={() => setCurrentPage("trading")}
          className={`px-4 py-2 rounded-lg text-sm ${currentPage === "trading" ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"}`}
        >
          Trading
        </button>
        <button
          onClick={() => setCurrentPage("performance")}
          className={`px-4 py-2 rounded-lg text-sm ${currentPage === "performance" ? "bg-emerald-600" : "bg-slate-800 hover:bg-slate-700"}`}
        >
          Performance
        </button>
        <button
          onClick={() => setCurrentPage("settings")}
          className={`px-4 py-2 rounded-lg text-sm ${currentPage === "settings" ? "bg-purple-600" : "bg-slate-800 hover:bg-slate-700"}`}
        >
          Paramètres
        </button>
        <button onClick={logout} className="px-4 py-2 rounded-lg text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30">
          Déconnexion
        </button>
      </nav>
    </header>
  );
}

// ==================== TRADING PAGE ====================
const MARKETS = {
  crypto: ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "ADA/USD"],
  forex: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF"],
  indices: ["US30", "US100", "US500", "GER40", "UK100"],
  metals: ["XAU/USD", "XAG/USD", "XPT/USD", "XPD/USD"],
  futures: ["ES", "NQ", "CL", "GC", "SI"],
};
const TIMEFRAMES = ["5min", "15min", "1h", "4h", "1d"];
const MODES = ["scalping", "intraday", "swing"];
const STRATEGIES = [
  { id: "smc_ict_advanced", name: "SMC/ICT Avancée" },
  { id: "market_structure", name: "Market Structure Avancé" },
  { id: "orderblock", name: "Order Block + Imbalances" },
  { id: "ma_advanced", name: "Moyenne Mobile Avancé" },
  { id: "opr", name: "OPR (Opening Range)" }
];

function TradingPage() {
  const [portfolio, setPortfolio] = useState({ balance: 10000, total_pnl: 0, win_rate: 0 });
  const [trades, setTrades] = useState([]);
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [market, setMarket] = useState("crypto");
  const [symbol, setSymbol] = useState("BTC/USD");
  const [timeframe, setTimeframe] = useState("15min");
  const [mode, setMode] = useState("intraday");
  const [strategy, setStrategy] = useState("smc_ict_advanced");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // Faster refresh for live PnL
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSymbol(MARKETS[market][0]);
  }, [market]);

  const fetchData = async () => {
    try {
      const [p, t] = await Promise.all([
        axios.get(`${API}/portfolio`),
        axios.get(`${API}/trades`)
      ]);
      setPortfolio(p.data);
      setTrades(t.data.trades || []);
    } catch (e) {
      console.error(e);
    }
  };

  const generateSignal = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await axios.post(`${API}/ai/analyze`, {
        symbol, timeframe, market_type: market, mode, strategy
      });
      if (res.data.analysis) {
        setSignal({
          symbol,
          timeframe,
          mode,
          strategy,
          side: res.data.analysis.signal,
          entry: res.data.analysis.entry_price,
          sl: res.data.analysis.stop_loss,
          tp: res.data.analysis.take_profit_1,
          tp2: res.data.analysis.take_profit_2,
          rr: res.data.analysis.rr_ratio,
          confidence: res.data.analysis.confidence,
          analysis: res.data.analysis.analysis,
          reasoning: res.data.analysis.reasoning
        });
        setMessage("Signal généré !");
      }
    } catch (e) {
      setMessage("Erreur: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const executeTrade = async () => {
    if (!signal) return;
    setLoading(true);
    try {
      await axios.post(`${API}/trades`, {
        symbol: signal.symbol,
        direction: signal.side,
        entry_price: signal.entry,
        quantity: 1,
        stop_loss: signal.sl,
        take_profit: signal.tp,
        strategy: signal.strategy
      });
      setMessage("Trade exécuté !");
      fetchData();
    } catch (e) {
      setMessage("Erreur: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const closeTrade = async (tradeId, type) => {
    try {
      let url = `${API}/trades/${tradeId}/close-at-market`;
      if (type === "sl") url = `${API}/trades/${tradeId}/close-sl`;
      if (type === "tp") url = `${API}/trades/${tradeId}/close-tp`;
      const res = await axios.post(url);
      setMessage(`Trade fermé: PnL ${res.data.pnl?.toFixed(2)}$`);
      fetchData();
    } catch (e) {
      setMessage("Erreur fermeture");
    }
  };

  const openTrades = trades.filter(t => t.status === "open");
  const floatingPnl = openTrades.reduce((s, t) => s + (t.floating_pnl || 0), 0);
  const tvSymbol = symbol.replace("/", "");

  const fmt = (n, d = 2) => Number(n)?.toFixed(d) || "-";

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Balance" value={`${fmt(portfolio.balance)}$`} color="text-sky-400" />
        <StatCard label="PnL Réalisé" value={`${fmt(portfolio.total_pnl)}$`} color={portfolio.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        <StatCard label="PnL Flottant" value={`${fmt(floatingPnl)}$`} color={floatingPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        <StatCard label="Winrate" value={`${fmt(portfolio.win_rate)}%`} color="text-blue-400" />
        <StatCard label="Trades" value={portfolio.total_trades || 0} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Chart with Entry/SL/TP Lines */}
        <div className="col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <TradingChartComponent 
            symbol={symbol} 
            signal={signal} 
            trades={openTrades}
          />
        </div>

        {/* Controls */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <h2 className="text-blue-400 font-semibold">Contrôles IA</h2>
          
          <Select label="Marché" value={market} onChange={setMarket} options={[
            {v: "crypto", l: "₿ Crypto"}, {v: "forex", l: "💱 Forex"}, {v: "indices", l: "📈 Indices"}, {v: "metals", l: "🥇 Métaux"}, {v: "futures", l: "📊 Futures"}
          ]} />
          <Select label="Symbole" value={symbol} onChange={setSymbol} options={MARKETS[market].map(s => ({v: s, l: s}))} />
          
          <div className="grid grid-cols-2 gap-2">
            <Select label="Timeframe" value={timeframe} onChange={setTimeframe} options={TIMEFRAMES.map(t => ({v: t, l: t}))} />
            <Select label="Mode" value={mode} onChange={setMode} options={MODES.map(m => ({v: m, l: m}))} />
          </div>
          
          <Select label="Stratégie" value={strategy} onChange={setStrategy} options={STRATEGIES.map(s => ({v: s.id, l: s.name}))} />

          <button
            onClick={generateSignal}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? "Génération..." : "🧠 Générer Signal"}
          </button>

          {message && <p className={`text-xs ${message.includes("Erreur") ? "text-red-400" : "text-emerald-400"}`}>{message}</p>}

          <button
            onClick={executeTrade}
            disabled={!signal || loading}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold disabled:opacity-50"
          >
            ✅ Exécuter Trade
          </button>

          {/* Signal Preview */}
          {signal && (
            <div className="p-3 bg-slate-800 rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold">{signal.symbol}</span>
                <span className={`px-2 py-0.5 rounded font-bold ${signal.side === "BUY" ? "bg-emerald-600" : "bg-red-600"}`}>
                  {signal.side}
                </span>
              </div>
              <div className="text-slate-400">{signal.timeframe} • {signal.mode} • {signal.strategy.toUpperCase()}</div>
              <div className="grid grid-cols-2 gap-1">
                <div>Entry: <span className="text-white">{fmt(signal.entry, 4)}</span></div>
                <div>SL: <span className="text-red-400">{fmt(signal.sl, 4)}</span></div>
                <div>TP: <span className="text-emerald-400">{fmt(signal.tp, 4)}</span></div>
                <div>RR: <span className="text-blue-400">{signal.rr}</span></div>
              </div>
              <div className="text-center text-amber-400">Confiance: {signal.confidence}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Open Trades */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-blue-400 font-semibold">Trades Ouverts ({openTrades.length})</h2>
          <span className={floatingPnl >= 0 ? "text-emerald-400" : "text-red-400"}>PnL: {fmt(floatingPnl)}$</span>
        </div>
        
        {openTrades.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucun trade ouvert</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2 text-left">Symbole</th>
                <th className="py-2 text-left">Side</th>
                <th className="py-2 text-right">Entry</th>
                <th className="py-2 text-right">Prix</th>
                <th className="py-2 text-right">SL</th>
                <th className="py-2 text-right">TP</th>
                <th className="py-2 text-right">PnL</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map(t => (
                <tr key={t.id} className="border-b border-slate-800">
                  <td className="py-2 font-semibold">{t.symbol}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.direction === "BUY" ? "bg-emerald-600" : "bg-red-600"}`}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">{fmt(t.entry_price, 4)}</td>
                  <td className="py-2 text-right font-mono text-white">{fmt(t.current_price, 4)}</td>
                  <td className="py-2 text-right font-mono text-red-400">{fmt(t.stop_loss, 4)}</td>
                  <td className="py-2 text-right font-mono text-emerald-400">{fmt(t.take_profit, 4)}</td>
                  <td className={`py-2 text-right font-mono font-bold ${(t.floating_pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmt(t.floating_pnl)}$
                  </td>
                  <td className="py-2 text-right space-x-1">
                    <button onClick={() => closeTrade(t.id, "market")} className="px-2 py-1 bg-blue-600 rounded text-xs">Market</button>
                    <button onClick={() => closeTrade(t.id, "sl")} className="px-2 py-1 bg-red-600 rounded text-xs">SL</button>
                    <button onClick={() => closeTrade(t.id, "tp")} className="px-2 py-1 bg-emerald-600 rounded text-xs">TP</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ==================== PERFORMANCE PAGE ====================
function PerformancePage() {
  const [portfolio, setPortfolio] = useState({});
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [p, t] = await Promise.all([
        axios.get(`${API}/portfolio`),
        axios.get(`${API}/trades`)
      ]);
      setPortfolio(p.data);
      setTrades(t.data.trades || []);
    } catch (e) {}
  };

  const closedTrades = trades.filter(t => t.status === "closed");
  const fmt = (n, d = 2) => Number(n)?.toFixed(d) || "-";

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Balance" value={`${fmt(portfolio.balance)}$`} color="text-sky-400" />
        <StatCard label="PnL Total" value={`${fmt(portfolio.total_pnl)}$`} color={portfolio.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        <StatCard label="Winrate" value={`${fmt(portfolio.win_rate)}%`} color="text-blue-400" />
        <StatCard label="Total Trades" value={portfolio.total_trades || 0} />
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h2 className="text-emerald-400 font-semibold mb-3">Historique des Trades</h2>
        {closedTrades.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucun trade clôturé</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2 text-left">Symbole</th>
                <th className="py-2 text-left">Side</th>
                <th className="py-2 text-right">Entry</th>
                <th className="py-2 text-right">Exit</th>
                <th className="py-2 text-right">PnL</th>
                <th className="py-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.map(t => (
                <tr key={t.id} className="border-b border-slate-800">
                  <td className="py-2 font-semibold">{t.symbol}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.direction === "BUY" ? "bg-emerald-600" : "bg-red-600"}`}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">{fmt(t.entry_price, 4)}</td>
                  <td className="py-2 text-right font-mono">{fmt(t.exit_price, 4)}</td>
                  <td className={`py-2 text-right font-mono font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmt(t.pnl)}$
                  </td>
                  <td className="py-2 text-right text-slate-400">
                    {t.closed_at ? new Date(t.closed_at).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ==================== SETTINGS PAGE ====================
function SettingsPage() {
  const [config, setConfig] = useState({
    enabled: false,
    risk_per_trade: 2,
    max_daily_trades: 10,
    mt5_connected: false
  });
  const [mt5, setMt5] = useState({ server: "", login: "", password: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API}/bot/config`);
      setConfig(res.data);
    } catch (e) {}
  };

  const saveConfig = async () => {
    try {
      await axios.post(`${API}/bot/config`, config);
      setMessage("Configuration sauvegardée");
    } catch (e) {
      setMessage("Erreur");
    }
  };

  const connectMT5 = async () => {
    try {
      await axios.post(`${API}/bot/connect-mt5`, mt5);
      setConfig({ ...config, mt5_connected: true, mt5_server: mt5.server });
      setMessage("MT5 connecté");
    } catch (e) {
      setMessage("Erreur connexion MT5");
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
        <h2 className="text-purple-400 font-semibold">Connexion MT5</h2>
        
        {config.mt5_connected ? (
          <div className="p-3 bg-emerald-900/30 border border-emerald-600/50 rounded-lg">
            <p className="text-emerald-400">✓ Connecté: {config.mt5_server}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              placeholder="Serveur (ex: ICMarkets-Demo)"
              value={mt5.server}
              onChange={(e) => setMt5({ ...mt5, server: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded"
            />
            <input
              placeholder="Login"
              value={mt5.login}
              onChange={(e) => setMt5({ ...mt5, login: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded"
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={mt5.password}
              onChange={(e) => setMt5({ ...mt5, password: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded"
            />
            <button onClick={connectMT5} className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold">
              Connecter MT5
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
        <h2 className="text-blue-400 font-semibold">Gestion du Risque</h2>
        
        <div>
          <label className="text-sm text-slate-400">Risque par trade: {config.risk_per_trade}%</label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={config.risk_per_trade}
            onChange={(e) => setConfig({ ...config, risk_per_trade: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400">Max trades/jour: {config.max_daily_trades}</label>
          <input
            type="range"
            min="1"
            max="20"
            value={config.max_daily_trades}
            onChange={(e) => setConfig({ ...config, max_daily_trades: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>

        <button onClick={saveConfig} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold">
          Sauvegarder
        </button>
        
        {message && <p className="text-emerald-400 text-sm">{message}</p>}
      </div>
    </div>
  );
}

// ==================== COMPONENTS ====================
function StatCard({ label, value, color = "text-white" }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm"
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

export default App;
