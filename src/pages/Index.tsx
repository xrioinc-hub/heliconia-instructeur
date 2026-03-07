import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus, FolderOpen, FileCheck, Archive, AlertTriangle, FileEdit } from "lucide-react";
import { STATUT_LABELS, GRAVITE_LABELS, TYPE_INCIDENT_LABELS } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

type Dossier = Tables<"dossiers">;

function statutBadgeVariant(statut: string) {
  switch (statut) {
    case "brouillon": return "secondary";
    case "en_instruction": return "default";
    case "rapport_genere": return "default";
    case "clos": return "outline";
    default: return "secondary";
  }
}

function statutBadgeClass(statut: string) {
  switch (statut) {
    case "en_instruction": return "bg-blue-500 text-white hover:bg-blue-600";
    case "rapport_genere": return "bg-primary text-primary-foreground";
    case "clos": return "bg-foreground text-background";
    default: return "";
  }
}

function graviteBadgeClass(gravite: string | null) {
  switch (gravite) {
    case "mineur": return "bg-green-500 text-white hover:bg-green-600";
    case "serieux": return "bg-amber-500 text-white hover:bg-amber-600";
    case "grave": return "bg-red-500 text-white hover:bg-red-600";
    case "tres_grave": return "bg-red-800 text-white hover:bg-red-900";
    default: return "";
  }
}

function isDeadlineUrgent(deadline: string | null) {
  if (!deadline) return false;
  const diff = new Date(deadline).getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterGravite, setFilterGravite] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchDossiers = async () => {
      const { data } = await supabase
        .from("dossiers")
        .select("*")
        .order("created_at", { ascending: false });
      setDossiers(data || []);
      setLoading(false);
    };
    fetchDossiers();
  }, [user]);

  const filtered = dossiers.filter((d) => {
    if (filterStatut !== "all" && d.statut !== filterStatut) return false;
    if (filterGravite !== "all" && d.gravite !== filterGravite) return false;
    if (filterType !== "all" && d.type_incident !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !d.reference.toLowerCase().includes(s) &&
        !(d.equipe_domicile || "").toLowerCase().includes(s) &&
        !(d.equipe_exterieur || "").toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const counts = {
    brouillons: dossiers.filter((d) => d.statut === "brouillon").length,
    en_cours: dossiers.filter((d) => d.statut === "en_instruction").length,
    rapports: dossiers.filter((d) => d.statut === "rapport_genere").length,
    clos: dossiers.filter((d) => d.statut === "clos").length,
    urgents: dossiers.filter(
      (d) => isDeadlineUrgent(d.deadline_defense) || isDeadlineUrgent(d.deadline_instruction)
    ).length,
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Vue d'ensemble de vos dossiers d'instruction</p>
          </div>
          <Button asChild>
            <Link to="/dossier/nouveau">
              <FilePlus className="mr-2 h-4 w-4" />
              Nouveau dossier
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Brouillons</CardTitle>
              <FileEdit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.brouillons}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">En instruction</CardTitle>
              <FolderOpen className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.en_cours}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rapports générés</CardTitle>
              <FileCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.rapports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Dossiers clos</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.clos}</div>
            </CardContent>
          </Card>
        </div>

        {/* Alerte urgences */}
        {counts.urgents > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>{counts.urgents} dossier{counts.urgents > 1 ? "s" : ""}</strong> avec une deadline dans moins de 24h
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Rechercher par référence ou équipe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {Object.entries(STATUT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterGravite} onValueChange={setFilterGravite}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Gravité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes gravités</SelectItem>
              {Object.entries(GRAVITE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {Object.entries(TYPE_INCIDENT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dossiers table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date match</TableHead>
                  <TableHead>Équipes</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Gravité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucun dossier trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono font-medium">{d.reference}</TableCell>
                      <TableCell>{d.date_match ? new Date(d.date_match).toLocaleDateString("fr-FR") : "—"}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {d.equipe_domicile || "?"} — {d.equipe_exterieur || "?"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{TYPE_INCIDENT_LABELS[d.type_incident] || d.type_incident}</TableCell>
                      <TableCell>
                        {d.gravite ? (
                          <Badge className={graviteBadgeClass(d.gravite)}>
                            {GRAVITE_LABELS[d.gravite]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statutBadgeClass(d.statut)} variant={statutBadgeVariant(d.statut) as any}>
                          {STATUT_LABELS[d.statut]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isDeadlineUrgent(d.deadline_defense) || isDeadlineUrgent(d.deadline_instruction) ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            URGENT
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={d.rapport_ia ? `/dossier/${d.id}/rapport` : `/dossier/${d.id}/edit`}>
                            Voir
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
