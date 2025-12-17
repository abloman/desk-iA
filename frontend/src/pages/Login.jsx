import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-400 tracking-tight">Alphamind</h1>
          <p className="text-slate-400 text-sm mt-2">
            Assistant de trading IA multi-marchés
          </p>
        </div>

        {/* Card */}
        <div className="card-dark p-8">
          <h2 className="text-xl font-semibold text-center mb-6">
            {isLogin ? "Connexion" : "Créer un compte"}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-600/20 border border-rose-600/30 text-rose-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nom</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg btn-primary text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Chargement…" : (isLogin ? "Se connecter" : "Créer le compte")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
            >
              {isLogin 
                ? "Pas de compte ? Inscrivez-vous" 
                : "Déjà un compte ? Connectez-vous"}
            </button>
          </div>

          <div className="mt-6 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <p className="text-xs text-slate-500 text-center">
              Demo: créez un compte avec n'importe quel email
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl mb-1">₿</div>
            <p className="text-xs text-slate-500">Crypto</p>
          </div>
          <div>
            <div className="text-2xl mb-1">💱</div>
            <p className="text-xs text-slate-500">Forex</p>
          </div>
          <div>
            <div className="text-2xl mb-1">📈</div>
            <p className="text-xs text-slate-500">Indices</p>
          </div>
          <div>
            <div className="text-2xl mb-1">🥇</div>
            <p className="text-xs text-slate-500">Métaux</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
