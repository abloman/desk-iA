import { useState, useEffect, useMemo } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmt = (n, d = 2) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toFixed(d);
};

const sideBadge = (side) => {
  const s = String(side || "").toUpperCase();
  if (s === "BUY") return "badge-buy";
  if (s === "SELL") return "badge-sell";
  return "badge-neutral";
};

const formatDateTime = (ts) => {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return "-";
  }
};

const Performance = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [portfolioRes, tradesRes] = await Promise.all([
        axios.get(`${API}/portfolio`),
        axios.get(`${API}/trades`)
      ]);
      setPortfolio(portfolioRes.data);
      setTrades(tradesRes.data.trades || []);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const openTrades = useMemo(() => trades.filter(t => t.status === 'open'), [trades]);
  const closedTrades = useMemo(() => trades.filter(t => t.status === 'closed'), [trades]);

  // Equity curve from closed trades
  const equityCurve = useMemo(() => {
    let equity = 10000;
    return closedTrades.map(t => {
      equity += (t.pnl || 0);
      return equity;
    });
  }, [closedTrades]);

  const equityPath = useMemo(() => {
    if (equityCurve.length < 2) return "";
    const min = Math.min(...equityCurve);
    const max = Math.max(...equityCurve);
    const range = max - min || 1;
    let d = "";
    equityCurve.forEach((val, idx) => {
      const x = (idx / (equityCurve.length - 1)) * 100;
      const yNorm = (val - min) / range;
      const y = 35 - yNorm * 30;
      d += `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)} `;
    });
    return d.trim();
  }, [equityCurve]);

  // Stats by strategy
  const statsByStrategy = useMemo(() => {
    const stats = {};
    closedTrades.forEach(t => {
      const strat = t.strategy || "unknown";
      if (!stats[strat]) stats[strat] = { trades: 0, profit: 0 };
      stats[strat].trades++;
      stats[strat].profit += (t.pnl || 0);
    });
    return Object.entries(stats)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.profit - a.profit);
  }, [closedTrades]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-blue-500/20" />
      </div>
    );
  }

  const winrate = portfolio?.win_rate || 0;
  const totalPnl = portfolio?.total_pnl || 0;
  const totalTrades = portfolio?.total_trades || 0;
  const lastEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1] : 10000;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* TOP STATS */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Winrate réel</p>
          <h2 className="text-3xl font-bold text-blue-300 mt-1">{fmt(winrate)}%</h2>
          <p className="text-[11px] text-slate-500 mt-2">Basé sur les trades clôturés.</p>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">PnL total</p>
          <h2 className={`text-3xl font-bold mt-1 ${totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmt(totalPnl)}$
          </h2>
          <p className="text-[11px] text-slate-500 mt-2">Somme du PnL réalisé.</p>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Trades</p>
          <h2 className="text-3xl font-bold mt-1">{totalTrades}</h2>
          <p className="text-[11px] text-slate-500 mt-2">{openTrades.length} ouvert(s)</p>
        </div>
        <div className="card-dark p-4">
          <p className="text-slate-400 text-xs">Equity</p>
          <h2 className={`text-3xl font-bold mt-1 ${lastEquity >= 10000 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmt(lastEquity)}$
          </h2>
          <p className="text-[11px] text-slate-500 mt-2">Dernier point equity.</p>
        </div>
      </section>

      {/* EQUITY CURVE */}
      <section className="card-dark p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">📈 Courbe d'equity</h2>
          <div className={`text-sm font-semibold ${lastEquity - 10000 >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {lastEquity - 10000 >= 0 ? "+" : ""}{fmt(lastEquity - 10000)}$
          </div>
        </div>
        {equityPath ? (
          <div className="w-full overflow-hidden">
            <svg viewBox="0 0 100 40" className="w-full h-28">
              <path d={equityPath} fill="none" stroke="currentColor" strokeWidth="1.8" className="text-emerald-400" />
            </svg>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Pas encore assez de données.</p>
        )}
      </section>

      {/* STRATEGY RANKING */}
      <section className="card-dark p-4">
        <h2 className="text-lg font-semibold mb-3">🧠 Classement des stratégies</h2>
        {statsByStrategy.length === 0 ? (
          <p className="text-xs text-slate-500">Pas encore assez de trades.</p>
        ) : (
          <div className="space-y-2">
            {statsByStrategy.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <div>
                  <p className="font-semibold text-sm uppercase">#{i + 1} • {s.name}</p>
                  <p className="text-[11px] text-slate-400">Trades: {s.trades}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${s.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fmt(s.profit)}$
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {s.profit >= 0 ? "Stratégie rentable" : "Stratégie en perte"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* OPEN TRADES */}
      <section className="card-dark p-4">
        <h2 className="text-lg font-semibold mb-3">📁 Trades ouverts (PnL flottant)</h2>
        {openTrades.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun trade ouvert</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-2 pr-2 text-left">Instrument</th>
                  <th className="py-2 pr-2 text-left">Side</th>
                  <th className="py-2 pr-2 text-right">Entry</th>
                  <th className="py-2 pr-2 text-right">SL</th>
                  <th className="py-2 pr-2 text-right">TP</th>
                  <th className="py-2 pr-2 text-right">Ouverture</th>
                  <th className="py-2 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map(t => (
                  <tr key={t.id} className="border-b border-slate-800/60 table-row-hover">
                    <td className="py-2 pr-2 font-semibold">{t.symbol}</td>
                    <td className="py-2 pr-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sideBadge(t.direction)}`}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">{fmt(t.entry_price, 4)}</td>
                    <td className="py-2 pr-2 text-right font-mono">{fmt(t.stop_loss, 4)}</td>
                    <td className="py-2 pr-2 text-right font-mono">{fmt(t.take_profit, 4)}</td>
                    <td className="py-2 pr-2 text-right text-slate-400">{formatDateTime(t.created_at)}</td>
                    <td className="py-2 pr-2 text-right">
                      <button onClick={() => closeTrade(t)} className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold">
                        Fermer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CLOSED TRADES HISTORY */}
      <section className="card-dark p-4">
        <h2 className="text-lg font-semibold mb-3">📄 Historique des trades</h2>
        {closedTrades.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun trade clôturé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-2 pr-2 text-left">Instrument</th>
                  <th className="py-2 pr-2 text-left">Side</th>
                  <th className="py-2 pr-2 text-right">Entry</th>
                  <th className="py-2 pr-2 text-right">Exit</th>
                  <th className="py-2 pr-2 text-right">PnL</th>
                  <th className="py-2 pr-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.slice(0, 20).map(t => (
                  <tr key={t.id} className="border-b border-slate-800/60 table-row-hover">
                    <td className="py-2 pr-2 font-semibold">{t.symbol}</td>
                    <td className="py-2 pr-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sideBadge(t.direction)}`}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">{fmt(t.entry_price, 4)}</td>
                    <td className="py-2 pr-2 text-right font-mono">{fmt(t.exit_price, 4)}</td>
                    <td className={`py-2 pr-2 text-right font-semibold ${(t.pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmt(t.pnl)}$
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-400">{formatDateTime(t.closed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Performance;
