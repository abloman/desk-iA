import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { toast } from "sonner";
import { Zap, Mail, Lock, User, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(email, password);
        toast.success("Connexion réussie");
      } else {
        await register(email, password, name);
        toast.success("Compte créé avec succès");
      }
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-pattern flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1591911913225-b4f65b23a475?crop=entropy&cs=srgb&fm=jpg&q=85')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 p-12 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-primary flex items-center justify-center">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <span className="font-heading font-bold text-2xl tracking-tight">ALPHAMIND</span>
          </div>
          
          <div className="space-y-6">
            <h1 className="font-heading text-4xl font-bold leading-tight">
              Le Trading<br />
              <span className="text-primary">Intelligent</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-md">
              Assistant de trading propulsé par l'IA. Analyse ICT, SMC et Wyckoff 
              combinées avec Claude Sonnet 4 pour des signaux de haute qualité.
            </p>
            
            <div className="flex gap-6 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-muted-foreground">Crypto</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-sm text-muted-foreground">Forex</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-sm text-muted-foreground">Actions</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span>+2,847 traders actifs</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded bg-primary flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">ALPHAMIND</span>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="font-heading text-2xl font-bold">
              {isLogin ? "Connexion" : "Créer un compte"}
            </h2>
            <p className="text-muted-foreground mt-2">
              {isLogin 
                ? "Connectez-vous pour accéder à votre dashboard" 
                : "Rejoignez AlphaMind et tradez intelligemment"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Votre nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    data-testid="name-input"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  data-testid="email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  data-testid="password-input"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full btn-trading uppercase tracking-wide"
              disabled={loading}
              data-testid="submit-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isLogin ? "Se connecter" : "Créer le compte"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="toggle-auth-mode"
            >
              {isLogin 
                ? "Pas de compte ? Inscrivez-vous" 
                : "Déjà un compte ? Connectez-vous"}
            </button>
          </div>

          {/* Demo credentials */}
          <div className="p-4 rounded-sm bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground text-center">
              Demo: créez un compte avec n'importe quel email
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
