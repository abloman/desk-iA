import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Wallet, TrendingUp, TrendingDown, Activity, 
  DollarSign, Target, Clock, X, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closePrice, setClosePrice] = useState("");
  const [closingTrade, setClosingTrade] = useState(null);

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
    if (!closingTrade || !closePrice) return;
    try {
      await axios.post(`${API}/trades/${closingTrade.id}/close?exit_price=${closePrice}`);
      toast.success("Trade clôturé avec succès");
      setClosingTrade(null);
      setClosePrice("");
      fetchData();
    } catch (e) {
      toast.error("Erreur lors de la clôture");
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
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20"></div>
      </div>
    );
  }

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');

  // Pie chart data
  const pieData = [
    { name: 'Gagnants', value: closedTrades.filter(t => t.pnl > 0).length, color: '#10B981' },
    { name: 'Perdants', value: closedTrades.filter(t => t.pnl < 0).length, color: '#EF4444' },
    { name: 'Neutres', value: closedTrades.filter(t => t.pnl === 0).length, color: '#6B7280' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="portfolio-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gérez vos positions et suivez vos performances
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover" data-testid="stat-balance">
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

        <Card className="card-hover" data-testid="stat-pnl">
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

        <Card className="card-hover" data-testid="stat-winrate">
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

        <Card className="card-hover" data-testid="stat-trades">
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
        <Card className="lg:col-span-2" data-testid="open-positions">
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
                  <div key={trade.id} className="p-4 flex items-center justify-between" data-testid={`trade-${trade.id}`}>
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
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setClosingTrade(trade)}
                            data-testid={`close-trade-${trade.id}`}
                          >
                            Clôturer
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Clôturer la position</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {trade.symbol} - {trade.direction}
                              </p>
                              <p className="text-sm">
                                Entry: <span className="font-mono">${trade.entry_price}</span>
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
                            <Button onClick={closeTrade} className="w-full">
                              <Check className="w-4 h-4 mr-2" />
                              Confirmer la clôture
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card data-testid="performance-chart">
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
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
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
      <Card data-testid="trade-history">
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
