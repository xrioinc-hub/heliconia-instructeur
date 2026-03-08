import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import heliconLogo from "@/assets/helicon-logo.png";
import heliconLogoFull from "@/assets/helicon-logo-full.png";

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
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-sidebar flex-col justify-between p-10">
        <div>
          <img src={heliconLogoFull} alt="Helicon.IA" className="h-28 object-contain" />
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-sidebar-foreground leading-tight">
            Instruisez vos dossiers<br />disciplinaires avec l'IA.
          </h2>
          <p className="text-sidebar-accent-foreground/70 text-sm max-w-sm leading-relaxed">
            Helicon.IA automatise l'analyse des pièces, la recherche réglementaire et la rédaction des rapports d'instruction.
          </p>
        </div>
        <p className="text-xs text-sidebar-accent-foreground/40">
          © {new Date().getFullYear()} Helicon.IA — Tous droits réservés
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center">
            <img src={heliconLogoText} alt="Helicon.IA" className="h-20 object-contain" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              {isLogin ? "Connexion" : "Créer un compte"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Accédez à votre espace instructeur" : "Rejoignez la plateforme Helicon.IA"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-foreground">
                Adresse email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nom@district.fff.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-foreground">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-sm font-medium gap-2"
            >
              {loading ? "Chargement..." : isLogin ? "Se connecter" : "S'inscrire"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-medium hover:underline underline-offset-4"
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
