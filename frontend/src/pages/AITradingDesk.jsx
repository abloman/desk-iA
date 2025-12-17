import { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STRATEGY_TYPES = [
  "macd", "rsi", "breakout", "smc", "orderblock", "divergence",
  "momentum", "vwap", "liquidity", "range-break", "trend-follow", "reversal", "ict", "wyckoff"
];

const TIMEFRAMES = ["5min", "15min", "1h", "4h", "1d"];
const MODES = ["scalping", "intraday", "swing", "auto"];

const MARKET_OPTIONS = {
  crypto: ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "ADA/USD"],
  forex: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF"],
  indices: ["US30", "US100", "US500", "GER40", "UK100"],
  metals: ["XAU/USD", "XAG/USD", "XPT/USD", "XPD/USD"],
};

const fmt = (n, d = 2) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toFixed(d);
};

const confidenceColor = (c) => {
  const v = Number(c);
  if (!Number.isFinite(v)) return "text-slate-400";
  if (v >= 80) return "text-emerald-400";
  if (v >= 65) return "text-amber-300";
  return "text-rose-400";
};

const sideBadge = (side) => {
  const s = String(side || "").toUpperCase();
  if (s === "BUY") return "badge-buy";
  if (s === "SELL") return "badge-sell";
  return "badge-neutral";
};

const AITradingDesk = () => {
  const [signals, setSignals] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [openTrades, setOpenTrades] = useState([]);

  const [selectedTimeframe, setSelectedTimeframe] = useState("15min");
  const [selectedMode, setSelectedMode] = useState("intraday");
  const [selectedStrategy, setSelectedStrategy] = useState("smc");
  const [selectedMarket, setSelectedMarket] = useState("crypto");
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USD");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [markMsg, setMarkMsg] = useState("");

  const lastSignal = signals[0] || null;

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const list = MARKET_OPTIONS[selectedMarket];
    if (list && list.length > 0) setSelectedSymbol(list[0]);
  }, [selectedMarket]);

  const fetchData = async () => {
    try {
      const [portfolioRes, tradesRes, signalsRes] = await Promise.all([
        axios.get(`${API}/portfolio`),
        axios.get(`${API}/trades`),
        axios.get(`${API}/signals`)
      ]);
      setPortfolio(portfolioRes.data);
      setOpenTrades(tradesRes.data.trades.filter(t => t.status === 'open'));
      setSignals(signalsRes.data.signals || []);
    } catch (e) {
      console.error("Fetch error:", e);
    }
  };

  const generateSignal = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      setMarkMsg("");

      const res = await axios.post(`${API}/ai/analyze`, {
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        market_type: selectedMarket,
        mode: selectedMode,
        strategy: selectedStrategy
      });

      if (res.data.analysis) {
        const signal = {
          id: Date.now().toString(),
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          mode: selectedMode,
          strategy: selectedStrategy,
          side: res.data.analysis.signal || "NEUTRAL",
          entry: res.data.analysis.entry_price,
          sl: res.data.analysis.stop_loss,
          tp: res.data.analysis.take_profit_1,
          tp2: res.data.analysis.take_profit_2,
          rr: res.data.analysis.entry_price && res.data.analysis.stop_loss && res.data.analysis.take_profit_1
            ? Math.abs((res.data.analysis.take_profit_1 - res.data.analysis.entry_price) / (res.data.analysis.entry_price - res.data.analysis.stop_loss)).toFixed(2)
            : null,
          confidence: res.data.analysis.confidence || 50,
          qualityTier: res.data.analysis.confidence >= 80 ? "A" : res.data.analysis.confidence >= 65 ? "B" : "C",
          analysis: res.data.analysis.analysis || {},
          reasoning: res.data.analysis.reasoning,
          timestamp: new Date().toISOString()
        };
        setSignals(prev => [signal, ...prev]);
      }
    } catch (e) {
      setErrorMsg(e?.response?.data?.detail || "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  const markExecuted = async (signal) => {
    if (!signal) return;
    try {
      await axios.post(`${API}/trades`, {
        signal_id: signal.id,
        symbol: signal.symbol,
        direction: signal.side,
        entry_price: signal.entry,
        quantity: 1,
        stop_loss: signal.sl,
        take_profit: signal.tp
      });
      setMarkMsg("✅ Trade exécuté enregistré");
      fetchData();
    } catch (e) {
      setMarkMsg("Erreur lors de l'enregistrement");
    }
  };

  const closeTrade = async (trade) => {
    const exitPrice = prompt("Prix de sortie:", trade.entry_price);
    if (!exitPrice) return;
    try {
      await axios.post(`${API}/trades/${trade.id}/close?exit_price=${exitPrice}`);
      fetchData();
    } catch (e) {
      alert("Erreur lors de la fermeture");
    }
  };

  const tvSymbol = selectedSymbol.replace("/", "");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* TOP STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Winrate réel</p>
          <h2 className="text-3xl font-bold text-blue-300 mt-1">
            {fmt(portfolio?.win_rate)}%
          </h2>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">PnL réel total</p>
          <h2 className={`text-3xl font-bold mt-1 ${(portfolio?.total_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmt(portfolio?.total_pnl)}$
          </h2>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Trades exécutés</p>
          <h2 className="text-3xl font-bold mt-1">{portfolio?.total_trades || 0}</h2>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Balance</p>
          <h2 className="text-3xl font-bold text-sky-300 mt-1">
            {fmt(portfolio?.balance)}$
          </h2>
        </div>
      </div>

      {/* CHART + CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TradingView Chart */}
        <div className="lg:col-span-2 card-dark p-4">
          <p className="text-xs text-slate-400 mb-2">
            TradingView — <span className="text-sky-300 font-semibold">{tvSymbol}</span>
          </p>
          <div className="w-full h-[480px] bg-slate-900 rounded-lg overflow-hidden">
            <iframe
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${tvSymbol}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=1e293b&theme=dark&style=1&timezone=Europe%2FParis&withdateranges=1&showpopupbutton=1&studies=%5B%5D&locale=fr`}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="TradingView"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="card-dark p-4 space-y-4">
          <h2 className="text-sky-300 font-semibold text-sm">🧠 Contrôles IA</h2>

          <div className="space-y-3 text-xs">
            <div>
              <p className="text-slate-400 mb-1">Marché</p>
              <select
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                className="w-full rounded px-3 py-2"
              >
                <option value="crypto">Crypto</option>
                <option value="forex">Forex</option>
                <option value="indices">Indices</option>
                <option value="metals">Métaux</option>
              </select>
            </div>

            <div>
              <p className="text-slate-400 mb-1">Symbole</p>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full rounded px-3 py-2"
              >
                {(MARKET_OPTIONS[selectedMarket] || []).map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-slate-400 mb-1">Timeframe</p>
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="w-full rounded px-3 py-2"
                >
                  {TIMEFRAMES.map(tf => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Mode</p>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="w-full rounded px-3 py-2"
                >
                  {MODES.map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="text-slate-400 mb-1">Stratégie</p>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full rounded px-3 py-2"
              >
                {STRATEGY_TYPES.map(s => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={generateSignal}
            disabled={loading}
            className="w-full py-3 rounded-lg btn-primary text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Génération…" : "🧠 Générer un signal IA"}
          </button>

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

          <button
            onClick={() => markExecuted(lastSignal)}
            disabled={!lastSignal}
            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold disabled:opacity-40"
          >
            ✅ Marquer comme exécuté
          </button>

          {markMsg && <p className="text-xs text-emerald-300">{markMsg}</p>}

          {/* Last Signal Preview */}
          {lastSignal && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-200 font-semibold">{lastSignal.symbol}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sideBadge(lastSignal.side)}`}>
                  {lastSignal.side}
                </span>
              </div>
              <div className="text-slate-400">{lastSignal.timeframe} • {lastSignal.mode} • {lastSignal.strategy}</div>
              <div>Entry: <span className="font-mono text-slate-200">{fmt(lastSignal.entry, 4)}</span></div>
              <div>SL: <span className="font-mono text-rose-400">{fmt(lastSignal.sl, 4)}</span></div>
              <div>TP: <span className="font-mono text-emerald-400">{fmt(lastSignal.tp, 4)}</span></div>
              <div>RR: <span className="font-mono">{lastSignal.rr || "-"}</span></div>
              <div className={confidenceColor(lastSignal.confidence)}>
                Confiance: {lastSignal.confidence}/100 ({lastSignal.qualityTier})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OPEN TRADES */}
      <div className="card-dark p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-blue-300">Trades ouverts (PnL flottant)</h2>
          <button onClick={fetchData} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs">
            🔄 Refresh
          </button>
        </div>

        {openTrades.length === 0 ? (
          <p className="text-xs text-slate-400">Aucun trade ouvert.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 pr-2 text-left">Instrument</th>
                  <th className="py-2 pr-2 text-left">Side</th>
                  <th className="py-2 pr-2 text-right">Entry</th>
                  <th className="py-2 pr-2 text-right">SL</th>
                  <th className="py-2 pr-2 text-right">TP</th>
                  <th className="py-2 pr-2 text-right">Heure</th>
                  <th className="py-2 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map(t => (
                  <tr key={t.id} className="border-b border-slate-800/60 table-row-hover">
                    <td className="py-2 pr-2 font-semibold text-slate-200">{t.symbol}</td>
                    <td className="py-2 pr-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sideBadge(t.direction)}`}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{fmt(t.entry_price, 4)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{fmt(t.stop_loss, 4)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{fmt(t.take_profit, 4)}</td>
                    <td className="py-2 pr-2 text-right text-slate-400">
                      {new Date(t.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <button
                        onClick={() => closeTrade(t)}
                        className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                      >
                        Fermer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SIGNALS HISTORY */}
      <div className="card-dark p-5">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">
          Historique des signaux générés (session)
        </h2>

        {signals.length === 0 ? (
          <p className="text-xs text-slate-400">Aucun signal généré pour cette session.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="py-2 pr-2 text-left">Symbole</th>
                  <th className="py-2 pr-2 text-left">TF</th>
                  <th className="py-2 pr-2 text-left">Mode</th>
                  <th className="py-2 pr-2 text-left">Stratégie</th>
                  <th className="py-2 pr-2 text-left">Side</th>
                  <th className="py-2 pr-2 text-right">Entry</th>
                  <th className="py-2 pr-2 text-right">SL</th>
                  <th className="py-2 pr-2 text-right">TP</th>
                  <th className="py-2 pr-2 text-right">RR</th>
                  <th className="py-2 pr-2 text-right">Confiance</th>
                  <th className="py-2 pr-2 text-right">Heure</th>
                </tr>
              </thead>
              <tbody>
                {signals.slice(0, 20).map((s, i) => (
                  <tr key={s.id || i} className="border-b border-slate-800/50 table-row-hover">
                    <td className="py-2 pr-2 font-semibold text-slate-200">{s.symbol}</td>
                    <td className="py-2 pr-2 text-slate-300">{s.timeframe}</td>
                    <td className="py-2 pr-2 text-slate-300">{s.mode}</td>
                    <td className="py-2 pr-2 text-slate-300">{s.strategy}</td>
                    <td className="py-2 pr-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sideBadge(s.side || s.direction)}`}>
                        {(s.side || s.direction || "").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{fmt(s.entry || s.entry_price, 4)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{fmt(s.sl || s.stop_loss, 4)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{fmt(s.tp || s.take_profit_1, 4)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{s.rr || "-"}</td>
                    <td className={`py-2 pr-2 text-right font-semibold ${confidenceColor(s.confidence)}`}>
                      {s.confidence || "-"}/100
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-400">
                      {s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : new Date(s.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AITradingDesk;
