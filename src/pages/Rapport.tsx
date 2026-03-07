import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, FileDown, RefreshCw, Edit, Lock, Loader2, Clock } from "lucide-react";
import { STATUT_LABELS, GRAVITE_LABELS, TYPE_INCIDENT_LABELS, TYPE_PARTIE_LABELS, TYPE_DOCUMENT_LABELS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import type { Tables } from "@/integrations/supabase/types";

type Dossier = Tables<"dossiers">;
type Partie = Tables<"parties">;
type Document = Tables<"documents">;

function graviteBadgeClass(gravite: string | null) {
  switch (gravite) {
    case "mineur": return "bg-green-500 text-white";
    case "serieux": return "bg-amber-500 text-white";
    case "grave": return "bg-red-500 text-white";
    case "tres_grave": return "bg-red-800 text-white";
    default: return "";
  }
}

function formatCountdown(deadline: string | null, now: number): { label: string; urgent: boolean } {
  if (!deadline) return { label: "—", urgent: false };
  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0) return { label: "Expiré ⚠️", urgent: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const urgent = diff < 24 * 60 * 60 * 1000;
  const label = days > 0 ? `${days}j ${hours}h` : `${hours}h ${minutes}min`;
  return { label, urgent };
}

export default function Rapport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [parties, setParties] = useState<Partie[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Mise à jour du countdown toutes les minutes
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: d } = await supabase.from("dossiers").select("*").eq("id", id).single();
      setDossier(d);
      const { data: p } = await supabase.from("parties").select("*").eq("dossier_id", id);
      setParties(p || []);
      const { data: docs } = await supabase.from("documents").select("*").eq("dossier_id", id);
      setDocuments(docs || []);
    };
    load();
  }, [id]);

  const copyReport = () => {
    if (dossier?.rapport_ia) {
      navigator.clipboard.writeText(dossier.rapport_ia);
      toast({ title: "Rapport copié dans le presse-papier" });
    }
  };

  const exportPDF = () => {
    window.print();
  };

  const regenerate = async () => {
    if (!dossier) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-instruction", {
        body: {
          dossier_id: dossier.id,
          documents_texte: documents.map((d) => ({ type: d.type_document, contenu: d.contenu_texte || "" })),
          contexte: dossier.contexte_supplementaire || "",
          infos_match: {
            date_match: dossier.date_match,
            competition: dossier.competition,
            equipe_domicile: dossier.equipe_domicile,
            equipe_exterieur: dossier.equipe_exterieur,
            score: dossier.score,
            lieu_match: dossier.lieu_match,
            arbitre: `${dossier.arbitre_prenom} ${dossier.arbitre_nom}`,
          },
          parties: parties.map((p) => ({ nom: p.nom, prenom: p.prenom, type: p.type_partie, club: p.club, role: p.role_dans_incident, mis_en_cause: p.est_mis_en_cause })),
        },
      });

      if (error) throw error;
      const rapport = data?.rapport || data?.content || "";

      await supabase.from("dossiers").update({ rapport_ia: rapport }).eq("id", dossier.id);
      setDossier({ ...dossier, rapport_ia: rapport });
      toast({ title: "Rapport régénéré" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setRegenerating(false);
  };

  const closeDossier = async () => {
    if (!dossier) return;
    await supabase.from("dossiers").update({ statut: "clos" as any }).eq("id", dossier.id);
    setDossier({ ...dossier, statut: "clos" });
    setShowCloseConfirm(false);
    toast({ title: "Dossier clos" });
  };

  if (!dossier) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column - 35% */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Référence</span>
                <span className="font-mono font-medium">{dossier.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statut</span>
                <Badge variant="outline">{STATUT_LABELS[dossier.statut]}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{TYPE_INCIDENT_LABELS[dossier.type_incident]}</span>
              </div>
              {dossier.gravite && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gravité</span>
                  <Badge className={graviteBadgeClass(dossier.gravite)}>{GRAVITE_LABELS[dossier.gravite]}</Badge>
                </div>
              )}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Match</span>
                  <span>{dossier.date_match ? new Date(dossier.date_match).toLocaleDateString("fr-FR") : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Équipes</span>
                  <span>{dossier.equipe_domicile} — {dossier.equipe_exterieur}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compétition</span>
                  <span className="text-right max-w-[60%]">{dossier.competition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arbitre</span>
                  <span>{dossier.arbitre_prenom} {dossier.arbitre_nom}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parties */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parties ({parties.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {parties.map((p) => (
                <div key={p.id} className="text-sm p-2 border rounded bg-muted/30">
                  <div className="font-medium">{p.prenom} {p.nom}</div>
                  <div className="text-xs text-muted-foreground">
                    {TYPE_PARTIE_LABELS[p.type_partie]} • {p.club}
                    {p.est_mis_en_cause && <Badge variant="destructive" className="ml-1 text-xs">Mis en cause</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents.map((d) => (
                <div key={d.id} className="text-sm flex items-center gap-2">
                  <span className="truncate flex-1">{d.nom_fichier}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{TYPE_DOCUMENT_LABELS[d.type_document]}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Deadlines */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Délais réglementaires</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(() => {
                const defense = formatCountdown(dossier.deadline_defense, now);
                const instruction = formatCountdown(dossier.deadline_instruction, now);
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Défense (48h ouvrables)</span>
                      <span className={defense.urgent ? "font-semibold text-destructive" : "font-medium"}>
                        {defense.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Rapport instructeur (6 sem.)</span>
                      <span className={instruction.urgent ? "font-semibold text-destructive" : "font-medium"}>
                        {instruction.label}
                      </span>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <div className="space-y-2 no-print">
            <Button variant="outline" className="w-full" asChild>
              <Link to={`/dossier/${dossier.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Modifier le dossier
              </Link>
            </Button>
            {dossier.statut !== "clos" && (
              <Button
                variant="outline"
                className="w-full text-muted-foreground hover:text-destructive"
                onClick={() => setShowCloseConfirm(true)}
              >
                <Lock className="mr-2 h-4 w-4" /> Marquer comme clos
              </Button>
            )}
          </div>
        </div>

        {/* Right column - 65% */}
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader>
              {/* Entête visible uniquement à l'impression */}
              <div className="print-header">
                <div className="text-xl font-bold">Rapport d'instruction — {dossier.reference}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {dossier.equipe_domicile} — {dossier.equipe_exterieur} · {dossier.date_match ? new Date(dossier.date_match).toLocaleDateString("fr-FR") : ""} · {dossier.competition}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Généré le {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="flex items-center justify-between no-print">
                <CardTitle>Rapport d'instruction — Avis de l'IA</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyReport}>
                    <Copy className="mr-1 h-4 w-4" /> Copier
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportPDF}>
                    <FileDown className="mr-1 h-4 w-4" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
                    {regenerating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                    Régénérer
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 no-print">
                ⚠️ Ce rapport est une aide à l'instruction. L'instructeur reste seul responsable de ses conclusions.
              </p>
            </CardHeader>
            <CardContent>
              {dossier.rapport_ia ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{dossier.rapport_ia}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Aucun rapport généré</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation clôture dossier */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer ce dossier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le dossier <strong>{dossier.reference}</strong> sera marqué comme clos. Cette action ne peut pas être annulée. Le dossier restera consultable mais ne pourra plus être modifié.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={closeDossier}>Clôturer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
