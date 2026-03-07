import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { TYPE_INCIDENT_LABELS, TYPE_PARTIE_LABELS, TYPE_DOCUMENT_LABELS } from "@/lib/constants";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";

type Dossier = Tables<"dossiers">;
type Partie = Tables<"parties">;
type Document = Tables<"documents">;
type TypeIncident = Database["public"]["Enums"]["type_incident"];
type TypePartie = Database["public"]["Enums"]["type_partie"];
type TypeDocument = Database["public"]["Enums"]["type_document"];

// Minimum average characters per page to consider a PDF as having extractable text.
// Below this threshold we treat the PDF as a scanned document and run OCR.
const PDF_TEXT_THRESHOLD_PER_PAGE = 50;

async function extractText(
  file: File,
  onProgress?: (message: string) => void
): Promise<string> {
  if (file.name.endsWith(".txt")) {
    return file.text();
  }

  if (file.name.endsWith(".pdf")) {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

      // --- Try native text extraction first (digital / Word PDF) ---
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
      }

      const avgCharsPerPage = text.trim().length / pdf.numPages;
      if (avgCharsPerPage >= PDF_TEXT_THRESHOLD_PER_PAGE) {
        // Digital PDF with embedded text — return directly.
        return text;
      }

      // --- Scanned PDF: render each page to an image and call OCR ---
      onProgress?.("PDF scanné détecté — extraction OCR en cours…");

      const images: string[] = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
        const page = await pdf.getPage(i);
        // Scale 1.5× gives ~1240×1754 px for A4, good balance of quality/size
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL("image/jpeg", 0.8));
      }

      const { data, error } = await supabase.functions.invoke("ocr-pdf", {
        body: { images },
      });

      if (error) {
        console.error("OCR error:", error);
        return "[Erreur OCR — le texte n'a pas pu être extrait du PDF scanné]";
      }

      return (data?.text as string) || "[Aucun texte extrait par OCR]";
    } catch (e) {
      console.error("PDF extraction error:", e);
      return "[Erreur d'extraction PDF]";
    }
  }

  if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch {
      return "[Erreur d'extraction DOCX]";
    }
  }

  return "";
}

export default function DossierEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isNew = !id || id === "nouveau";

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dossierId, setDossierId] = useState<string | null>(isNew ? null : id!);

  // Form state
  const [typeIncident, setTypeIncident] = useState<TypeIncident>("autre");
  const [dateMatch, setDateMatch] = useState("");
  const [competition, setCompetition] = useState("");
  const [equipeDomicile, setEquipeDomicile] = useState("");
  const [equipeExterieur, setEquipeExterieur] = useState("");
  const [score, setScore] = useState("");
  const [lieuMatch, setLieuMatch] = useState("");
  const [arbitrePrenom, setArbitrePrenom] = useState("");
  const [arbitreNom, setArbitreNom] = useState("");
  const [contexte, setContexte] = useState("");

  // Parties
  const [parties, setParties] = useState<Partie[]>([]);
  const [showPartieModal, setShowPartieModal] = useState(false);
  const [partieToDelete, setPartieToDelete] = useState<string | null>(null);
  const [newPartie, setNewPartie] = useState({
    type_partie: "joueur" as TypePartie,
    nom: "",
    prenom: "",
    numero_licence: "",
    club: "",
    role_dans_incident: "",
    est_mis_en_cause: false,
  });

  // Documents
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);

  // Load existing dossier
  useEffect(() => {
    if (!isNew && id) {
      const load = async () => {
        const { data: dossier } = await supabase.from("dossiers").select("*").eq("id", id).single();
        if (dossier) {
          setTypeIncident(dossier.type_incident);
          setDateMatch(dossier.date_match || "");
          setCompetition(dossier.competition || "");
          setEquipeDomicile(dossier.equipe_domicile || "");
          setEquipeExterieur(dossier.equipe_exterieur || "");
          setScore(dossier.score || "");
          setLieuMatch(dossier.lieu_match || "");
          setArbitrePrenom(dossier.arbitre_prenom || "");
          setArbitreNom(dossier.arbitre_nom || "");
          setContexte(dossier.contexte_supplementaire || "");
        }
        const { data: p } = await supabase.from("parties").select("*").eq("dossier_id", id);
        setParties(p || []);
        const { data: docs } = await supabase.from("documents").select("*").eq("dossier_id", id);
        setDocuments(docs || []);
      };
      load();
    }
  }, [id, isNew]);

  const saveDossier = async () => {
    if (!user) return null;
    setSaving(true);

    // Deadline défense : fin de journée du match (23h59) + 48h calendaires
    // (approx. des 48h ouvrables réglementaires — art. Règlement Disciplinaire FFF)
    const deadlineDefense = dateMatch
      ? new Date(new Date(dateMatch + "T23:59:59").getTime() + 48 * 60 * 60 * 1000).toISOString()
      : null;
    // Deadline instruction : 6 semaines (42 jours) à partir de la création du dossier
    const deadlineInstruction = isNew
      ? new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const dossierData: Record<string, unknown> = {
      type_incident: typeIncident,
      date_match: dateMatch || null,
      competition,
      equipe_domicile: equipeDomicile,
      equipe_exterieur: equipeExterieur,
      score,
      lieu_match: lieuMatch,
      arbitre_prenom: arbitrePrenom,
      arbitre_nom: arbitreNom,
      contexte_supplementaire: contexte,
      deadline_defense: deadlineDefense,
    };
    // Deadline instruction uniquement à la création
    if (deadlineInstruction !== undefined) {
      dossierData.deadline_instruction = deadlineInstruction;
    }

    let resultId = dossierId;

    if (dossierId) {
      await supabase.from("dossiers").update(dossierData).eq("id", dossierId);
    } else {
      const { data, error } = await supabase
        .from("dossiers")
        .insert({ ...dossierData, user_id: user.id, reference: "temp", statut: "en_instruction" })
        .select()
        .single();
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        setSaving(false);
        return null;
      }
      resultId = data.id;
      setDossierId(data.id);
    }

    setSaving(false);
    toast({ title: "Dossier sauvegardé" });
    return resultId;
  };

  const addPartie = async () => {
    let currentId = dossierId;
    if (!currentId) {
      currentId = await saveDossier();
      if (!currentId) return;
    }
    const { data, error } = await supabase
      .from("parties")
      .insert({ ...newPartie, dossier_id: currentId })
      .select()
      .single();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else if (data) {
      setParties([...parties, data]);
      setShowPartieModal(false);
      setNewPartie({ type_partie: "joueur", nom: "", prenom: "", numero_licence: "", club: "", role_dans_incident: "", est_mis_en_cause: false });
    }
  };

  const confirmDeletePartie = async () => {
    if (!partieToDelete) return;
    await supabase.from("parties").delete().eq("id", partieToDelete);
    setParties(parties.filter((p) => p.id !== partieToDelete));
    setPartieToDelete(null);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    let currentId = dossierId;
    if (!currentId) {
      currentId = await saveDossier();
      if (!currentId) return;
    }
    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "doc", "docx", "txt"].includes(ext || "")) {
        toast({ title: "Format non supporté", description: `${file.name} n'est pas un format accepté (PDF, DOC, DOCX, TXT)`, variant: "destructive" });
        continue;
      }

      // Sanitize filename: remove special chars that Supabase Storage rejects
      const sanitizedName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[°º#%&{}\\<>*?/$!'":@+`|=]/g, "") // remove special chars
        .replace(/\(|\)/g, "") // remove parentheses
        .replace(/\s+/g, "_") // replace spaces with underscores
        .replace(/_+/g, "_"); // collapse multiple underscores
      const storagePath = `${user.id}/${currentId}/${Date.now()}-${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from("dossier-documents")
        .upload(storagePath, file);
      if (uploadError) {
        toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const contenuTexte = await extractText(file, (message) => {
        toast({ title: "Analyse du fichier", description: message });
      });

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          dossier_id: currentId,
          nom_fichier: file.name,
          taille: file.size,
          storage_path: storagePath,
          contenu_texte: contenuTexte,
          type_document: "autre" as TypeDocument,
        })
        .select()
        .single();

      if (docError) {
        toast({ title: "Erreur", description: docError.message, variant: "destructive" });
      } else if (doc) {
        setDocuments((prev) => [...prev, doc]);
      }
    }
    setUploading(false);
  };

  const updateDocType = async (docId: string, type: TypeDocument) => {
    await supabase.from("documents").update({ type_document: type }).eq("id", docId);
    setDocuments(documents.map((d) => (d.id === docId ? { ...d, type_document: type } : d)));
  };

  const deleteDocument = async (docId: string, storagePath: string | null) => {
    if (storagePath) {
      await supabase.storage.from("dossier-documents").remove([storagePath]);
    }
    await supabase.from("documents").delete().eq("id", docId);
    setDocuments(documents.filter((d) => d.id !== docId));
  };

  const generateReport = async () => {
    let currentId = dossierId;
    if (!currentId) {
      currentId = await saveDossier();
      if (!currentId) return;
    }
    if (documents.length === 0) {
      toast({ title: "Documents requis", description: "Ajoutez au moins un document avant de générer le rapport.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-instruction", {
        body: {
          dossier_id: currentId,
          documents_texte: documents.map((d) => ({ type: d.type_document, contenu: d.contenu_texte || "" })),
          contexte,
          infos_match: { date_match: dateMatch, competition, equipe_domicile: equipeDomicile, equipe_exterieur: equipeExterieur, score, lieu_match: lieuMatch, arbitre: `${arbitrePrenom} ${arbitreNom}` },
          parties: parties.map((p) => ({ nom: p.nom, prenom: p.prenom, type: p.type_partie, club: p.club, role: p.role_dans_incident, mis_en_cause: p.est_mis_en_cause })),
        },
      });

      if (error) throw error;

      const rapport = data?.rapport || data?.content || "";
      const graviteMatch = rapport.match(/Note de gravité.*?:\s*\[?(MINEURE|SÉRIEUSE|GRAVE|TRÈS GRAVE)\]?/i);
      let gravite: string | null = null;
      if (graviteMatch) {
        const g = graviteMatch[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (g.includes("tres") || g.includes("très")) gravite = "tres_grave";
        else if (g.includes("grave")) gravite = "grave";
        else if (g.includes("serieu") || g.includes("sérieu")) gravite = "serieux";
        else gravite = "mineur";
      }

      await supabase.from("dossiers").update({
        rapport_ia: rapport,
        statut: "rapport_genere" as any,
        ...(gravite ? { gravite: gravite as any } : {}),
      }).eq("id", currentId);

      toast({ title: "Rapport généré" });
      navigate(`/dossier/${currentId}/rapport`);
    } catch (err: any) {
      toast({ title: "Erreur de génération", description: err.message || "Erreur inconnue", variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{isNew ? "Nouveau dossier" : "Modifier le dossier"}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column - 40% */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informations du match</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Type d'incident</Label>
                  <Select value={typeIncident} onValueChange={(v) => setTypeIncident(v as TypeIncident)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_INCIDENT_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Date du match</Label>
                  <Input type="date" value={dateMatch} onChange={(e) => setDateMatch(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Compétition</Label>
                  <Input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Ex : District - Division 3 Poule A" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Équipe domicile</Label>
                    <Input value={equipeDomicile} onChange={(e) => setEquipeDomicile(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Équipe extérieur</Label>
                    <Input value={equipeExterieur} onChange={(e) => setEquipeExterieur(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Score</Label>
                    <Input value={score} onChange={(e) => setScore(e.target.value)} placeholder="2 - 1" />
                  </div>
                  <div className="space-y-1">
                    <Label>Lieu</Label>
                    <Input value={lieuMatch} onChange={(e) => setLieuMatch(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Prénom arbitre</Label>
                    <Input value={arbitrePrenom} onChange={(e) => setArbitrePrenom(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Nom arbitre</Label>
                    <Input value={arbitreNom} onChange={(e) => setArbitreNom(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parties */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Parties impliquées</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowPartieModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {parties.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune partie ajoutée</p>
                )}
                {parties.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                    <div>
                      <div className="font-medium text-sm">{p.prenom} {p.nom}</div>
                      <div className="text-xs text-muted-foreground">
                        {TYPE_PARTIE_LABELS[p.type_partie]} • {p.club}
                        {p.est_mis_en_cause && <Badge variant="destructive" className="ml-2 text-xs">Mis en cause</Badge>}
                      </div>
                      {p.role_dans_incident && <div className="text-xs mt-1">{p.role_dans_incident}</div>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setPartieToDelete(p.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Contexte */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contexte supplémentaire</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={contexte}
                  onChange={(e) => setContexte(e.target.value)}
                  placeholder="Ajoutez ici tout contexte utile non présent dans les documents : antécédents d'un joueur, ambiance du match, incidents précédents entre ces clubs..."
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>

            <Button onClick={saveDossier} disabled={saving || generating} className="w-full" variant="outline">
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sauvegarde...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Sauvegarder le dossier</>
              )}
            </Button>
          </div>

          {/* Right column - 60% */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Glissez vos fichiers ici ou cliquez pour parcourir
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, TXT</p>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </div>

                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Upload en cours...
                  </div>
                )}

                {/* Document list */}
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-md">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{doc.nom_fichier}</div>
                      <div className="text-xs text-muted-foreground">
                        {doc.taille ? `${(doc.taille / 1024).toFixed(0)} Ko` : ""}
                      </div>
                    </div>
                    <Select
                      value={doc.type_document}
                      onValueChange={(v) => updateDocType(doc.id, v as TypeDocument)}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_DOCUMENT_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDocument(doc.id, doc.storage_path)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Generate button */}
            <Button
              onClick={generateReport}
              disabled={generating || documents.length === 0}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  L'IA analyse les documents...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-5 w-5" />
                  Générer le rapport d'instruction
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation suppression partie */}
      <AlertDialog open={!!partieToDelete} onOpenChange={(open) => !open && setPartieToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette partie ?</AlertDialogTitle>
            <AlertDialogDescription>
              {partieToDelete && (() => {
                const p = parties.find((x) => x.id === partieToDelete);
                return p ? `${p.prenom} ${p.nom} (${p.club}) sera retiré(e) du dossier.` : "Cette partie sera retirée du dossier.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePartie} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Partie Modal */}
      <Dialog open={showPartieModal} onOpenChange={setShowPartieModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une partie</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={newPartie.type_partie} onValueChange={(v) => setNewPartie({ ...newPartie, type_partie: v as TypePartie })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_PARTIE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prénom</Label>
                <Input value={newPartie.prenom} onChange={(e) => setNewPartie({ ...newPartie, prenom: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Nom</Label>
                <Input value={newPartie.nom} onChange={(e) => setNewPartie({ ...newPartie, nom: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>N° de licence</Label>
              <Input value={newPartie.numero_licence} onChange={(e) => setNewPartie({ ...newPartie, numero_licence: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Club</Label>
              <Input value={newPartie.club} onChange={(e) => setNewPartie({ ...newPartie, club: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Rôle dans l'incident</Label>
              <Textarea value={newPartie.role_dans_incident} onChange={(e) => setNewPartie({ ...newPartie, role_dans_incident: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mis-en-cause"
                checked={newPartie.est_mis_en_cause}
                onChange={(e) => setNewPartie({ ...newPartie, est_mis_en_cause: e.target.checked })}
              />
              <Label htmlFor="mis-en-cause">Mis en cause</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartieModal(false)}>Annuler</Button>
            <Button onClick={addPartie} disabled={!newPartie.nom}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
