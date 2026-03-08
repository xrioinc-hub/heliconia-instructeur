import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, FileDown, RefreshCw, Edit, Lock, Loader2, Clock, Eye, Pencil, Save, MessageSquare, Archive } from "lucide-react";
import { exportDossierZip } from "@/lib/exportZip";
import { STATUT_LABELS, GRAVITE_LABELS, TYPE_INCIDENT_LABELS, TYPE_PARTIE_LABELS, TYPE_DOCUMENT_LABELS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import type { Tables } from "@/integrations/supabase/types";
import { RapportSidebar } from "@/components/rapport/RapportSidebar";

type Dossier = Tables<"dossiers">;
type Partie = Tables<"parties">;
type Document = Tables<"documents">;

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
  const { toast } = useToast();
  const { user } = useAuth();

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [parties, setParties] = useState<Partie[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [profile, setProfile] = useState<{ district: string | null; ligue: string | null } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Edition & feedback states
  const [editedRapport, setEditedRapport] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [revising, setRevising] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: d } = await supabase.from("dossiers").select("*").eq("id", id).single();
      setDossier(d);
      if (d?.rapport_ia) setEditedRapport(d.rapport_ia);
      const { data: p } = await supabase.from("parties").select("*").eq("dossier_id", id);
      setParties(p || []);
      const { data: docs } = await supabase.from("documents").select("*").eq("dossier_id", id);
      setDocuments(docs || []);
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("district, ligue").eq("id", user.id).single();
        setProfile(prof);
      }
    };
    load();
  }, [id, user]);

  const copyReport = () => {
    if (editedRapport) {
      navigator.clipboard.writeText(editedRapport);
      toast({ title: "Rapport copié dans le presse-papier" });
    }
  };

  const exportPDF = () => {
    window.print();
  };

  const saveReport = async () => {
    if (!dossier) return;
    setSaving(true);
    await supabase.from("dossiers").update({ rapport_ia: editedRapport }).eq("id", dossier.id);
    setDossier({ ...dossier, rapport_ia: editedRapport });
    setHasUnsavedChanges(false);
    setSaving(false);
    toast({ title: "Rapport sauvegardé" });
  };

  const handleEditChange = (value: string) => {
    setEditedRapport(value);
    setHasUnsavedChanges(true);
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
      setEditedRapport(rapport);
      setHasUnsavedChanges(false);
      toast({ title: "Rapport régénéré" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setRegenerating(false);
  };

  const reviseWithFeedback = async () => {
    if (!dossier || !feedback.trim()) return;
    setRevising(true);
    try {
      const { data, error } = await supabase.functions.invoke("revise-instruction", {
        body: {
          rapport_actuel: editedRapport,
          feedback_instructeur: feedback,
        },
      });

      if (error) throw error;
      const revised = data?.rapport || "";
      if (!revised) throw new Error("Aucune réponse de l'IA");

      await supabase.from("dossiers").update({ rapport_ia: revised }).eq("id", dossier.id);
      setDossier({ ...dossier, rapport_ia: revised });
      setEditedRapport(revised);
      setHasUnsavedChanges(false);
      setFeedback("");
      toast({ title: "Rapport révisé avec vos retours" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setRevising(false);
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
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column - sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <RapportSidebar
            dossier={dossier}
            parties={parties}
            documents={documents}
            now={now}
            formatCountdown={formatCountdown}
            onCloseRequest={() => setShowCloseConfirm(true)}
          />
        </div>

        {/* Right column - rapport */}
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader>
              {/* Entête impression */}
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
                <CardTitle>Rapport d'instruction</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {/* Toggle edit/preview */}
                  {editedRapport && (
                    <Button
                      variant={isEditing ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? <Eye className="mr-1 h-4 w-4" /> : <Pencil className="mr-1 h-4 w-4" />}
                      {isEditing ? "Aperçu" : "Modifier"}
                    </Button>
                  )}
                  {hasUnsavedChanges && (
                    <Button variant="default" size="sm" onClick={saveReport} disabled={saving}>
                      {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                      Sauvegarder
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={copyReport} disabled={!editedRapport}>
                    <Copy className="mr-1 h-4 w-4" /> Copier
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportPDF} disabled={!editedRapport}>
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
              {editedRapport ? (
                isEditing ? (
                  <Textarea
                    value={editedRapport}
                    onChange={(e) => handleEditChange(e.target.value)}
                    className="min-h-[500px] font-mono text-sm leading-relaxed"
                    placeholder="Contenu Markdown du rapport..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{editedRapport}</ReactMarkdown>
                  </div>
                )
              ) : (
                <p className="text-muted-foreground text-center py-8">Aucun rapport généré</p>
              )}
            </CardContent>
          </Card>

          {/* Feedback instructeur */}
          {editedRapport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Retour de l'instructeur
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Décrivez votre décision ou vos modifications, l'IA ajustera le rapport en conséquence.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ex : J'ai décidé de 3 matchs de suspension pour le joueur X. Ajouter que le club a présenté des excuses..."
                  className="min-h-[100px]"
                />
                <Button
                  onClick={reviseWithFeedback}
                  disabled={revising || !feedback.trim()}
                  className="w-full"
                >
                  {revising ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Appliquer mes retours via l'IA
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* LAYOUT D'IMPRESSION */}
      <div id="print-layout">
        <div className="pv-header">
          <div className="pv-logo-box">
            <div className="pv-logo-inner">
              {profile?.district
                ? profile.district.split(" ").filter(w => w.length > 2).map(w => w[0].toUpperCase()).slice(0, 3).join("")
                : "FFF"}
            </div>
          </div>
          <div className="pv-header-center">
            <div className="pv-district-name">{profile?.district || "District"}</div>
            <div className="pv-ligue-label">{profile?.ligue ? `${profile.ligue} · ` : ""}de Football</div>
          </div>
          <div className="pv-header-right">
            <div className="pv-ref-label">Réf. {dossier.reference}</div>
            <div className="pv-date-label">Le {new Date().toLocaleDateString("fr-FR")}</div>
          </div>
        </div>

        <div className="pv-divider" />

        <div className="pv-title-banner">
          <div className="pv-title-line1">{(profile?.district || "DISTRICT").toUpperCase()}</div>
          <div className="pv-title-line2">COMMISSION DE DISCIPLINE ET DE L'ÉTHIQUE</div>
          <div className="pv-title-line3">RAPPORT D'INSTRUCTION — {dossier.reference}</div>
        </div>

        <div className="pv-match-banner">
          {dossier.date_match && (
            <div className="pv-match-date">Journée du {new Date(dossier.date_match).toLocaleDateString("fr-FR")}</div>
          )}
          {dossier.competition && <div className="pv-match-comp">{dossier.competition}</div>}
          <div className="pv-match-teams">
            {dossier.equipe_domicile} — {dossier.equipe_exterieur}
            {dossier.score ? ` (${dossier.score})` : ""}
          </div>
          {dossier.lieu_match && <div className="pv-match-detail">Lieu : {dossier.lieu_match}</div>}
          {(dossier.arbitre_prenom || dossier.arbitre_nom) && (
            <div className="pv-match-detail">Arbitre : {[dossier.arbitre_prenom, dossier.arbitre_nom].filter(Boolean).join(" ")}</div>
          )}
        </div>

        {parties.length > 0 && (
          <div className="pv-parties-section">
            <div className="pv-section-underline-title">Parties impliquées</div>
            {parties.map((p) => (
              <div key={p.id} className="pv-partie-line">
                ❖ <strong>{p.prenom} {p.nom}</strong>
                {" — "}{TYPE_PARTIE_LABELS[p.type_partie]}, club&nbsp;: {p.club || "—"}
                {p.est_mis_en_cause ? " — MIS EN CAUSE" : ""}
                {p.role_dans_incident ? ` — Rôle : ${p.role_dans_incident}` : ""}
              </div>
            ))}
          </div>
        )}

        <div className="pv-rapport-body">
          {editedRapport ? (
            <ReactMarkdown>{editedRapport}</ReactMarkdown>
          ) : (
            <p><em>Aucun rapport généré.</em></p>
          )}
        </div>

        <div className="pv-disclaimer-print">
          Rapport d'instruction généré par intelligence artificielle le{" "}
          {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}.{" "}
          Ce document doit être validé, complété et signé par l'instructeur désigné avant transmission à la Commission.
        </div>

        <div className="pv-signature-row">
          <div className="pv-signature-box">
            <div className="pv-signature-title">Secrétaire de séance</div>
            <div className="pv-signature-space" />
          </div>
          <div className="pv-signature-box">
            <div className="pv-signature-title">Instructeur désigné</div>
            <div className="pv-signature-space" />
          </div>
        </div>
      </div>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer ce dossier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le dossier <strong>{dossier.reference}</strong> sera marqué comme clos. Cette action ne peut pas être annulée.
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
