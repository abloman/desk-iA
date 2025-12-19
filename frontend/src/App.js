import { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { createChart, ColorType, LineSeries, CandlestickSeries } from "lightweight-charts";

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
        const a = res.data.analysis;
        setSignal({
          symbol,
          timeframe,
          mode,
          strategy,
          direction: a.signal,
          current_price: a.current_price,
          optimal_entry: a.optimal_entry,
          entry_type: a.entry_type,  // LIMIT or MARKET
          sl: a.stop_loss,
          tp: a.take_profit_1,
          tp2: a.take_profit_2,
          tp3: a.take_profit_3,
          rr: a.rr_ratio,
          sl_distance: a.sl_distance,
          tp_distance: a.tp_distance,
          confidence: a.confidence,
          analysis: a.analysis,  // Contains structure, BOS, OB data
          reasoning: a.reasoning
        });
        const entryType = a.entry_type === "LIMIT" ? "Entrée optimale recommandée" : "Entrée au marché";
        setMessage(`Signal généré ! ${entryType}`);
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
      // Get REAL current market price from Yahoo Finance
      const priceRes = await axios.get(`${API}/real-price/${signal.symbol}`);
      const marketPrice = priceRes.data.price;
      
      // Recalculate SL based on mode (scalping = tighter SL)
      const slDistance = Math.abs(signal.optimal_entry - signal.sl);
      const slMultiplier = mode === "scalping" ? 0.5 : mode === "intraday" ? 0.8 : 1.0;
      const adjustedSL = signal.direction === "BUY" 
        ? marketPrice - (slDistance * slMultiplier)
        : marketPrice + (slDistance * slMultiplier);
      
      await axios.post(`${API}/trades`, {
        symbol: signal.symbol,
        direction: signal.direction,
        entry_price: marketPrice,  // ALWAYS current market price
        quantity: 1,
        stop_loss: adjustedSL,     // SL adjusted for mode
        take_profit: signal.tp,
        strategy: signal.strategy
      });
      
      const modeText = mode === "scalping" ? "(SL serré)" : "";
      setMessage(`Trade exécuté @ ${marketPrice.toFixed(2)} ${modeText}`);
      setSignal(null); // Clear signal after execution
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
        {/* Real Chart with Yahoo Finance Data + Lines */}
        <div className="col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <TradingChartComponent 
            symbol={symbol} 
            trades={trades}
            signal={signal ? {
              direction: signal.direction,
              current_price: signal.current_price,
              optimal_entry: signal.optimal_entry,
              entry_type: signal.entry_type,
              sl: signal.sl,
              tp: signal.tp,
              rr: signal.rr
            } : null}
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

          {/* Signal Summary */}
          {signal && (
            <div className="p-3 bg-slate-800 rounded-lg text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{signal.symbol}</span>
                <span className={`px-2 py-0.5 rounded font-bold ${signal.direction === "BUY" ? "bg-emerald-600" : "bg-red-600"}`}>
                  {signal.direction}
                </span>
              </div>
              <div className="text-slate-400 text-[10px]">{signal.timeframe} • {signal.mode} • {signal.strategy}</div>
              
              {/* Key Levels */}
              <div className="py-2 border-y border-slate-700 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-blue-400">Entrée:</span>
                  <span className="text-blue-400 font-mono font-bold">{fmt(signal.optimal_entry, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">SL:</span>
                  <span className="text-red-400 font-mono">{fmt(signal.sl, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-400">TP:</span>
                  <span className="text-emerald-400 font-mono">{fmt(signal.tp, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-400">RR:</span>
                  <span className="text-yellow-400 font-bold">{signal.rr}:1</span>
                </div>
              </div>
              
              <div className="text-center text-amber-400 font-bold">
                Confiance: {signal.confidence}%
              </div>
              
              <div className="text-[9px] text-slate-500 text-center">
                Exécution au prix marché actuel
              </div>
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
                  <td className="py-2 text-right">
                    <button onClick={() => closeTrade(t.id, "market")} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold">
                      Fermer
                    </button>
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
  const [equityData, setEquityData] = useState([]);
  const [strategyStats, setStrategyStats] = useState([]);
  const [clearing, setClearing] = useState(false);
  const equityChartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [p, t, eq, strats] = await Promise.all([
        axios.get(`${API}/portfolio`),
        axios.get(`${API}/trades`),
        axios.get(`${API}/portfolio/equity-curve`),
        axios.get(`${API}/portfolio/strategy-stats`)
      ]);
      setPortfolio(p.data);
      setTrades(t.data.trades || []);
      setEquityData(eq.data.equity_curve || []);
      setStrategyStats(strats.data.strategy_stats || []);
    } catch (e) {}
  };

  // Equity Chart
  useEffect(() => {
    if (!equityChartRef.current || equityData.length === 0) return;
    
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
    }

    const chart = createChart(equityChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: equityChartRef.current.clientWidth,
      height: 250,
      rightPriceScale: { borderColor: '#334155' },
      timeScale: { borderColor: '#334155', timeVisible: true, localization: { locale: 'fr-FR' } },
      localization: { locale: 'fr-FR' },
    });
    chartInstanceRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.4)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
      lineWidth: 2,
    });

    const data = equityData.map((d, i) => ({
      time: Math.floor(new Date(d.timestamp).getTime() / 1000),
      value: d.equity
    }));
    
    if (data.length > 0) {
      areaSeries.setData(data);
      chart.timeScale().fitContent();
    }

    return () => chart.remove();
  }, [equityData]);

  const clearHistory = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir effacer tout l'historique ?")) return;
    setClearing(true);
    try {
      await axios.delete(`${API}/portfolio/clear-history`);
      fetchData();
    } catch (e) {}
    setClearing(false);
  };

  const closedTrades = trades.filter(t => t.status === "closed");
  const fmt = (n, d = 2) => Number(n)?.toFixed(d) || "-";

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Balance" value={`${fmt(portfolio.balance)}$`} color="text-sky-400" />
        <StatCard label="PnL Total" value={`${fmt(portfolio.total_pnl)}$`} color={portfolio.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        <StatCard label="Winrate" value={`${fmt(portfolio.win_rate)}%`} color="text-blue-400" />
        <StatCard label="Total Trades" value={portfolio.total_trades || 0} />
      </div>

      {/* Equity Curve */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-blue-400 font-semibold">📈 Courbe d'Equity</h2>
          <button 
            onClick={clearHistory}
            disabled={clearing}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-semibold disabled:opacity-50"
          >
            {clearing ? "..." : "🗑️ Effacer historique"}
          </button>
        </div>
        {equityData.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Aucun trade clôturé pour afficher la courbe</p>
        ) : (
          <div ref={equityChartRef} className="w-full" />
        )}
      </div>

      {/* Strategy Rankings */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h2 className="text-purple-400 font-semibold mb-3">🏆 Classement par Stratégie</h2>
        {strategyStats.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucune donnée de stratégie</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {strategyStats.map((s, idx) => (
              <div key={s.strategy} className="bg-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "📊"} {s.strategy_name}</span>
                  <span className={`text-sm font-bold ${s.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.total_pnl >= 0 ? "+" : ""}{fmt(s.total_pnl)}$
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>Trades: <span className="text-white">{s.total_trades}</span></div>
                  <div>Winrate: <span className="text-blue-400">{fmt(s.win_rate)}%</span></div>
                  <div>Avg PnL: <span className={s.avg_pnl >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(s.avg_pnl)}$</span></div>
                  <div>Max Win: <span className="text-emerald-400">{fmt(s.max_win)}$</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h2 className="text-emerald-400 font-semibold mb-3">📋 Historique des Trades</h2>
        {closedTrades.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucun trade clôturé</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2 text-left">Symbole</th>
                <th className="py-2 text-left">Side</th>
                <th className="py-2 text-left">Stratégie</th>
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
                  <td className="py-2 text-slate-400 text-xs">{t.strategy || "-"}</td>
                  <td className="py-2 text-right font-mono">{fmt(t.entry_price, 4)}</td>
                  <td className="py-2 text-right font-mono">{fmt(t.exit_price, 4)}</td>
                  <td className={`py-2 text-right font-mono font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {t.pnl >= 0 ? "+" : ""}{fmt(t.pnl)}$
                  </td>
                  <td className="py-2 text-right text-slate-400 text-xs">
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

// ==================== LIGHTWEIGHT CHART WITH YAHOO FINANCE ====================
function TradingChartComponent({ symbol, signal, trades = [], onPriceUpdate }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const linesRef = useRef([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch real OHLC data from Yahoo Finance via backend
  const fetchChartData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/chart-data/${symbol}?period=5d&interval=15m`);
      return res.data;
    } catch (e) {
      console.error("Chart data error:", e);
      return null;
    }
  }, [symbol]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: chartContainerRef.current.clientWidth,
      height: 420,
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#334155', scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });
    seriesRef.current = series;

    // Load data
    const loadData = async () => {
      setLoading(true);
      const data = await fetchChartData();
      if (data && data.data && data.data.length > 0) {
        const candles = data.data.map(d => ({
          time: Math.floor(d.time / 1000),
          open: d.open, high: d.high, low: d.low, close: d.close
        }));
        series.setData(candles);
        chart.timeScale().fitContent();
        setCurrentPrice(data.current_price);
        if (onPriceUpdate) onPriceUpdate(data.current_price);
      }
      setLoading(false);
    };
    loadData();

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, fetchChartData, onPriceUpdate]);

  // Draw horizontal lines for signal and trades
  useEffect(() => {
    if (!seriesRef.current) return;

    // Remove old lines
    linesRef.current.forEach(line => {
      try { seriesRef.current.removePriceLine(line); } catch(e) {}
    });
    linesRef.current = [];

    // Draw signal lines
    if (signal) {
      if (signal.optimal_entry) {
        linesRef.current.push(seriesRef.current.createPriceLine({
          price: signal.optimal_entry, color: '#3b82f6', lineWidth: 2,
          lineStyle: 0, axisLabelVisible: true, title: 'ENTRY',
        }));
      }
      if (signal.sl) {
        linesRef.current.push(seriesRef.current.createPriceLine({
          price: signal.sl, color: '#ef4444', lineWidth: 2,
          lineStyle: 2, axisLabelVisible: true, title: 'SL',
        }));
      }
      if (signal.tp) {
        linesRef.current.push(seriesRef.current.createPriceLine({
          price: signal.tp, color: '#10b981', lineWidth: 2,
          lineStyle: 2, axisLabelVisible: true, title: 'TP',
        }));
      }
    }

    // Draw lines for open trades
    trades.filter(t => t.status === 'open' && t.symbol === symbol).forEach(trade => {
      linesRef.current.push(seriesRef.current.createPriceLine({
        price: trade.entry_price, color: trade.direction === 'BUY' ? '#22c55e' : '#f97316',
        lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: `${trade.direction}`,
      }));
      if (trade.stop_loss) {
        linesRef.current.push(seriesRef.current.createPriceLine({
          price: trade.stop_loss, color: '#ef4444', lineWidth: 1, lineStyle: 2, title: 'SL',
        }));
      }
      if (trade.take_profit) {
        linesRef.current.push(seriesRef.current.createPriceLine({
          price: trade.take_profit, color: '#10b981', lineWidth: 1, lineStyle: 2, title: 'TP',
        }));
      }
    });
  }, [signal, trades, symbol]);

  const fmt = (n) => n ? (n < 10 ? n.toFixed(4) : n.toFixed(2)) : '-';

  return (
    <div className="relative w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{symbol}</span>
          <span className="text-xs text-slate-500">Yahoo Finance</span>
          {currentPrice && <span className="text-xl font-mono text-sky-400">{fmt(currentPrice)}</span>}
        </div>
        {loading && <span className="text-xs text-slate-500">Chargement...</span>}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full rounded-lg border border-slate-700" />

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-[10px] text-slate-400">
        <span>🟢 Bullish</span> <span>🔴 Bearish</span>
        <span className="text-blue-400">━ Entry</span>
        <span className="text-red-400">┈ SL</span>
        <span className="text-emerald-400">┈ TP</span>
      </div>

      {/* Signal Panel */}
      {signal && (
        <div className="mt-3 p-3 bg-slate-800/80 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded font-bold text-sm ${signal.direction === "BUY" ? "bg-emerald-600" : "bg-red-600"}`}>
                {signal.direction}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs ${signal.entry_type === "LIMIT" ? "bg-amber-600" : "bg-blue-600"}`}>
                {signal.entry_type === "LIMIT" ? "📍 Limite" : "⚡ Marché"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div><span className="text-slate-500 text-xs">Actuel:</span> <span className="font-mono text-white">{fmt(signal.current_price)}</span></div>
              <div><span className="text-blue-400 text-xs">Optimal:</span> <span className="font-mono text-blue-400 font-bold">{fmt(signal.optimal_entry)}</span></div>
              <div><span className="text-red-400 text-xs">SL:</span> <span className="font-mono text-red-400">{fmt(signal.sl)}</span></div>
              <div><span className="text-emerald-400 text-xs">TP:</span> <span className="font-mono text-emerald-400">{fmt(signal.tp)}</span></div>
              <div><span className="text-yellow-400 text-xs">RR:</span> <span className="font-mono text-yellow-400 font-bold">{signal.rr?.toFixed(1)}:1</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
