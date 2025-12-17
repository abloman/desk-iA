import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Signal, TrendingUp, TrendingDown, Clock, Target, 
  ShieldAlert, Zap, RefreshCw, Check, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Signals = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSignals();
  }, []);

  const fetchSignals = async () => {
    try {
      const res = await axios.get(`${API}/signals`);
      setSignals(res.data.signals);
    } catch (e) {
      console.error("Signals fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const generateSignals = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/signals/generate`);
      setSignals([...res.data.signals, ...signals]);
      toast.success(`${res.data.count} nouveaux signaux générés`);
    } catch (e) {
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  const executeTrade = async (signal) => {
    try {
      await axios.post(`${API}/trades`, {
        signal_id: signal.id,
        symbol: signal.symbol,
        direction: signal.direction,
        entry_price: signal.entry_price,
        quantity: 1,
        stop_loss: signal.stop_loss,
        take_profit: signal.take_profit_1
      });
      toast.success(`Trade ${signal.direction} exécuté sur ${signal.symbol}`);
    } catch (e) {
      toast.error("Erreur lors de l'exécution");
    }
  };

  const formatPrice = (price) => {
    if (price >= 1000) return price?.toFixed(2);
    if (price >= 1) return price?.toFixed(4);
    return price?.toFixed(6);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="signals-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Signaux de Trading</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Signaux générés par l'IA avec analyse ICT, SMC et Wyckoff
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={generateSignals}
            disabled={generating}
            className="btn-trading"
            data-testid="generate-signals-btn"
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {generating ? "Analyse en cours..." : "Générer signaux AI"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <Signal className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{signals.length}</p>
              <p className="text-xs text-muted-foreground">Signaux actifs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">
                {signals.filter(s => s.direction === 'BUY').length}
              </p>
              <p className="text-xs text-muted-foreground">Signaux BUY</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">
                {signals.filter(s => s.direction === 'SELL').length}
              </p>
              <p className="text-xs text-muted-foreground">Signaux SELL</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">
                {signals.length > 0 
                  ? Math.round(signals.reduce((acc, s) => acc + (s.confidence || 0), 0) / signals.length)
                  : 0}%
              </p>
              <p className="text-xs text-muted-foreground">Conf. moyenne</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signals List */}
      {signals.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Signal className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading text-lg font-bold mb-2">Aucun signal actif</h3>
            <p className="text-muted-foreground mb-6">
              Générez des signaux AI pour commencer à trader
            </p>
            <Button onClick={generateSignals} disabled={generating} className="btn-trading">
              <Zap className="w-4 h-4 mr-2" />
              Générer signaux AI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {signals.map((signal) => (
            <Card key={signal.id} className="card-hover overflow-hidden" data-testid={`signal-${signal.id}`}>
              <div className={`h-1 ${signal.direction === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded text-sm font-bold uppercase ${
                      signal.direction === 'BUY' ? 'signal-buy' : 'signal-sell'
                    }`}>
                      {signal.direction}
                    </span>
                    <div>
                      <p className="font-heading font-bold text-lg">{signal.symbol}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(signal.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {signal.confidence}% conf.
                  </Badge>
                </div>

                {/* Price Levels */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Entry</p>
                    <p className="font-mono font-medium tabular-nums">${formatPrice(signal.entry_price)}</p>
                  </div>
                  <div className="p-3 rounded bg-red-500/10">
                    <p className="text-xs text-red-500 mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Stop Loss
                    </p>
                    <p className="font-mono font-medium tabular-nums text-red-500">${formatPrice(signal.stop_loss)}</p>
                  </div>
                </div>

                {/* Take Profits */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2 rounded bg-green-500/10 text-center">
                    <p className="text-xs text-green-500 mb-1">TP1</p>
                    <p className="font-mono text-sm tabular-nums">${formatPrice(signal.take_profit_1)}</p>
                  </div>
                  {signal.take_profit_2 && (
                    <div className="p-2 rounded bg-green-500/10 text-center">
                      <p className="text-xs text-green-500 mb-1">TP2</p>
                      <p className="font-mono text-sm tabular-nums">${formatPrice(signal.take_profit_2)}</p>
                    </div>
                  )}
                  {signal.take_profit_3 && (
                    <div className="p-2 rounded bg-green-500/10 text-center">
                      <p className="text-xs text-green-500 mb-1">TP3</p>
                      <p className="font-mono text-sm tabular-nums">${formatPrice(signal.take_profit_3)}</p>
                    </div>
                  )}
                </div>

                {/* Strategy & Analysis */}
                <div className="mb-4">
                  <Badge variant="secondary" className="text-xs">
                    {signal.strategy}
                  </Badge>
                  {signal.analysis && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {signal.analysis}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 btn-trading"
                    onClick={() => executeTrade(signal)}
                    data-testid={`execute-${signal.id}`}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Exécuter
                  </Button>
                  <Button variant="outline" className="px-3">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Signals;
