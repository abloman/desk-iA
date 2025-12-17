import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  TrendingUp, TrendingDown, Activity, DollarSign, 
  Target, Zap, ArrowUpRight, ArrowDownRight,
  Bitcoin, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [markets, setMarkets] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [marketsRes, portfolioRes, signalsRes] = await Promise.all([
        axios.get(`${API}/markets`),
        axios.get(`${API}/portfolio`),
        axios.get(`${API}/signals`)
      ]);
      setMarkets(marketsRes.data.markets);
      setPortfolio(portfolioRes.data);
      setSignals(signalsRes.data.signals);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value || 0);
  };

  const formatPrice = (price, symbol) => {
    if (symbol?.includes("JPY")) return price?.toFixed(3);
    if (symbol?.includes("/USD") && price < 10) return price?.toFixed(4);
    return price?.toFixed(2);
  };

  // Generate mock chart data
  const generateChartData = () => {
    const data = [];
    let value = 10000;
    for (let i = 30; i >= 0; i--) {
      value += (Math.random() - 0.45) * 200;
      data.push({
        day: `J-${i}`,
        value: Math.round(value)
      });
    }
    return data;
  };

  const chartData = generateChartData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20"></div>
      </div>
    );
  }

  const cryptos = markets.filter(m => m.type === "crypto").slice(0, 4);
  const topMovers = [...markets].sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h)).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard">
      {/* Stats Cards */}
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
              <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary" />
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
              <div className={`w-12 h-12 rounded-sm flex items-center justify-center ${
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
              <div className="w-12 h-12 rounded-sm bg-blue-500/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover" data-testid="stat-trades">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Trades</p>
                <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
                  {portfolio?.total_trades || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {portfolio?.open_trades || 0} ouvert(s)
                </p>
              </div>
              <div className="w-12 h-12 rounded-sm bg-purple-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Chart */}
        <Card className="lg:col-span-2" data-testid="portfolio-chart">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-sm uppercase tracking-widest">
                Performance Portfolio
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs">7J</Button>
                <Button variant="secondary" size="sm" className="text-xs">30J</Button>
                <Button variant="ghost" size="sm" className="text-xs">90J</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 10 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 10 }}
                    tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#0a0b0e', 
                      border: '1px solid #27272a',
                      borderRadius: '4px'
                    }}
                    formatter={(value) => [`$${value}`, 'Balance']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Movers */}
        <Card data-testid="top-movers">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Top Movers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {topMovers.map((market, i) => (
                <div key={market.symbol} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                    <div>
                      <p className="font-medium text-sm">{market.symbol}</p>
                      <p className="text-xs text-muted-foreground capitalize">{market.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm tabular-nums">
                      {formatPrice(market.price, market.symbol)}
                    </p>
                    <p className={`text-xs font-mono tabular-nums flex items-center justify-end gap-1 ${
                      market.change_24h >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {market.change_24h >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(market.change_24h).toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Crypto Watchlist */}
        <Card data-testid="crypto-watchlist">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
                <Bitcoin className="w-4 h-4 text-orange-500" />
                Crypto
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => window.location.href = '/markets'}>
                Voir tout
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {cryptos.map((crypto) => (
                <div key={crypto.symbol} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-orange-500">
                        {crypto.symbol.split('/')[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{crypto.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        Vol: {(crypto.volume_24h / 1000000).toFixed(1)}M
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium tabular-nums">
                      {formatCurrency(crypto.price)}
                    </p>
                    <p className={`text-sm font-mono tabular-nums ${
                      crypto.change_24h >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {crypto.change_24h >= 0 ? '+' : ''}{crypto.change_24h?.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Signals */}
        <Card data-testid="recent-signals">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-sm uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Signaux Récents
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => window.location.href = '/signals'}>
                Voir tout
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {signals.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Aucun signal actif</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => window.location.href = '/analysis'}
                >
                  Générer des signaux
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {signals.slice(0, 4).map((signal) => (
                  <div key={signal.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        signal.direction === 'BUY' ? 'signal-buy' : 'signal-sell'
                      }`}>
                        {signal.direction}
                      </span>
                      <div>
                        <p className="font-medium">{signal.symbol}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(signal.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm tabular-nums">
                        {formatPrice(signal.entry_price, signal.symbol)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Conf: {signal.confidence}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
