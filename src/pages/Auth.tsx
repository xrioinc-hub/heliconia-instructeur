import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import heliconLogo from "@/assets/helicon-logo.png";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast({ title: "Erreur d'inscription", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Inscription réussie", description: "Vérifiez votre email pour confirmer votre compte." });
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: "linear-gradient(135deg, hsl(150 40% 96%) 0%, hsl(150 30% 92%) 40%, hsl(150 20% 97%) 100%)",
      }}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <img src={heliconLogo} alt="Helicon.IA" className="w-40 h-40 object-contain mb-4" />

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-1">Espace instructeurs</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Plateforme d'instruction disciplinaire
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-muted-foreground text-xs font-normal">
              Adresse mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Entrez votre email ici..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-full border-none bg-white/70 shadow-sm backdrop-blur-sm px-5 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-muted-foreground text-xs font-normal">
              Mot de passe
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Entrez votre mot de passe ici..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 rounded-full border-none bg-white/70 shadow-sm backdrop-blur-sm px-5 pr-12 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-center">
            <Button
              type="submit"
              disabled={loading}
              className="h-12 px-12 rounded-full text-base font-medium shadow-md"
              style={{
                background: "hsl(150 25% 60%)",
                color: "white",
              }}
            >
              {loading ? "Chargement..." : isLogin ? "Se connecter" : "S'inscrire"}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary underline-offset-4 hover:underline font-medium"
          >
            {isLogin ? "S'inscrire" : "Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}
