import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Profil() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [prenom, setPrenom] = useState(profile?.prenom || "");
  const [nom, setNom] = useState(profile?.nom || "");
  const [district, setDistrict] = useState(profile?.district || "");
  const [ligue, setLigue] = useState(profile?.ligue || "");
  const [poste, setPoste] = useState(profile?.poste || "instructeur");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ prenom, nom, district, ligue, poste })
      .eq("id", profile.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil mis à jour" });
      await refreshProfile();
    }
    setSaving(false);
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">Mon profil</h1>
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>District</Label>
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Ex : District du Val d'Oise" />
            </div>
            <div className="space-y-2">
              <Label>Ligue</Label>
              <Input value={ligue} onChange={(e) => setLigue(e.target.value)} placeholder="Ex : Ligue de Paris Île-de-France" />
            </div>
            <div className="space-y-2">
              <Label>Poste</Label>
              <Select value={poste} onValueChange={setPoste}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instructeur">Instructeur</SelectItem>
                  <SelectItem value="president_commission">Président de commission</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
