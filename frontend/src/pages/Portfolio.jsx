import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Wallet, TrendingUp, TrendingDown, Activity, 
  Target, Clock, X, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Simple toast
const showToast = (message, type = 'success') => {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-sm border ${
    type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-red-500/10 border-red-500/50 text-red-500'
  } animate-fade-in`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closeDialog, setCloseDialog] = useState(null);
  const [closePrice, setClosePrice] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [portfolioRes, tradesRes] = await Promise.all([
        axios.get(`${API}/portfolio`),
        axios.get(`${API}/trades`)
      ]);
      setPortfolio(portfolioRes.data);
      setTrades(tradesRes.data.trades);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const closeTrade = async () => {
    if (!closeDialog || !closePrice) return;
    try {
      await axios.post(`${API}/trades/${closeDialog.id}/close?exit_price=${closePrice}`);
      showToast("Trade clôturé avec succès");
      setCloseDialog(null);
      setClosePrice("");
      fetchData();
    } catch (e) {
      showToast("Erreur lors de la clôture", "error");
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20" />
      </div>
    );
  }

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');

  const pieData = [
    { name: 'Gagnants', value: closedTrades.filter(t => t.pnl > 0).length, color: '#10B981' },
    { name: 'Perdants', value: closedTrades.filter(t => t.pnl < 0).length, color: '#EF4444' },
    { name: 'Neutres', value: closedTrades.filter(t => t.pnl === 0).length, color: '#6B7280' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="portfolio-page">
      {/* Close Trade Modal */}
      {closeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-sm p-6 w-full max-w-md mx-4">
            <h3 className="font-heading font-bold text-lg mb-4">Clôturer la position</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {closeDialog.symbol} - {closeDialog.direction}
                </p>
                <p className="text-sm">
                  Entry: <span className="font-mono">${closeDialog.entry_price}</span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Prix de sortie</label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="Ex: 68500"
                  value={closePrice}
                  onChange={(e) => setClosePrice(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={closeTrade} className="flex-1">
                  <Check className="w-4 h-4 mr-2" />
                  Confirmer
                </Button>
                <Button variant="outline" onClick={() => { setCloseDialog(null); setClosePrice(""); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gérez vos positions et suivez vos performances
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Balance</p>
                <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
                  {formatCurrency(portfolio?.balance)}
                </p>
              </div>
              <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">PnL Total</p>
                <p className={`font-mono text-2xl font-bold mt-1 tabular-nums ${
                  (portfolio?.total_pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatCurrency(portfolio?.total_pnl)}
                </p>
              </div>
              <div className={`w-12 h-12 rounded flex items-center justify-center ${
                (portfolio?.total_pnl || 0) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {(portfolio?.total_pnl || 0) >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-500" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Win Rate</p>
                <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
                  {portfolio?.win_rate?.toFixed(1) || 0}%
                </p>
              </div>
              <div className="w-12 h-12 rounded bg-blue-500/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Total Trades</p>
                <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
                  {portfolio?.total_trades || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {openTrades.length} ouvert(s)
                </p>
              </div>
              <div className="w-12 h-12 rounded bg-purple-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Positions */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Positions Ouvertes ({openTrades.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {openTrades.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Aucune position ouverte</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {openTrades.map((trade) => (
                  <div key={trade.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        trade.direction === 'BUY' ? 'signal-buy' : 'signal-sell'
                      }`}>
                        {trade.direction}
                      </span>
                      <div>
                        <p className="font-medium">{trade.symbol}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(trade.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="font-mono text-sm">Entry: ${trade.entry_price}</p>
                        <p className="text-xs text-muted-foreground">Qty: {trade.quantity}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setCloseDialog(trade)}
                      >
                        Clôturer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-heading text-sm uppercase tracking-widest">
              Répartition
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Pas encore de trades</p>
              </div>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          background: '#0a0b0e', 
                          border: '1px solid #27272a',
                          borderRadius: '4px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-muted-foreground">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trade History */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="font-heading text-sm uppercase tracking-widest">
            Historique des Trades ({closedTrades.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {closedTrades.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun trade clôturé</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {closedTrades.slice(0, 10).map((trade) => (
                <div key={trade.id} className="p-4 grid grid-cols-6 gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      trade.direction === 'BUY' ? 'signal-buy' : 'signal-sell'
                    }`}>
                      {trade.direction}
                    </span>
                    <span className="font-medium">{trade.symbol}</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Entry</p>
                    <p className="font-mono text-sm">${trade.entry_price}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Exit</p>
                    <p className="font-mono text-sm">${trade.exit_price}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Qty</p>
                    <p className="font-mono text-sm">{trade.quantity}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">PnL</p>
                    <p className={`font-mono text-sm font-bold ${
                      trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {formatCurrency(trade.pnl)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {new Date(trade.closed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Portfolio;
