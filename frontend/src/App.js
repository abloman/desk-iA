import { useState, useEffect, createContext, useContext, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch (e) {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, password, name) => {
    const res = await axios.post(`${API}/auth/register`, { email, password, name });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Pages
import AITradingDesk from "./pages/AITradingDesk";
import Performance from "./pages/Performance";
import RiskSettings from "./pages/RiskSettings";
import Login from "./pages/Login";

const LoadingScreen = () => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center">
    <div className="animate-pulse-glow w-16 h-16 rounded-full bg-blue-500/20" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// Navigation Header
const NavHeader = () => {
  const { logout } = useAuth();
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;
  
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-slate-800">
      <div>
        <h1 className="text-3xl font-bold text-blue-400 tracking-tight">Alphamind</h1>
        <p className="text-xs text-slate-400 mt-1">
          Assistant de trading IA multi-marchés
        </p>
      </div>
      <nav className="flex gap-2 text-xs">
        <Link
          to="/"
          className={`px-3 py-2 rounded-lg border ${
            isActive('/') 
              ? 'bg-blue-600/20 border-blue-600 text-blue-200' 
              : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
          }`}
        >
          🧠 IA Trading Desk
        </Link>
        <Link
          to="/performance"
          className={`px-3 py-2 rounded-lg border ${
            isActive('/performance') 
              ? 'bg-emerald-600/20 border-emerald-600 text-emerald-200' 
              : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
          }`}
        >
          📊 Performance
        </Link>
        <Link
          to="/risk"
          className={`px-3 py-2 rounded-lg border ${
            isActive('/risk') 
              ? 'bg-purple-600/20 border-purple-600 text-purple-200' 
              : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
          }`}
        >
          ⚙️ Risque & MT5
        </Link>
        <button
          onClick={logout}
          className="px-3 py-2 rounded-lg bg-rose-600/20 border border-rose-600 text-rose-200 hover:bg-rose-600/30"
        >
          Déconnexion
        </button>
      </nav>
    </header>
  );
};

const AppLayout = ({ children }) => (
  <div className="min-h-screen bg-[#020617] text-white">
    <NavHeader />
    <main className="p-6">
      {children}
    </main>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout><AITradingDesk /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/performance" element={
            <ProtectedRoute>
              <AppLayout><Performance /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/risk" element={
            <ProtectedRoute>
              <AppLayout><RiskSettings /></AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
