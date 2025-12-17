import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Bot as BotIcon, Power, Settings, Shield, 
  TrendingUp, AlertTriangle, Check, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Bot = () => {
  const [config, setConfig] = useState({
    enabled: false,
    risk_per_trade: 0.02,
    max_daily_trades: 10,
    allowed_markets: ["crypto", "forex", "stocks"],
    strategies: ["ICT", "SMC", "WYCKOFF"],
    auto_execute: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      toast.success("Configuration sauvegardée");
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const toggleMarket = (market) => {
    if (config.allowed_markets.includes(market)) {
      setConfig({
        ...config,
        allowed_markets: config.allowed_markets.filter(m => m !== market)
      });
    } else {
      setConfig({
        ...config,
        allowed_markets: [...config.allowed_markets, market]
      });
    }
  };

  const toggleStrategy = (strategy) => {
    if (config.strategies.includes(strategy)) {
      setConfig({
        ...config,
        strategies: config.strategies.filter(s => s !== strategy)
      });
    } else {
      setConfig({
        ...config,
        strategies: [...config.strategies, strategy]
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="bot-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Trading Bot</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bot semi-automatique avec confirmation manuelle
          </p>
        </div>
        <Button 
          onClick={saveConfig}
          disabled={saving}
          className="btn-trading"
          data-testid="save-config-btn"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Sauvegarder
        </Button>
      </div>

      {/* Main Status Card */}
      <Card className={`overflow-hidden ${config.enabled ? 'glow-border' : ''}`} data-testid="bot-status-card">
        <div className={`h-1 ${config.enabled ? 'bg-green-500' : 'bg-muted'}`}></div>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded flex items-center justify-center ${
                config.enabled ? 'bg-green-500/20' : 'bg-muted'
              }`}>
                <BotIcon className={`w-8 h-8 ${config.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold">
                  {config.enabled ? 'Bot Actif' : 'Bot Inactif'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {config.enabled 
                    ? 'Le bot analyse les marchés et vous propose des signaux'
                    : 'Activez le bot pour recevoir des signaux'}
                </p>
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
              data-testid="bot-toggle"
            />
          </div>

          {config.enabled && (
            <div className="mt-6 p-4 rounded bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-500">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">Mode Semi-Automatique Actif</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Les signaux seront générés automatiquement mais nécessitent votre confirmation pour être exécutés
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Management */}
        <Card data-testid="risk-config">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Gestion du Risque
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Risque par trade</label>
                <span className="font-mono text-sm text-primary">
                  {(config.risk_per_trade * 100).toFixed(1)}%
                </span>
              </div>
              <Slider
                value={[config.risk_per_trade * 100]}
                onValueChange={([value]) => setConfig({ ...config, risk_per_trade: value / 100 })}
                min={0.5}
                max={5}
                step={0.5}
                className="w-full"
                data-testid="risk-slider"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Pourcentage du capital risqué par trade
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Max trades/jour</label>
                <span className="font-mono text-sm text-primary">
                  {config.max_daily_trades}
                </span>
              </div>
              <Slider
                value={[config.max_daily_trades]}
                onValueChange={([value]) => setConfig({ ...config, max_daily_trades: value })}
                min={1}
                max={20}
                step={1}
                className="w-full"
                data-testid="max-trades-slider"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Nombre maximum de trades par jour
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Exécution automatique</label>
                  <p className="text-xs text-muted-foreground">
                    Exécuter les trades sans confirmation
                  </p>
                </div>
                <Switch
                  checked={config.auto_execute}
                  onCheckedChange={(checked) => setConfig({ ...config, auto_execute: checked })}
                  data-testid="auto-execute-toggle"
                />
              </div>
              {config.auto_execute && (
                <div className="mt-3 p-3 rounded bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-500">
                    Mode risqué : les trades seront exécutés automatiquement sans votre confirmation
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Markets & Strategies */}
        <Card data-testid="markets-strategies-config">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Marchés & Stratégies
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <label className="text-sm font-medium mb-3 block">Marchés autorisés</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'crypto', label: 'Crypto', color: 'orange' },
                  { id: 'forex', label: 'Forex', color: 'blue' },
                  { id: 'stocks', label: 'Actions', color: 'purple' }
                ].map((market) => (
                  <button
                    key={market.id}
                    onClick={() => toggleMarket(market.id)}
                    className={`p-3 rounded border transition-all ${
                      config.allowed_markets.includes(market.id)
                        ? `border-${market.color}-500/50 bg-${market.color}-500/10`
                        : 'border-border hover:border-muted-foreground'
                    }`}
                    data-testid={`market-${market.id}`}
                  >
                    <div className={`w-8 h-8 rounded mx-auto mb-2 flex items-center justify-center ${
                      config.allowed_markets.includes(market.id)
                        ? `bg-${market.color}-500/20`
                        : 'bg-muted'
                    }`}>
                      <TrendingUp className={`w-4 h-4 ${
                        config.allowed_markets.includes(market.id)
                          ? `text-${market.color}-500`
                          : 'text-muted-foreground'
                      }`} />
                    </div>
                    <p className="text-sm font-medium">{market.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Stratégies actives</label>
              <div className="space-y-3">
                {[
                  { id: 'ICT', name: 'ICT (Inner Circle Trader)', desc: 'Liquidity, FVG, Order Blocks' },
                  { id: 'SMC', name: 'SMC (Smart Money Concepts)', desc: 'Structure, BOS, CHOCH' },
                  { id: 'WYCKOFF', name: 'Wyckoff', desc: 'Accumulation, Distribution, Phases' }
                ].map((strategy) => (
                  <div
                    key={strategy.id}
                    className={`p-4 rounded border cursor-pointer transition-all ${
                      config.strategies.includes(strategy.id)
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                    onClick={() => toggleStrategy(strategy.id)}
                    data-testid={`strategy-${strategy.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{strategy.name}</p>
                        <p className="text-xs text-muted-foreground">{strategy.desc}</p>
                      </div>
                      <Checkbox checked={config.strategies.includes(strategy.id)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      <Card data-testid="bot-summary">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-muted-foreground">Configuration active:</span>
            <Badge variant="outline">
              {(config.risk_per_trade * 100).toFixed(1)}% risque
            </Badge>
            <Badge variant="outline">
              Max {config.max_daily_trades} trades/jour
            </Badge>
            {config.allowed_markets.map(m => (
              <Badge key={m} variant="secondary" className="capitalize">
                {m}
              </Badge>
            ))}
            {config.strategies.map(s => (
              <Badge key={s} className="bg-primary/20 text-primary">
                {s}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Bot;
