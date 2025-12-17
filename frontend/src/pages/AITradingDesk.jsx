import { useState, useEffect, useRef } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STRATEGY_TYPES = [
  "smc", "ict", "wyckoff", "macd", "rsi", "breakout",
  "momentum", "vwap", "liquidity", "range-break", "trend-follow", "reversal"
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

const fmtPrice = (n, symbol) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  if (symbol?.includes("JPY")) return x.toFixed(3);
  if (symbol?.includes("EUR") || symbol?.includes("GBP") || symbol?.includes("AUD") || symbol?.includes("CHF")) return x.toFixed(5);
  if (x < 10) return x.toFixed(4);
  return x.toFixed(2);
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
  const iframeRef = useRef(null);

  // Auto-refresh every 5 seconds for live PnL
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
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
        const a = res.data.analysis;
        const signal = {
          id: Date.now().toString(),
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          mode: selectedMode,
          strategy: selectedStrategy,
          side: a.signal || "NEUTRAL",
          entry: a.entry_price,
          sl: a.stop_loss,
          tp: a.take_profit_1,
          tp2: a.take_profit_2,
          tp3: a.take_profit_3,
          rr: a.rr_ratio,
          confidence: a.confidence || 50,
          qualityTier: a.confidence >= 80 ? "A" : a.confidence >= 65 ? "B" : "C",
          analysis: a.analysis || {},
          reasoning: a.reasoning,
          timestamp: new Date().toISOString()
        };
        setSignals(prev => [signal, ...prev]);
        setMarkMsg("✅ Signal généré avec succès");
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
        take_profit: signal.tp,
        strategy: signal.strategy
      });
      setMarkMsg("✅ Trade enregistré");
      fetchData();
    } catch (e) {
      setMarkMsg("❌ Erreur lors de l'enregistrement");
    }
  };

  const closeTrade = async (trade, type = "market") => {
    try {
      let endpoint = `${API}/trades/${trade.id}/close`;
      if (type === "sl") endpoint = `${API}/trades/${trade.id}/close-sl`;
      else if (type === "tp") endpoint = `${API}/trades/${trade.id}/close-tp`;
      else if (type === "market") endpoint = `${API}/trades/${trade.id}/close-at-market`;
      
      const res = await axios.post(endpoint);
      setMarkMsg(`✅ Trade fermé: PnL ${fmt(res.data.pnl)}$`);
      fetchData();
    } catch (e) {
      setMarkMsg("❌ Erreur lors de la fermeture");
    }
  };

  const closeTradeManual = async (trade) => {
    const exitPrice = prompt("Prix de sortie:", trade.current_price || trade.entry_price);
    if (!exitPrice) return;
    try {
      const res = await axios.post(`${API}/trades/${trade.id}/close?exit_price=${exitPrice}`);
      setMarkMsg(`✅ Trade fermé: PnL ${fmt(res.data.pnl)}$`);
      fetchData();
    } catch (e) {
      setMarkMsg("❌ Erreur lors de la fermeture");
    }
  };

  // Calculate total floating PnL
  const totalFloatingPnl = openTrades.reduce((sum, t) => sum + (t.floating_pnl || 0), 0);

  // TradingView widget URL
  const tvSymbol = selectedSymbol.replace("/", "");
  
  // Build TradingView URL with levels if we have a signal
  let tvUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${tvSymbol}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=1e293b&theme=dark&style=1&timezone=Europe%2FParis&withdateranges=1&showpopupbutton=1&locale=fr`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* TOP STATS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Winrate</p>
          <h2 className="text-2xl font-bold text-blue-300 mt-1">
            {fmt(portfolio?.win_rate)}%
          </h2>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">PnL réalisé</p>
          <h2 className={`text-2xl font-bold mt-1 ${(portfolio?.total_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmt(portfolio?.total_pnl)}$
          </h2>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">PnL flottant</p>
          <h2 className={`text-2xl font-bold mt-1 ${totalFloatingPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmt(totalFloatingPnl)}$
          </h2>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Trades</p>
          <h2 className="text-2xl font-bold mt-1">{portfolio?.total_trades || 0}</h2>
          <p className="text-[10px] text-slate-500">{openTrades.length} ouvert(s)</p>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Balance</p>
          <h2 className="text-2xl font-bold text-sky-300 mt-1">
            {fmt(portfolio?.balance)}$
          </h2>
        </div>
      </div>

      {/* CHART + CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TradingView Chart */}
        <div className="lg:col-span-2 card-dark p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400">
              TradingView — <span className="text-sky-300 font-semibold">{tvSymbol}</span>
            </p>
            {lastSignal && (
              <div className="flex gap-2 text-[10px]">
                <span className="px-2 py-1 rounded bg-slate-800">Entry: {fmtPrice(lastSignal.entry, lastSignal.symbol)}</span>
                <span className="px-2 py-1 rounded bg-rose-900/50 text-rose-300">SL: {fmtPrice(lastSignal.sl, lastSignal.symbol)}</span>
                <span className="px-2 py-1 rounded bg-emerald-900/50 text-emerald-300">TP: {fmtPrice(lastSignal.tp, lastSignal.symbol)}</span>
              </div>
            )}
          </div>
          <div className="w-full h-[450px] bg-slate-900 rounded-lg overflow-hidden relative">
            <iframe
              ref={iframeRef}
              src={tvUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="TradingView"
            />
            {/* Overlay levels indicator */}
            {lastSignal && (
              <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] bg-slate-900/80 p-2 rounded">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-bold ${sideBadge(lastSignal.side)}`}>
                    {lastSignal.side}
                  </span>
                  <span className="text-slate-300">{lastSignal.symbol}</span>
                </div>
                <div className="flex gap-4">
                  <span>Entry: <span className="font-mono text-white">{fmtPrice(lastSignal.entry, lastSignal.symbol)}</span></span>
                  <span>SL: <span className="font-mono text-rose-400">{fmtPrice(lastSignal.sl, lastSignal.symbol)}</span></span>
                  <span>TP1: <span className="font-mono text-emerald-400">{fmtPrice(lastSignal.tp, lastSignal.symbol)}</span></span>
                  <span>RR: <span className="font-mono text-blue-300">{lastSignal.rr}</span></span>
                </div>
              </div>
            )}
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
                <option value="crypto">₿ Crypto</option>
                <option value="forex">💱 Forex</option>
                <option value="indices">📈 Indices</option>
                <option value="metals">🥇 Métaux</option>
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
            {loading ? "⏳ Génération…" : "🧠 Générer un signal IA"}
          </button>

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
          {markMsg && <p className="text-xs text-emerald-300">{markMsg}</p>}

          <button
            onClick={() => markExecuted(lastSignal)}
            disabled={!lastSignal}
            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold disabled:opacity-40"
          >
            ✅ Exécuter le trade
          </button>

          {/* Last Signal Preview */}
          {lastSignal && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-200 font-semibold">{lastSignal.symbol}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sideBadge(lastSignal.side)}`}>
                  {lastSignal.side}
                </span>
              </div>
              <div className="text-slate-400">{lastSignal.timeframe} • {lastSignal.mode} • {lastSignal.strategy.toUpperCase()}</div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div>Entry: <span className="font-mono text-white">{fmtPrice(lastSignal.entry, lastSignal.symbol)}</span></div>
                <div>SL: <span className="font-mono text-rose-400">{fmtPrice(lastSignal.sl, lastSignal.symbol)}</span></div>
                <div>TP1: <span className="font-mono text-emerald-400">{fmtPrice(lastSignal.tp, lastSignal.symbol)}</span></div>
                <div>RR: <span className="font-mono text-blue-300">{lastSignal.rr}</span></div>
              </div>
              <div className={`text-center pt-2 ${confidenceColor(lastSignal.confidence)}`}>
                Confiance: {lastSignal.confidence}/100 ({lastSignal.qualityTier})
              </div>
              {lastSignal.analysis?.name && (
                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                  <p className="font-semibold text-slate-300">{lastSignal.analysis.name}</p>
                  {lastSignal.analysis.structure && <p>• {lastSignal.analysis.structure}</p>}
                  {lastSignal.analysis.poi && <p>• {lastSignal.analysis.poi}</p>}
                  {lastSignal.analysis.fvg && <p>• {lastSignal.analysis.fvg}</p>}
                  {lastSignal.analysis.phase && <p>• {lastSignal.analysis.phase}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* OPEN TRADES WITH LIVE PNL */}
      <div className="card-dark p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-blue-300">
            Trades ouverts 
            <span className={`ml-2 text-sm ${totalFloatingPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              (PnL: {fmt(totalFloatingPnl)}$)
            </span>
          </h2>
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
                  <th className="py-2 pr-2 text-right">Prix actuel</th>
                  <th className="py-2 pr-2 text-right">SL</th>
                  <th className="py-2 pr-2 text-right">TP</th>
                  <th className="py-2 pr-2 text-right">PnL</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
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
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{fmtPrice(t.entry_price, t.symbol)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-white">{fmtPrice(t.current_price, t.symbol)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-rose-400">{fmtPrice(t.stop_loss, t.symbol)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-emerald-400">{fmtPrice(t.take_profit, t.symbol)}</td>
                    <td className={`py-2 pr-2 text-right font-mono font-bold ${(t.floating_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmt(t.floating_pnl)}$
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => closeTrade(t, "market")}
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold"
                          title="Fermer au prix du marché"
                        >
                          Market
                        </button>
                        <button
                          onClick={() => closeTrade(t, "sl")}
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold"
                          title="Fermer au SL"
                        >
                          SL
                        </button>
                        <button
                          onClick={() => closeTrade(t, "tp")}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold"
                          title="Fermer au TP"
                        >
                          TP
                        </button>
                        <button
                          onClick={() => closeTradeManual(t)}
                          className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-semibold"
                          title="Prix manuel"
                        >
                          Manuel
                        </button>
                      </div>
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
          Signaux générés (session)
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
                  <th className="py-2 pr-2 text-left">Stratégie</th>
                  <th className="py-2 pr-2 text-left">Side</th>
                  <th className="py-2 pr-2 text-right">Entry</th>
                  <th className="py-2 pr-2 text-right">SL</th>
                  <th className="py-2 pr-2 text-right">TP</th>
                  <th className="py-2 pr-2 text-right">RR</th>
                  <th className="py-2 pr-2 text-right">Conf.</th>
                  <th className="py-2 pr-2 text-right">Heure</th>
                </tr>
              </thead>
              <tbody>
                {signals.slice(0, 15).map((s, i) => (
                  <tr key={s.id || i} className="border-b border-slate-800/50 table-row-hover">
                    <td className="py-2 pr-2 font-semibold text-slate-200">{s.symbol}</td>
                    <td className="py-2 pr-2 text-slate-300">{s.timeframe}</td>
                    <td className="py-2 pr-2 text-slate-300 uppercase">{s.strategy}</td>
                    <td className="py-2 pr-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sideBadge(s.side || s.direction)}`}>
                        {(s.side || s.direction || "").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{fmtPrice(s.entry || s.entry_price, s.symbol)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-rose-400">{fmtPrice(s.sl || s.stop_loss, s.symbol)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-emerald-400">{fmtPrice(s.tp || s.take_profit_1, s.symbol)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-blue-300">{s.rr || "-"}</td>
                    <td className={`py-2 pr-2 text-right font-semibold ${confidenceColor(s.confidence)}`}>
                      {s.confidence || "-"}%
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
