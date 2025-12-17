import { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RiskSettings = () => {
  const [config, setConfig] = useState({
    enabled: false,
    risk_per_trade: 0.02,
    max_daily_trades: 10,
    allowed_markets: ["crypto", "forex", "indices", "metals"],
    strategies: ["smc", "ict", "wyckoff", "macd"],
    auto_execute: false,
    mt5_connected: false,
    mt5_server: null,
    mt5_login: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  
  // MT5 form
  const [mt5Form, setMt5Form] = useState({ server: "", login: "", password: "" });
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API}/bot/config`);
      setConfig(res.data);
    } catch (e) {
      console.error("Config fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/bot/config`, config);
      setMessage("✅ Configuration sauvegardée");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setMessage("❌ Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const connectMT5 = async () => {
    if (!mt5Form.server || !mt5Form.login || !mt5Form.password) {
      setMessage("❌ Veuillez remplir tous les champs MT5");
      return;
    }
    setConnecting(true);
    try {
      await axios.post(`${API}/bot/connect-mt5`, mt5Form);
      setConfig({ ...config, mt5_connected: true, mt5_server: mt5Form.server, mt5_login: mt5Form.login });
      setMt5Form({ server: "", login: "", password: "" });
      setMessage("✅ Connexion MT5 établie");
    } catch (e) {
      setMessage("❌ Erreur de connexion MT5");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectMT5 = async () => {
    try {
      await axios.post(`${API}/bot/disconnect-mt5`);
      setConfig({ ...config, mt5_connected: false, mt5_server: null, mt5_login: null });
      setMessage("✅ MT5 déconnecté");
    } catch (e) {
      setMessage("❌ Erreur lors de la déconnexion");
    }
  };

  const toggleMarket = (market) => {
    if (config.allowed_markets.includes(market)) {
      setConfig({ ...config, allowed_markets: config.allowed_markets.filter(m => m !== market) });
    } else {
      setConfig({ ...config, allowed_markets: [...config.allowed_markets, market] });
    }
  };

  const toggleStrategy = (strategy) => {
    if (config.strategies.includes(strategy)) {
      setConfig({ ...config, strategies: config.strategies.filter(s => s !== strategy) });
    } else {
      setConfig({ ...config, strategies: [...config.strategies, strategy] });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-blue-500/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-purple-400">⚙️ Paramètres IA & Risque</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure le capital, le risque par trade, et la connexion MT5
          </p>
        </div>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-4 py-2 rounded-lg btn-primary text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Sauvegarde…" : "💾 Sauvegarder"}
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes("✅") ? "bg-emerald-600/20 text-emerald-300" : "bg-rose-600/20 text-rose-300"}`}>
          {message}
        </div>
      )}

      {/* MT5 CONNECTION */}
      <section className="card-dark p-5">
        <h2 className="text-lg font-semibold text-purple-300 mb-4">🔗 Connexion MetaTrader 5</h2>
        
        {config.mt5_connected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-600/10 border border-emerald-600/30">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold">Connexion Active</span>
              </div>
              <p className="text-sm text-slate-300">Serveur: {config.mt5_server}</p>
              <p className="text-sm text-slate-300">Login: {config.mt5_login}</p>
            </div>
            <button
              onClick={disconnectMT5}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-semibold"
            >
              Déconnecter MT5
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Connectez votre compte MT5 pour exécuter les trades automatiquement.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Serveur MT5</label>
                <input
                  type="text"
                  placeholder="Ex: ICMarkets-Demo"
                  value={mt5Form.server}
                  onChange={(e) => setMt5Form({ ...mt5Form, server: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Login</label>
                <input
                  type="text"
                  placeholder="Numéro de compte"
                  value={mt5Form.login}
                  onChange={(e) => setMt5Form({ ...mt5Form, login: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={mt5Form.password}
                  onChange={(e) => setMt5Form({ ...mt5Form, password: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={connectMT5}
              disabled={connecting}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-semibold disabled:opacity-50"
            >
              {connecting ? "Connexion…" : "🔗 Connecter MT5"}
            </button>
          </div>
        )}
      </section>

      {/* BOT STATUS */}
      <section className="card-dark p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-blue-300">🤖 Statut du Bot</h2>
          <button
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              config.enabled 
                ? 'bg-emerald-600 hover:bg-emerald-500' 
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {config.enabled ? "✅ Bot Actif" : "Bot Inactif"}
          </button>
        </div>
        
        {config.enabled && (
          <div className="p-3 rounded-lg bg-emerald-600/10 border border-emerald-600/30 text-sm text-emerald-300">
            Le bot analyse les marchés et génère des signaux. Mode semi-automatique actif.
          </div>
        )}
      </section>

      {/* RISK MANAGEMENT */}
      <section className="card-dark p-5">
        <h2 className="text-lg font-semibold text-blue-300 mb-4">📊 Gestion du Risque</h2>
        
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">Risque par trade</label>
              <span className="font-mono text-blue-300">{(config.risk_per_trade * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={config.risk_per_trade * 100}
              onChange={(e) => setConfig({ ...config, risk_per_trade: parseFloat(e.target.value) / 100 })}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-1">Pourcentage du capital risqué par trade</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">Max trades par jour</label>
              <span className="font-mono text-blue-300">{config.max_daily_trades}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={config.max_daily_trades}
              onChange={(e) => setConfig({ ...config, max_daily_trades: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
            <div>
              <p className="text-sm font-medium">Exécution automatique</p>
              <p className="text-xs text-slate-400">Exécuter les trades sans confirmation</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, auto_execute: !config.auto_execute })}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                config.auto_execute 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {config.auto_execute ? "Activé ⚠️" : "Désactivé"}
            </button>
          </div>
        </div>
      </section>

      {/* MARKETS */}
      <section className="card-dark p-5">
        <h2 className="text-lg font-semibold text-blue-300 mb-4">🌍 Marchés autorisés</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["crypto", "forex", "indices", "metals"].map(market => (
            <button
              key={market}
              onClick={() => toggleMarket(market)}
              className={`p-3 rounded-lg border text-sm font-medium capitalize ${
                config.allowed_markets.includes(market)
                  ? 'bg-blue-600/20 border-blue-600 text-blue-200'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {market === 'crypto' && '₿ '}
              {market === 'forex' && '💱 '}
              {market === 'indices' && '📈 '}
              {market === 'metals' && '🥇 '}
              {market}
            </button>
          ))}
        </div>
      </section>

      {/* STRATEGIES */}
      <section className="card-dark p-5">
        <h2 className="text-lg font-semibold text-blue-300 mb-4">🧠 Stratégies actives</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {["smc", "ict", "wyckoff", "macd", "rsi", "breakout", "vwap", "momentum"].map(strategy => (
            <button
              key={strategy}
              onClick={() => toggleStrategy(strategy)}
              className={`p-2 rounded-lg border text-xs font-medium uppercase ${
                config.strategies.includes(strategy)
                  ? 'bg-purple-600/20 border-purple-600 text-purple-200'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {strategy}
            </button>
          ))}
        </div>
      </section>

      {/* SUMMARY */}
      <section className="card-dark p-4">
        <h3 className="text-sm font-semibold text-slate-400 mb-2">Configuration actuelle</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-slate-800">{(config.risk_per_trade * 100).toFixed(1)}% risque</span>
          <span className="px-2 py-1 rounded bg-slate-800">Max {config.max_daily_trades} trades/jour</span>
          {config.allowed_markets.map(m => (
            <span key={m} className="px-2 py-1 rounded bg-blue-600/20 text-blue-200 capitalize">{m}</span>
          ))}
          {config.strategies.map(s => (
            <span key={s} className="px-2 py-1 rounded bg-purple-600/20 text-purple-200 uppercase">{s}</span>
          ))}
          {config.mt5_connected && (
            <span className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-200">MT5 ✓</span>
          )}
        </div>
      </section>
    </div>
  );
};

export default RiskSettings;
