import { useState, useEffect } from "react";
import axios from "axios";
import { Search, ArrowUpRight, ArrowDownRight, Star, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Markets = () => {
  const [markets, setMarkets] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchMarkets, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [marketsRes, watchlistRes] = await Promise.all([
        axios.get(`${API}/markets`),
        axios.get(`${API}/watchlist`)
      ]);
      setMarkets(marketsRes.data.markets);
      setWatchlist(watchlistRes.data.symbols || []);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarkets = async () => {
    try {
      const res = await axios.get(`${API}/markets`);
      setMarkets(res.data.markets);
    } catch (e) {
      console.error("Markets fetch error:", e);
    }
  };

  const toggleWatchlist = async (symbol) => {
    try {
      if (watchlist.includes(symbol)) {
        await axios.post(`${API}/watchlist/remove?symbol=${symbol}`);
        setWatchlist(watchlist.filter(s => s !== symbol));
        toast.success(`${symbol} retiré de la watchlist`);
      } else {
        await axios.post(`${API}/watchlist/add?symbol=${symbol}`);
        setWatchlist([...watchlist, symbol]);
        toast.success(`${symbol} ajouté à la watchlist`);
      }
    } catch (e) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const formatPrice = (price, symbol) => {
    if (symbol?.includes("JPY")) return price?.toFixed(3);
    if (symbol?.includes("/USD") && price < 10) return price?.toFixed(4);
    return price?.toFixed(2);
  };

  const formatVolume = (volume) => {
    if (volume >= 1000000000) return `${(volume / 1000000000).toFixed(1)}B`;
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume?.toFixed(0);
  };

  const filteredMarkets = markets.filter(m => {
    const matchesSearch = m.symbol.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "watchlist") return matchesSearch && watchlist.includes(m.symbol);
    return matchesSearch && m.type === activeTab;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="markets-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Marchés</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {markets.length} instruments • Mise à jour en temps réel
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un symbole..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
              data-testid="search-input"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="all" data-testid="tab-all">Tous</TabsTrigger>
          <TabsTrigger value="watchlist" data-testid="tab-watchlist">
            <Star className="w-3 h-3 mr-1" />
            Watchlist
          </TabsTrigger>
          <TabsTrigger value="crypto" data-testid="tab-crypto">Crypto</TabsTrigger>
          <TabsTrigger value="forex" data-testid="tab-forex">Forex</TabsTrigger>
          <TabsTrigger value="indices" data-testid="tab-indices">Indices</TabsTrigger>
          <TabsTrigger value="metals" data-testid="tab-metals">Métaux</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
                <div className="col-span-1"></div>
                <div className="col-span-3">Symbole</div>
                <div className="col-span-2 text-right">Prix</div>
                <div className="col-span-2 text-right">24h %</div>
                <div className="col-span-2 text-right">Volume</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-border">
                {filteredMarkets.map((market) => (
                  <div 
                    key={market.symbol} 
                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 transition-colors"
                    data-testid={`market-row-${market.symbol}`}
                  >
                    <div className="col-span-1">
                      <button
                        onClick={() => toggleWatchlist(market.symbol)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        data-testid={`watchlist-btn-${market.symbol}`}
                      >
                        <Star className={`w-4 h-4 ${
                          watchlist.includes(market.symbol) 
                            ? 'text-yellow-500 fill-yellow-500' 
                            : 'text-muted-foreground'
                        }`} />
                      </button>
                    </div>
                    <div className="col-span-3 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded flex items-center justify-center text-xs font-bold ${
                        market.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' :
                        market.type === 'forex' ? 'bg-blue-500/10 text-blue-500' :
                        market.type === 'indices' ? 'bg-purple-500/10 text-purple-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {market.symbol.split('/')[0].slice(0, 3)}
                      </div>
                      <div>
                        <p className="font-medium">{market.symbol}</p>
                        <p className="text-xs text-muted-foreground capitalize">{market.type}</p>
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="font-mono font-medium tabular-nums">
                        ${formatPrice(market.price, market.symbol)}
                      </p>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                        market.change_24h >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {market.change_24h >= 0 ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {Math.abs(market.change_24h).toFixed(2)}%
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="font-mono text-sm text-muted-foreground tabular-nums">
                        ${formatVolume(market.volume_24h)}
                      </p>
                    </div>
                    <div className="col-span-2 text-right">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs"
                        onClick={() => window.location.href = `/analysis?symbol=${market.symbol}`}
                        data-testid={`analyze-btn-${market.symbol}`}
                      >
                        Analyser
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredMarkets.length === 0 && (
                <div className="p-12 text-center">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Aucun résultat trouvé</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Markets;
