import { useAuth } from "../App";
import { Bell, Settings, LogOut, User, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Header = () => {
  const { user, logout } = useAuth();
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get(`${API}/portfolio`);
      setPortfolio(res.data);
    } catch (e) {
      console.error("Portfolio fetch error:", e);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  return (
    <header className="h-16 border-b border-border glass-panel sticky top-0 z-40" data-testid="header">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left - Portfolio Stats */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Balance</span>
            <span className="font-mono text-lg font-medium tabular-nums" data-testid="balance">
              {formatCurrency(portfolio?.balance)}
            </span>
          </div>
          
          <div className="h-8 w-px bg-border"></div>
          
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">PnL Total</span>
            <span 
              className={`font-mono text-lg font-medium tabular-nums flex items-center gap-1 ${
                (portfolio?.total_pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
              data-testid="pnl"
            >
              {(portfolio?.total_pnl || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {formatCurrency(portfolio?.total_pnl)}
            </span>
          </div>
          
          <div className="h-8 w-px bg-border"></div>
          
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Win Rate</span>
            <span className="font-mono text-lg font-medium tabular-nums" data-testid="winrate">
              {portfolio?.win_rate?.toFixed(1) || 0}%
            </span>
          </div>
        </div>

        {/* Right - User Menu */}
        <div className="flex items-center gap-4">
          <button 
            className="p-2 hover:bg-muted rounded-sm transition-colors relative"
            data-testid="notifications-btn"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex items-center gap-3 p-2 hover:bg-muted rounded-sm transition-colors"
                data-testid="user-menu-btn"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-500">
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
