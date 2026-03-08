import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, Trash2, BookOpen } from "lucide-react";

type SourceReglement = "fff" | "ligue" | "district";

const SOURCE_LABELS: Record<SourceReglement, string> = {
  fff: "FFF (Fédération)",
  ligue: "Ligue régionale",
  district: "District",
};

const SOURCE_COLORS: Record<SourceReglement, string> = {
  fff: "bg-blue-100 text-blue-800",
  ligue: "bg-green-100 text-green-800",
  district: "bg-amber-100 text-amber-800",
};

interface IndexedDoc {
  titre: string;
  source: SourceReglement;
  chunks: number;
}

export default function BaseConnaissances() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [source, setSource] = useState<SourceReglement>("fff");
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [indexedDocs, setIndexedDocs] = useState<IndexedDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const fetchIndexedDocs = async () => {
    setLoadingDocs(true);
    const { data } = await supabase
      .from("reglements")
      .select("titre_document, source")
      .order("created_at", { ascending: false });

    if (data) {
      const grouped = new Map<string, IndexedDoc>();
      for (const row of data) {
        const key = `${row.source}::${row.titre_document}`;
        if (grouped.has(key)) {
          grouped.get(key)!.chunks++;
        } else {
          grouped.set(key, {
            titre: row.titre_document,
            source: row.source as SourceReglement,
            chunks: 1,
          });
        }
      }
      setIndexedDocs(Array.from(grouped.values()));
    }
    setLoadingDocs(false);
  };

  useEffect(() => {
    fetchIndexedDocs();
  }, []);

  const extractTextFromFile = async (f: File): Promise<{ text: string; name: string }> => {
    let text = "";
    const name = f.name.replace(/\.(txt|pdf)$/, "");
    if (f.name.endsWith(".txt")) {
      text = await f.text();
    } else if (f.name.endsWith(".pdf")) {
      const pdfjsLib = await import("pdfjs-dist");
      const pdfjsWorkerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n\n";
      }
    }
    return { text, name };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    setFiles(selectedFiles);

    // If single file, pre-fill text and title
    if (selectedFiles.length === 1) {
      try {
        const { text, name } = await extractTextFromFile(selectedFiles[0]);
        setTexte(text);
        if (!titre) setTitre(name);
      } catch {
        toast({ title: "Erreur", description: "Impossible d'extraire le texte du fichier", variant: "destructive" });
      }
    } else {
      setTexte("");
      setTitre("");
    }
  };

  const handleSubmit = async () => {
    // Multi-file mode
    if (files.length > 1) {
      setLoading(true);
      let success = 0;
      let errors = 0;
      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i);
        try {
          const { text, name } = await extractTextFromFile(files[i]);
          if (!text.trim()) { errors++; continue; }
          const { data, error } = await supabase.functions.invoke("index-reglement", {
            body: {
              texte: text,
              source,
              titre_document: name,
              district: profile?.district || null,
              ligue: profile?.ligue || null,
            },
          });
          if (error || data?.error) { errors++; continue; }
          success++;
        } catch {
          errors++;
        }
      }
      toast({
        title: "Indexation terminée",
        description: `${success} document(s) indexé(s)${errors ? `, ${errors} erreur(s)` : ""}`,
        variant: errors && !success ? "destructive" : "default",
      });
      setFiles([]);
      setCurrentFileIndex(0);
      fetchIndexedDocs();
      setLoading(false);
      return;
    }

    // Single file / text mode
    if (!texte.trim() || !titre.trim()) {
      toast({ title: "Erreur", description: "Le titre et le texte sont requis", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("index-reglement", {
        body: {
          texte,
          source,
          titre_document: titre,
          district: profile?.district || null,
          ligue: profile?.ligue || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Document indexé !",
        description: `${data.chunks_indexed} fragments ont été indexés dans la base de connaissances.`,
      });
      setTexte("");
      setTitre("");
      setFiles([]);
      fetchIndexedDocs();
    } catch (err: any) {
      toast({
        title: "Erreur d'indexation",
        description: err.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (doc: IndexedDoc) => {
    const { error } = await supabase
      .from("reglements")
      .delete()
      .eq("titre_document", doc.titre)
      .eq("source", doc.source);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Supprimé", description: `"${doc.titre}" a été retiré de la base.` });
      fetchIndexedDocs();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Base de connaissances réglementaires
          </h1>
          <p className="text-muted-foreground mt-1">
            Importez les règlements (FFF, Ligue, District) pour que l'IA puisse s'appuyer sur les vrais articles dans ses analyses.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Ajouter un document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Source du document</Label>
                <Select value={source} onValueChange={(v) => setSource(v as SourceReglement)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Titre du document</Label>
                <Input
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex: Règlement Disciplinaire FFF 2024-2025"
                />
              </div>

              <div>
                <Label>Importer des fichiers (PDF ou TXT)</Label>
                <Input
                  type="file"
                  accept=".pdf,.txt"
                  multiple
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {files.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {files.length} fichiers sélectionnés
                    {loading && ` · Traitement ${currentFileIndex + 1}/${files.length}...`}
                  </p>
                )}
              </div>

              <div>
                <Label>Ou coller le texte directement</Label>
                <Textarea
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  placeholder="Collez ici le contenu du règlement..."
                  rows={10}
                />
                {texte && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {texte.length.toLocaleString()} caractères · ~{Math.ceil(texte.length / 800)} fragments
                  </p>
                )}
              </div>

              <Button onClick={handleSubmit} disabled={loading || !texte.trim() || !titre.trim()} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Indexation en cours...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Indexer le document
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Indexed documents list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents indexés ({indexedDocs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : indexedDocs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun document indexé pour le moment.
                </p>
              ) : (
                <div className="space-y-3">
                  {indexedDocs.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.titre}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={SOURCE_COLORS[doc.source]}>
                            {SOURCE_LABELS[doc.source]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {doc.chunks} fragments
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
