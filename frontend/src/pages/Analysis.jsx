import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { 
  Brain, Search, Loader2, TrendingUp, TrendingDown, 
  Target, ShieldAlert, Zap, BarChart3, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Analysis = () => {
  const [searchParams] = useSearchParams();
  const initialSymbol = searchParams.get('symbol') || '';
  
  const [symbol, setSymbol] = useState(initialSymbol);
  const [marketType, setMarketType] = useState("crypto");
  const [timeframe, setTimeframe] = useState("1h");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const popularSymbols = {
    crypto: ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD"],
    forex: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"],
    stocks: ["AAPL", "GOOGL", "MSFT", "TSLA"]
  };

  const analyzeSymbol = async () => {
    if (!symbol) {
      toast.error("Veuillez entrer un symbole");
      return;
    }
    
    setLoading(true);
    setAnalysis(null);
    
    try {
      const res = await axios.post(`${API}/ai/analyze`, {
        symbol,
        timeframe,
        market_type: marketType
      });
      setAnalysis(res.data);
      setHistory([res.data, ...history.slice(0, 4)]);
      toast.success("Analyse terminée");
    } catch (e) {
      toast.error("Erreur lors de l'analyse");
      console.error("Analysis error:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return "N/A";
    if (price >= 1000) return price?.toFixed(2);
    if (price >= 1) return price?.toFixed(4);
    return price?.toFixed(6);
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="analysis-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Analyse AI</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Analyse avancée propulsée par Claude Sonnet 4 avec ICT, SMC et Wyckoff
        </p>
      </div>

      {/* Analysis Form */}
      <Card className="glow-border" data-testid="analysis-form">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
                Symbole
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: BTC/USD, EUR/USD, AAPL"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="pl-10"
                  data-testid="symbol-input"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {popularSymbols[marketType].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSymbol(s)}
                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
                Type de marché
              </label>
              <Select value={marketType} onValueChange={setMarketType}>
                <SelectTrigger data-testid="market-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                  <SelectItem value="stocks">Actions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
                Timeframe
              </label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger data-testid="timeframe-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15m">15 minutes</SelectItem>
                  <SelectItem value="1h">1 heure</SelectItem>
                  <SelectItem value="4h">4 heures</SelectItem>
                  <SelectItem value="1d">1 jour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={analyzeSymbol}
            disabled={loading || !symbol}
            className="w-full mt-6 btn-trading"
            data-testid="analyze-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyse en cours avec Claude Sonnet 4...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Analyser avec l'IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="analysis-results">
          {/* Main Signal */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Signal pour {analysis.symbol}
                </CardTitle>
                <Badge variant="outline" className="font-mono">
                  {new Date(analysis.timestamp).toLocaleTimeString()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {analysis.analysis.error ? (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground">{analysis.analysis.error}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Signal Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`px-4 py-2 rounded text-lg font-bold uppercase ${
                        analysis.analysis.signal === 'BUY' ? 'signal-buy' :
                        analysis.analysis.signal === 'SELL' ? 'signal-sell' : 'signal-neutral'
                      }`}>
                        {analysis.analysis.signal || 'NEUTRAL'}
                      </span>
                      <div>
                        <p className="font-heading text-2xl font-bold">{analysis.symbol}</p>
                        <p className="text-sm text-muted-foreground">Timeframe: {timeframe}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Confiance</p>
                      <p className="font-mono text-3xl font-bold text-primary">
                        {analysis.analysis.confidence || 50}%
                      </p>
                    </div>
                  </div>

                  {/* Price Levels */}
                  {analysis.analysis.signal !== 'NEUTRAL' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded bg-muted/50">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                          <Target className="w-3 h-3" />
                          Entry
                        </p>
                        <p className="font-mono text-lg font-medium">
                          ${formatPrice(analysis.analysis.entry_price)}
                        </p>
                      </div>
                      <div className="p-4 rounded bg-red-500/10">
                        <p className="text-xs text-red-500 flex items-center gap-1 mb-2">
                          <ShieldAlert className="w-3 h-3" />
                          Stop Loss
                        </p>
                        <p className="font-mono text-lg font-medium text-red-500">
                          ${formatPrice(analysis.analysis.stop_loss)}
                        </p>
                      </div>
                      <div className="p-4 rounded bg-green-500/10">
                        <p className="text-xs text-green-500 flex items-center gap-1 mb-2">
                          <TrendingUp className="w-3 h-3" />
                          TP1
                        </p>
                        <p className="font-mono text-lg font-medium text-green-500">
                          ${formatPrice(analysis.analysis.take_profit_1)}
                        </p>
                      </div>
                      <div className="p-4 rounded bg-green-500/10">
                        <p className="text-xs text-green-500 flex items-center gap-1 mb-2">
                          <TrendingUp className="w-3 h-3" />
                          TP2
                        </p>
                        <p className="font-mono text-lg font-medium text-green-500">
                          ${formatPrice(analysis.analysis.take_profit_2)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Reasoning */}
                  {analysis.analysis.reasoning && (
                    <div className="p-4 rounded bg-muted/30 border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                        Raisonnement AI
                      </p>
                      <p className="text-sm leading-relaxed">
                        {analysis.analysis.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Details */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Détails Analyse
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {analysis.analysis.analysis ? (
                <>
                  {/* ICT Analysis */}
                  <div className="p-3 rounded bg-orange-500/5 border border-orange-500/20">
                    <p className="text-xs text-orange-500 font-medium mb-2">ICT</p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.analysis.analysis.ict || "Analyse ICT non disponible"}
                    </p>
                  </div>

                  {/* SMC Analysis */}
                  <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20">
                    <p className="text-xs text-blue-500 font-medium mb-2">SMC</p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.analysis.analysis.smc || "Analyse SMC non disponible"}
                    </p>
                  </div>

                  {/* Wyckoff Analysis */}
                  <div className="p-3 rounded bg-purple-500/5 border border-purple-500/20">
                    <p className="text-xs text-purple-500 font-medium mb-2">Wyckoff</p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.analysis.analysis.wyckoff || "Analyse Wyckoff non disponible"}
                    </p>
                  </div>

                  {/* Trend */}
                  {analysis.analysis.analysis.trend && (
                    <div className="p-3 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-2">Tendance</p>
                      <Badge className={`${
                        analysis.analysis.analysis.trend === 'up' ? 'bg-green-500' :
                        analysis.analysis.analysis.trend === 'down' ? 'bg-red-500' : 'bg-gray-500'
                      }`}>
                        {analysis.analysis.analysis.trend?.toUpperCase()}
                      </Badge>
                    </div>
                  )}

                  {/* Key Levels */}
                  {analysis.analysis.analysis.key_levels && (
                    <div className="p-3 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-2">Niveaux clés</p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.analysis.analysis.key_levels.map((level, i) => (
                          <Badge key={i} variant="outline" className="font-mono">
                            ${formatPrice(level)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Détails non disponibles
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis History */}
      {history.length > 0 && (
        <Card data-testid="analysis-history">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Historique des analyses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {history.map((item, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      item.analysis.signal === 'BUY' ? 'signal-buy' :
                      item.analysis.signal === 'SELL' ? 'signal-sell' : 'signal-neutral'
                    }`}>
                      {item.analysis.signal || 'NEUTRAL'}
                    </span>
                    <div>
                      <p className="font-medium">{item.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {item.analysis.confidence || 50}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!analysis && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading text-lg font-bold mb-2">Prêt pour l'analyse</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Entrez un symbole et lancez l'analyse AI pour obtenir des signaux de trading 
              basés sur les stratégies ICT, SMC et Wyckoff
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Analysis;
