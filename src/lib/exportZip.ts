import JSZip from "jszip";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { TYPE_PARTIE_LABELS, TYPE_DOCUMENT_LABELS } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

type Dossier = Tables<"dossiers">;
type Partie = Tables<"parties">;
type Document = Tables<"documents">;

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Apply inline Markdown formatting to already-escaped text.
// Input must already have & < > escaped.
function applyInlineFormatting(text: string): string {
  return text
    // Bold (**text**)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic (*text*) — only if not already consumed by bold
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>");
}

// Converts Markdown to HTML with proper handling for blockquotes (decision boxes),
// horizontal rules, headings, lists, bold/italic, and paragraphs.
// Processes line-by-line to correctly handle blockquotes and other block elements.
function markdownToHtml(md: string): string {
  // Escape HTML special characters first to prevent injection from AI-generated content.
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const output: string[] = [];
  let pendingParagraphLines: string[] = [];
  let inBlockquote = false;
  let inList = false;

  const flushParagraph = () => {
    if (pendingParagraphLines.length === 0) return;
    output.push(`<p>${applyInlineFormatting(pendingParagraphLines.join("<br/>"))}</p>`);
    pendingParagraphLines = [];
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      output.push("</blockquote>");
      inBlockquote = false;
    }
  };

  const closeList = () => {
    if (inList) {
      output.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // --- Empty line: flush everything ---
    if (!trimmed) {
      closeBlockquote();
      closeList();
      flushParagraph();
      continue;
    }

    // --- Horizontal rule ---
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      closeBlockquote();
      closeList();
      flushParagraph();
      output.push('<hr class="pv-separator"/>');
      continue;
    }

    // --- Headings ---
    if (trimmed.startsWith("### ")) {
      closeBlockquote();
      closeList();
      flushParagraph();
      output.push(`<h3>${applyInlineFormatting(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeBlockquote();
      closeList();
      flushParagraph();
      output.push(`<h2>${applyInlineFormatting(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeBlockquote();
      closeList();
      flushParagraph();
      output.push(`<h1>${applyInlineFormatting(trimmed.slice(2))}</h1>`);
      continue;
    }

    // --- Blockquote (decision box): lines starting with "&gt; " (escaped "> ") ---
    if (trimmed.startsWith("&gt;")) {
      closeList();
      flushParagraph();
      if (!inBlockquote) {
        output.push('<blockquote class="decision-box">');
        inBlockquote = true;
      }
      // Strip the "&gt; " or "&gt;" prefix
      const content = trimmed.startsWith("&gt; ")
        ? trimmed.slice(5)
        : trimmed.slice(4);
      output.push(`<p>${applyInlineFormatting(content)}</p>`);
      continue;
    }

    // --- List item ---
    if (trimmed.startsWith("- ")) {
      closeBlockquote();
      flushParagraph();
      if (!inList) {
        output.push("<ul>");
        inList = true;
      }
      output.push(`<li>${applyInlineFormatting(trimmed.slice(2))}</li>`);
      continue;
    }

    // --- Regular line: accumulate into paragraph ---
    // If we were in a blockquote or list, close them first
    closeBlockquote();
    closeList();
    pendingParagraphLines.push(trimmed);
  }

  // Flush any remaining content
  closeBlockquote();
  closeList();
  flushParagraph();

  return output.join("\n");
}

function generateHtmlReport(
  dossier: Dossier,
  parties: Partie[],
  documents: Document[],
  rapport: string,
  profile: { district: string | null; ligue: string | null } | null
): string {
  const districtLabel = escapeHtml(profile?.district || "District");
  const ligueLabel = profile?.ligue ? escapeHtml(profile.ligue) : "";
  const dateMatch = dossier.date_match ? new Date(dossier.date_match).toLocaleDateString("fr-FR") : "—";
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const arbitreLabel = escapeHtml([dossier.arbitre_prenom, dossier.arbitre_nom].filter(Boolean).join(" ") || "—");

  const partiesHtml = parties.length
    ? parties
        .filter((p) => p.est_mis_en_cause)
        .map(
          (p) =>
            `<div class="partie-line">❖ <strong>${escapeHtml([p.prenom, p.nom].filter(Boolean).join(" "))}</strong>` +
            ` — ${TYPE_PARTIE_LABELS[p.type_partie] || p.type_partie}, club&nbsp;: ${escapeHtml(p.club || "—")}` +
            (p.role_dans_incident ? ` — Rôle&nbsp;: ${escapeHtml(p.role_dans_incident)}` : "") +
            `</div>`
        )
        .join("")
    : "<p><em>Aucune partie mise en cause.</em></p>";

  const docsHtml = documents.length
    ? documents
        .map(
          (d) =>
            `<tr>
              <td>${escapeHtml(d.nom_fichier)}</td>
              <td>${TYPE_DOCUMENT_LABELS[d.type_document] || d.type_document}</td>
            </tr>`
        )
        .join("")
    : '<tr><td colspan="2"><em>Aucun document</em></td></tr>';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport d'instruction — ${escapeHtml(dossier.reference)}</title>
<style>
  /* ---- PAGE ---- */
  @page { size: A4 portrait; margin: 18mm 16mm 22mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    color: #111;
    line-height: 1.55;
    background: white;
    margin: 0;
    padding: 0;
  }

  /* ---- EN-TÊTE ---- */
  .doc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .doc-header-left { font-size: 9.5pt; color: #444; }
  .doc-header-left .district-name { font-size: 13pt; font-weight: bold; color: #111; margin-bottom: 2px; }
  .doc-header-right { text-align: right; font-size: 9pt; color: #555; }
  .doc-divider { height: 3px; background: #1b3a6b; margin: 6px 0 14px 0; }

  /* ---- BANNIÈRE TITRE ---- */
  .title-banner {
    background: #1b3a6b;
    color: white;
    text-align: center;
    padding: 10px 16px;
    margin-bottom: 16px;
    line-height: 1.7;
  }
  .title-banner .t1 { font-size: 11.5pt; font-weight: bold; letter-spacing: 0.5px; }
  .title-banner .t2 { font-size: 11pt; font-weight: bold; }
  .title-banner .t3 { font-size: 9.5pt; margin-top: 2px; opacity: 0.9; }

  /* ---- BOX MATCH ---- */
  .match-banner {
    background: #1b3a6b;
    color: white;
    text-align: center;
    padding: 9px 14px;
    margin-bottom: 16px;
    font-weight: bold;
    line-height: 1.7;
    font-size: 10.5pt;
  }
  .match-banner .match-teams { font-size: 11.5pt; }
  .match-banner .match-detail { font-weight: normal; font-size: 9.5pt; }

  /* ---- SECTION PARTIES ---- */
  .parties-block {
    border: 1px solid #bbb;
    padding: 8px 14px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .parties-block .block-title {
    font-weight: bold;
    text-decoration: underline;
    margin-bottom: 6px;
    font-size: 10.5pt;
  }
  .partie-line { margin-bottom: 4px; font-size: 10pt; }

  /* ---- DOCUMENTS JOINTS ---- */
  .docs-block { margin-bottom: 16px; }
  .docs-block table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .docs-block th { background: #e8ecf2; font-weight: bold; padding: 5px 8px; border: 1px solid #ccc; text-align: left; }
  .docs-block td { padding: 4px 8px; border: 1px solid #ccc; }

  /* ---- CORPS DU RAPPORT ---- */
  .rapport-body { margin-bottom: 20px; }
  .rapport-body h1 { font-size: 12.5pt; font-weight: bold; color: #1b3a6b; margin: 16px 0 8px 0; page-break-after: avoid; }
  .rapport-body h2 { font-size: 11.5pt; font-weight: bold; color: #1b3a6b; text-decoration: underline; margin: 14px 0 7px 0; page-break-after: avoid; }
  .rapport-body h3 { font-size: 10.5pt; font-weight: bold; color: #111; margin: 12px 0 6px 0; page-break-after: avoid; }
  .rapport-body p { margin: 0 0 7px 0; text-align: justify; orphans: 3; widows: 3; }
  .rapport-body strong { font-weight: bold; }
  .rapport-body em { font-style: italic; font-size: 9.5pt; color: #333; }
  .rapport-body ul { margin: 5px 0 9px 22px; }
  .rapport-body li { margin-bottom: 3px; }
  .rapport-body hr.pv-separator { border: none; border-top: 1px solid #ccc; margin: 12px 0; }

  /* ---- BLOC DÉCISION (blockquote) ---- */
  .rapport-body blockquote.decision-box {
    border: 1.5px solid #1b3a6b;
    padding: 8px 14px;
    margin: 10px 0 14px 0;
    page-break-inside: avoid;
    background: #f5f7fb;
  }
  .rapport-body blockquote.decision-box p {
    margin: 2px 0;
    text-align: left;
    font-weight: bold;
  }

  /* ---- AVERTISSEMENT IA ---- */
  .disclaimer {
    font-size: 8.5pt;
    color: #666;
    font-style: italic;
    border-top: 1px solid #ccc;
    padding-top: 8px;
    margin: 30px 0 20px 0;
    text-align: justify;
  }

  /* ---- SIGNATURES ---- */
  .signature-row { display: flex; gap: 24px; justify-content: space-around; margin-top: 36px; page-break-inside: avoid; }
  .signature-box {
    background: #1b3a6b;
    color: white;
    padding: 10px 20px;
    text-align: center;
    min-width: 180px;
  }
  .signature-box .sig-title { font-weight: bold; font-size: 9.5pt; }
  .signature-space { height: 48px; }
</style>
</head>
<body>

  <!-- EN-TÊTE -->
  <div class="doc-header">
    <div class="doc-header-left">
      <div class="district-name">${districtLabel}</div>
      ${ligueLabel ? `<div>${ligueLabel} · Fédération Française de Football</div>` : "<div>Fédération Française de Football</div>"}
    </div>
    <div class="doc-header-right">
      Réf. <strong>${escapeHtml(dossier.reference)}</strong><br/>
      Généré le ${now}
    </div>
  </div>
  <div class="doc-divider"></div>

  <!-- TITRE -->
  <div class="title-banner">
    <div class="t1">${districtLabel.toUpperCase()}</div>
    <div class="t2">COMMISSION DE DISCIPLINE ET DE L'ÉTHIQUE</div>
    <div class="t3">PROJET DE RAPPORT D'INSTRUCTION — ${escapeHtml(dossier.reference)}</div>
  </div>

  <!-- INFO MATCH -->
  <div class="match-banner">
    ${dossier.date_match ? `<div>Journée du ${dateMatch}</div>` : ""}
    ${dossier.competition ? `<div>${escapeHtml(dossier.competition)}</div>` : ""}
    <div class="match-teams">${escapeHtml(dossier.equipe_domicile || "?")} — ${escapeHtml(dossier.equipe_exterieur || "?")}</div>
    ${dossier.score ? `<div class="match-detail">Score : ${escapeHtml(dossier.score)}</div>` : ""}
    ${dossier.lieu_match ? `<div class="match-detail">Lieu : ${escapeHtml(dossier.lieu_match)}</div>` : ""}
    ${(dossier.arbitre_prenom || dossier.arbitre_nom) ? `<div class="match-detail">Arbitre : ${arbitreLabel}</div>` : ""}
  </div>

  <!-- PARTIES MISES EN CAUSE -->
  ${parties.filter((p) => p.est_mis_en_cause).length > 0 ? `
  <div class="parties-block">
    <div class="block-title">Parties mises en cause</div>
    ${partiesHtml}
  </div>` : ""}

  <!-- DOCUMENTS JOINTS -->
  ${documents.length > 0 ? `
  <div class="docs-block">
    <table>
      <thead><tr><th>Document</th><th>Type</th></tr></thead>
      <tbody>${docsHtml}</tbody>
    </table>
  </div>` : ""}

  <!-- RAPPORT IA -->
  <div class="rapport-body">
    ${rapport ? markdownToHtml(rapport) : "<p><em>Aucun rapport généré.</em></p>"}
  </div>

  <!-- AVERTISSEMENT -->
  <div class="disclaimer">
    Projet de rapport d'instruction généré par intelligence artificielle le ${now}.
    Ce document doit être validé, complété et signé par l'instructeur désigné avant transmission à la Commission de Discipline.
  </div>

  <!-- SIGNATURES -->
  <div class="signature-row">
    <div class="signature-box">
      <div class="sig-title">Secrétaire de séance</div>
      <div class="signature-space"></div>
    </div>
    <div class="signature-box">
      <div class="sig-title">Instructeur désigné</div>
      <div class="signature-space"></div>
    </div>
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
