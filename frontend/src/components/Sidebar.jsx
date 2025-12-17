import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  LineChart, 
  Signal, 
  Wallet, 
  Bot, 
  Brain,
  ChevronLeft,
  ChevronRight,
  Zap
} from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/markets", icon: LineChart, label: "Marchés" },
  { path: "/signals", icon: Signal, label: "Signaux" },
  { path: "/portfolio", icon: Wallet, label: "Portfolio" },
  { path: "/bot", icon: Bot, label: "Trading Bot" },
  { path: "/analysis", icon: Brain, label: "Analyse AI" },
];

const Sidebar = ({ open, setOpen }) => {
  return (
    <aside 
      className={`fixed left-0 top-0 h-full bg-card border-r border-border z-50 transition-all duration-300 ${
        open ? 'w-64' : 'w-16'
      }`}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {open && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg tracking-tight">ALPHAMIND</span>
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="p-2 hover:bg-muted rounded-sm transition-colors"
          data-testid="sidebar-toggle"
        >
          {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`
            }
            data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {open && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      {open && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="p-3 rounded-sm bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-medium text-green-500">MARCHÉS LIVE</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Flux temps réel actif
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
