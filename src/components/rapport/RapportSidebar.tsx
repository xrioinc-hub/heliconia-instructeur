import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Lock, Clock } from "lucide-react";
import { STATUT_LABELS, GRAVITE_LABELS, TYPE_INCIDENT_LABELS, TYPE_PARTIE_LABELS, TYPE_DOCUMENT_LABELS } from "@/lib/constants";
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

interface RapportSidebarProps {
  dossier: Dossier;
  parties: Partie[];
  documents: Document[];
  now: number;
  formatCountdown: (deadline: string | null, now: number) => { label: string; urgent: boolean };
  onCloseRequest: () => void;
}

export function RapportSidebar({ dossier, parties, documents, now, formatCountdown, onCloseRequest }: RapportSidebarProps) {
  const defense = formatCountdown(dossier.deadline_defense, now);
  const instruction = formatCountdown(dossier.deadline_instruction, now);

  return (
    <>
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

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Délais réglementaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Défense (48h ouvrables)</span>
            <span className={defense.urgent ? "font-semibold text-destructive" : "font-medium"}>{defense.label}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Rapport instructeur (6 sem.)</span>
            <span className={instruction.urgent ? "font-semibold text-destructive" : "font-medium"}>{instruction.label}</span>
          </div>
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
            onClick={onCloseRequest}
          >
            <Lock className="mr-2 h-4 w-4" /> Marquer comme clos
          </Button>
        )}
      </div>
    </>
  );
}
