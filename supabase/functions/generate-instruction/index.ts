import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un assistant juridique expert en droit disciplinaire du football amateur français.
Tu travailles pour le service instructeur d'un District et d'une Ligue régionale affiliés à la FFF (Fédération Française de Football).
Tu as reçu les documents officiels d'un dossier disciplinaire et ton rôle est de produire un rapport d'instruction complet, objectif et rigoureux.

RÈGLES ABSOLUES :
- Tu cites TOUJOURS les articles précis des règlements sur lesquels tu t'appuies (Règlement Disciplinaire FFF, Règlements de la Ligue, Règlements du District)
- Tu restes STRICTEMENT objectif et factuel
- Tu distingues clairement les FAITS ÉTABLIS des FAITS ALLÉGUÉS
- Tu ne te prononces PAS sur la culpabilité finale — tu exposes les faits et les sanctions POSSIBLES
- Tu identifies CHAQUE partie impliquée séparément
- Tu précises pour CHAQUE infraction : la qualification, l'article applicable, le barème de sanction minimum et maximum

FORMAT DU RAPPORT À PRODUIRE :

## 1. SYNTHÈSE DES FAITS
Résumé factuel des incidents rapportés dans les documents fournis.

## 2. QUALIFICATION DES INFRACTIONS
Pour chaque infraction identifiée :
- **Infraction n°X** : [Qualification exacte]
  - Partie concernée : [Nom, qualité]
  - Faits retenus : [Description précise]
  - Textes applicables : [Articles FFF / Ligue / District]
  - Barème de sanction : [Minimum — Maximum selon les règlements]

## 3. ANALYSE DES CIRCONSTANCES
- Circonstances aggravantes éventuelles (récidive, préméditation, violence envers arbitre, etc.)
- Circonstances atténuantes éventuelles
- Précédents disciplinaires mentionnés dans les documents

## 4. SANCTIONS POSSIBLES PAR PARTIE
Pour chaque partie mise en cause, liste des sanctions envisageables selon les règlements, du minimum au maximum.

## 5. SYNTHÈSE ET RECOMMANDATIONS DE L'INSTRUCTEUR
Tableau récapitulatif :
| Partie | Infraction | Articles | Sanction minimale | Sanction maximale |
|--------|-----------|---------|------------------|------------------|

Note de gravité globale du dossier : [MINEURE / SÉRIEUSE / GRAVE / TRÈS GRAVE]
Justification de la note de gravité.

---
*Rapport généré par l'IA — à valider et compléter par l'instructeur désigné*`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const { documents_texte, contexte, infos_match, parties, dossier_id } = await req.json();

    // Get user profile for district/ligue
    const { data: profile } = await supabase
      .from("profiles")
      .select("district, ligue")
      .eq("id", userId)
      .single();

    const district = profile?.district || null;
    const ligue = profile?.ligue || null;
    const districtLabel = district || "Non renseigné";
    const ligueLabel = ligue || "Non renseigné";

    // Build user message
    let userMessage = `DOSSIER D'INSTRUCTION\n\n`;
    userMessage += `District : ${districtLabel}\nLigue : ${ligueLabel}\n\n`;
    userMessage += `INFORMATIONS DU MATCH :\n`;
    userMessage += `- Date : ${infos_match.date_match || "Non renseignée"}\n`;
    userMessage += `- Compétition : ${infos_match.competition || "Non renseignée"}\n`;
    userMessage += `- ${infos_match.equipe_domicile || "?"} vs ${infos_match.equipe_exterieur || "?"}\n`;
    userMessage += `- Score : ${infos_match.score || "Non renseigné"}\n`;
    userMessage += `- Lieu : ${infos_match.lieu_match || "Non renseigné"}\n`;
    userMessage += `- Arbitre : ${infos_match.arbitre || "Non renseigné"}\n\n`;

    userMessage += `PARTIES IMPLIQUÉES :\n`;
    if (parties && parties.length > 0) {
      for (const p of parties) {
        userMessage += `- ${p.prenom || ""} ${p.nom || ""} (${p.type || ""}, club: ${p.club || "?"})`;
        if (p.mis_en_cause) userMessage += " [MIS EN CAUSE]";
        if (p.role) userMessage += ` — Rôle: ${p.role}`;
        userMessage += "\n";
      }
    }

    userMessage += `\nDOCUMENTS OFFICIELS :\n`;
    // Truncate if > 100k chars, prioritize rapport_arbitre then feuille_match
    let totalChars = 0;
    const MAX_CHARS = 100000;
    const sortedDocs = [...(documents_texte || [])].sort((a: any, b: any) => {
      const priority: Record<string, number> = { rapport_arbitre: 0, feuille_match: 1, rapport_delegue: 2, rapport_club: 3 };
      return (priority[a.type] ?? 4) - (priority[b.type] ?? 4);
    });

    // Markers that indicate extraction failed on the client — never send these to the AI.
    const EXTRACTION_ERROR_MARKERS = [
      "[Erreur d'extraction PDF]",
      "[Erreur d'extraction DOCX]",
      "[Erreur OCR",
      "[Aucun texte extrait par OCR]",
    ];

    const failedDocs: string[] = [];
    let hasValidDoc = false;
    // Collect page images from scanned docs where text extraction failed.
    // These will be added to the GPT-4o Vision call as a last-resort fallback.
    const visionImages: string[] = [];

    for (const doc of sortedDocs) {
      const docText = (doc.contenu || "").trim();

      // Check whether extraction failed on the client.
      const isError = !docText || EXTRACTION_ERROR_MARKERS.some((marker) => docText.startsWith(marker));
      if (isError) {
        // If the client provided page images, use them via Vision.
        if (Array.isArray(doc.images) && doc.images.length > 0) {
          userMessage += `\n--- ${doc.type} (document scanné — analysé via les images ci-jointes) ---\n`;
          visionImages.push(...(doc.images as string[]));
          hasValidDoc = true;
        } else {
          failedDocs.push(doc.type);
        }
        continue;
      }

      if (totalChars + docText.length > MAX_CHARS) {
        const remaining = MAX_CHARS - totalChars;
        if (remaining > 500) {
          userMessage += `\n--- ${doc.type} (tronqué) ---\n${docText.substring(0, remaining)}\n[...TRONQUÉ]\n`;
        }
        break;
      }
      userMessage += `\n--- ${doc.type} ---\n${docText}\n`;
      totalChars += docText.length;
      hasValidDoc = true;
    }

    if (failedDocs.length > 0) {
      userMessage += `\n⚠️ AVERTISSEMENT : Les documents suivants n'ont pas pu être extraits et sont absents de cette analyse : ${failedDocs.join(", ")}. Mentionne cette lacune dans le rapport et indique quels documents manquants seraient nécessaires pour compléter l'instruction.\n`;
    }

    if (!hasValidDoc) {
      userMessage += `\n⚠️ AUCUN document n'a pu être extrait. Indique clairement dans le rapport que l'instruction ne peut pas être réalisée faute de documents lisibles, et liste les documents qui devraient être fournis (feuille de match, rapport d'arbitre, etc.).\n`;
    }

    if (contexte) {
      userMessage += `\nCONTEXTE SUPPLÉMENTAIRE DE L'INSTRUCTEUR :\n${contexte}\n`;
    }

    userMessage += `\n*District : ${districtLabel} | Ligue : ${ligueLabel}*`;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "Clé API OpenAI non configurée. Ajoutez OPENAI_API_KEY dans les secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- RAG: Search relevant regulatory articles ---
    let ragContext = "";
    try {
      // Build a rich search query from the dossier context for better semantic matching
      const queryParts = [
        infos_match.competition || "",
        infos_match.type_incident || "",
        parties?.map((p: any) => `${p.type || ""} ${p.role || ""}`).join(" ") || "",
        "dossier disciplinaire sanctions barème",
      ];
      // Include a snippet of document content for better matching
      const docSnippet = sortedDocs
        .map((d: any) => (d.contenu || "").substring(0, 300))
        .join(" ")
        .substring(0, 500);
      if (docSnippet.trim()) queryParts.push(docSnippet);
      if (contexte) queryParts.push(contexte.substring(0, 200));

      const ragQuery = queryParts.filter(Boolean).join(" ").substring(0, 1000);

      const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: ragQuery,
        }),
      });

      if (embResponse.ok) {
        const embResult = await embResponse.json();
        const queryEmbedding = embResult.data[0].embedding;

        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: ragResults } = await supabaseAdmin.rpc("match_reglements", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.55,
          match_count: 25,
          filter_source: null,
          filter_district: district,
          filter_ligue: ligue,
        });

        if (ragResults && ragResults.length > 0) {
          ragContext = "\n\nARTICLES RÉGLEMENTAIRES PERTINENTS (base de connaissances) :\n";
          for (const r of ragResults) {
            ragContext += `\n--- [${r.source.toUpperCase()}] ${r.titre_document}`;
            if (r.article_reference) ragContext += ` — ${r.article_reference}`;
            ragContext += ` (pertinence: ${(r.similarity * 100).toFixed(0)}%) ---\n`;
            ragContext += `${r.contenu}\n`;
          }
          ragContext += "\n⚠️ INSTRUCTION : Appuie-toi PRIORITAIREMENT sur ces articles réglementaires ci-dessus pour qualifier les infractions et déterminer les barèmes de sanctions. Cite les articles précis avec leur source (FFF, Ligue, District).\n";
        }
      }
    } catch (ragErr) {
      console.error("RAG search failed (non-blocking):", ragErr);
    }

    // Append RAG context to user message
    if (ragContext) {
      userMessage += ragContext;
    }

    // Build the user message content.
    // If page images are present (scanned PDFs where OCR failed), use the Vision API.
    // Otherwise keep a plain string to avoid unnecessary overhead.
    const userContent: unknown = visionImages.length > 0
      ? [
          { type: "text", text: userMessage },
          ...visionImages.map((url) => ({
            type: "image_url",
            image_url: { url, detail: "high" },
          })),
        ]
      : userMessage;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "o4-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 6000,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: result.error?.message || "Erreur OpenAI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rapport = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ rapport }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
