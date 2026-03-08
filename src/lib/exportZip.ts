import JSZip from "jszip";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { TYPE_INCIDENT_LABELS, GRAVITE_LABELS, TYPE_PARTIE_LABELS, TYPE_DOCUMENT_LABELS, STATUT_LABELS } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

type Dossier = Tables<"dossiers">;
type Partie = Tables<"parties">;
type Document = Tables<"documents">;

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

function generateHtmlReport(
  dossier: Dossier,
  parties: Partie[],
  documents: Document[],
  rapport: string,
  profile: { district: string | null; ligue: string | null } | null
): string {
  const dateMatch = dossier.date_match ? new Date(dossier.date_match).toLocaleDateString("fr-FR") : "—";
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const partiesHtml = parties.length
    ? parties
        .map(
          (p) =>
            `<tr>
              <td>${escapeHtml([p.prenom, p.nom].filter(Boolean).join(" "))}</td>
              <td>${TYPE_PARTIE_LABELS[p.type_partie] || p.type_partie}</td>
              <td>${escapeHtml(p.club || "—")}</td>
              <td>${p.est_mis_en_cause ? "Oui" : "Non"}</td>
              <td>${escapeHtml(p.role_dans_incident || "—")}</td>
            </tr>`
        )
        .join("")
    : '<tr><td colspan="5">Aucune partie</td></tr>';

  const docsHtml = documents.length
    ? documents
        .map(
          (d) =>
            `<tr>
              <td>${escapeHtml(d.nom_fichier)}</td>
              <td>${TYPE_DOCUMENT_LABELS[d.type_document] || d.type_document}</td>
              <td>${d.storage_path ? "✓ inclus dans le ZIP" : "—"}</td>
            </tr>`
        )
        .join("")
    : '<tr><td colspan="3">Aucun document</td></tr>';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport d'instruction — ${escapeHtml(dossier.reference)}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; }
  h1 { font-size: 1.5em; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; color: #1a3a5c; }
  h2 { font-size: 1.2em; color: #1a3a5c; margin-top: 1.5em; }
  h3 { font-size: 1.05em; color: #333; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.9em; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
  th { background: #f0f4f8; font-weight: 600; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .header-left { font-size: 0.85em; color: #555; }
  .badge { display: inline-block; background: #e2e8f0; padding: 2px 10px; border-radius: 12px; font-size: 0.8em; margin: 2px 4px 2px 0; }
  .rapport-body { margin-top: 20px; }
  .rapport-body h1, .rapport-body h2, .rapport-body h3 { color: #1a3a5c; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 0.8em; color: #888; text-align: center; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 12px 0; font-size: 0.9em; }
  .info-grid dt { font-weight: 600; color: #555; }
  .info-grid dd { margin: 0; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <strong>${escapeHtml(profile?.district || "District")}</strong><br/>
      ${profile?.ligue ? escapeHtml(profile.ligue) + " · " : ""}Fédération Française de Football
    </div>
    <div style="text-align:right; font-size:0.85em; color:#555;">
      Réf. ${escapeHtml(dossier.reference)}<br/>
      Généré le ${now}
    </div>
  </div>

  <h1>Rapport d'instruction — ${escapeHtml(dossier.reference)}</h1>

  <h2>Informations du match</h2>
  <div class="info-grid">
    <dt>Date</dt><dd>${dateMatch}</dd>
    <dt>Compétition</dt><dd>${escapeHtml(dossier.competition || "—")}</dd>
    <dt>Équipe domicile</dt><dd>${escapeHtml(dossier.equipe_domicile || "—")}</dd>
    <dt>Équipe extérieur</dt><dd>${escapeHtml(dossier.equipe_exterieur || "—")}</dd>
    <dt>Score</dt><dd>${escapeHtml(dossier.score || "—")}</dd>
    <dt>Lieu</dt><dd>${escapeHtml(dossier.lieu_match || "—")}</dd>
    <dt>Arbitre</dt><dd>${escapeHtml([dossier.arbitre_prenom, dossier.arbitre_nom].filter(Boolean).join(" ") || "—")}</dd>
    <dt>Type d'incident</dt><dd><span class="badge">${TYPE_INCIDENT_LABELS[dossier.type_incident] || dossier.type_incident}</span></dd>
    <dt>Gravité</dt><dd><span class="badge">${dossier.gravite ? GRAVITE_LABELS[dossier.gravite] || dossier.gravite : "—"}</span></dd>
    <dt>Statut</dt><dd><span class="badge">${STATUT_LABELS[dossier.statut] || dossier.statut}</span></dd>
  </div>

  <h2>Parties impliquées</h2>
  <table>
    <thead><tr><th>Nom</th><th>Type</th><th>Club</th><th>Mis en cause</th><th>Rôle</th></tr></thead>
    <tbody>${partiesHtml}</tbody>
  </table>

  <h2>Documents joints</h2>
  <table>
    <thead><tr><th>Fichier</th><th>Type</th><th>Inclus</th></tr></thead>
    <tbody>${docsHtml}</tbody>
  </table>

  <h2>Rapport d'instruction</h2>
  <div class="rapport-body">
    ${rapport ? markdownToHtml(rapport) : "<p><em>Aucun rapport généré.</em></p>"}
  </div>

  <div class="footer">
    Rapport d'instruction généré par intelligence artificielle le ${now}.<br/>
    Ce document doit être validé, complété et signé par l'instructeur désigné avant transmission à la Commission.
  </div>
</body>
</html>`;
}

async function htmlToPdfBlob(html: string): Promise<Blob> {
  // Render HTML in a hidden container
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px"; // A4 width at 96dpi
  container.style.background = "white";
  container.innerHTML = html;
  document.body.appendChild(container);

  // Wait for rendering
  await new Promise((r) => setTimeout(r, 200));

  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    logging: false,
    width: 794,
    windowWidth: 794,
  });

  document.body.removeChild(container);

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position -= pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  return pdf.output("blob");
}

export async function exportDossierZip(
  dossier: Dossier,
  parties: Partie[],
  documents: Document[],
  rapport: string,
  profile: { district: string | null; ligue: string | null } | null
) {
  const zip = new JSZip();
  const ref = dossier.reference || "dossier";

  // 1. Generate PDF from HTML
  const html = generateHtmlReport(dossier, parties, documents, rapport, profile);
  const pdfBlob = await htmlToPdfBlob(html);
  zip.file(`rapport-instruction-${ref}.pdf`, pdfBlob);

  // 2. Attachments
  const piecesJointes = zip.folder("pieces-jointes");
  for (const doc of documents) {
    if (!doc.storage_path) continue;
    try {
      const { data, error } = await supabase.storage
        .from("dossier-documents")
        .download(doc.storage_path);
      if (error || !data) continue;
      piecesJointes!.file(doc.nom_fichier, data);
    } catch {
      // skip failed downloads silently
    }
  }

  // 3. Generate & download
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dossier-${ref}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
