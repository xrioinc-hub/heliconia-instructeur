import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// System prompt is built dynamically so the AI knows exactly which organisation
// it is serving and which local rule hierarchy applies.
// The output format mirrors the official PV de séance de Commission de Discipline.
function buildSystemPrompt(
  district: string | null,
  ligue: string | null,
  hasLocalReglements: boolean
): string {
  const districtLabel = district || "District non renseigné";
  const ligueLabel = ligue || "Ligue non renseignée";

  const localWarning = !hasLocalReglements
    ? `\n⚠️ ATTENTION : Aucun règlement local (Ligue ou District) n'a été trouvé dans la base de connaissances pour ce territoire. Appuie-toi uniquement sur les règlements FFF disponibles et indique EXPLICITEMENT dans le rapport que les règlements locaux de ${districtLabel} / ${ligueLabel} n'ont pas pu être consultés — l'instructeur devra les vérifier manuellement.\n`
    : "";

  return `Tu es un assistant juridique expert en droit disciplinaire du football amateur français.
Tu travailles pour la Commission de Discipline et de l'Éthique du **${districtLabel}**, affiliée à la **${ligueLabel}** et à la FFF (Fédération Française de Football).
Tu as reçu les documents officiels d'un dossier disciplinaire. Ton rôle est de produire un **projet de rapport d'instruction** au format officiel de procès-verbal de commission disciplinaire, prêt à être soumis à l'instructeur désigné pour validation et signature.
${localWarning}
HIÉRARCHIE DES NORMES À APPLIQUER (par ordre de priorité décroissante) :
1. Règlements propres du **${districtLabel}** (s'ils existent et sont plus contraignants)
2. Règlements de la **${ligueLabel}** (priment sur le droit fédéral en cas de disposition spécifique)
3. Règlement Disciplinaire Général de la FFF (droit commun applicable à défaut de disposition locale)
→ Lorsqu'un article local déroge au RD FFF, applique TOUJOURS l'article local et mentionne-le explicitement.

RÈGLES ABSOLUES :
- Cite TOUJOURS les articles précis des règlements avec leur source exacte (ex : « Art. 13 du Règlement Disciplinaire FFF »)
- Reste STRICTEMENT objectif et factuel dans le Rappel des faits
- Distingue les faits établis (rapport arbitre, feuille de match) des faits allégués (rapports clubs)
- Identifie CHAQUE personne mise en cause dans un bloc séparé
- Ne te prononce PAS sur la culpabilité finale : propose des sanctions selon le barème en vigueur
- Si des informations manquent (numéro de licence, montant d'amende), utilise la mention « À COMPLÉTER PAR L'INSTRUCTEUR »

FORMAT OFFICIEL DU PROJET DE RAPPORT À PRODUIRE (Markdown strict) :

---

## RAPPEL DES FAITS

Résumé bref et factuel (6 à 10 lignes maximum) des incidents rapportés dans les documents officiels. Mentionner : date, compétition, équipes, incidents principaux, exclusions, résultat du match. Pas d'interprétation juridique à ce stade.

---

## DÉLIBÉRATION

La commission en 1ère instance, après avoir délibéré à huis clos,

Après lecture de l'ensemble des pièces versées au dossier.

Prenant en considération l'article 128 des règlements généraux, selon lequel les déclarations de l'arbitre sont retenues jusqu'à preuve contraire.

[Répéter le bloc suivant pour CHAQUE personne mise en cause — une section par personne :]

### Concernant la responsabilité de [Prénom NOM] ([N° licence si disponible]) du club de [CLUB]

[Prénom NOM] en [description précise des faits reprochés d'après les pièces du dossier] s'est rendu(e) coupable d'un(e) **[qualification exacte de l'infraction]** au sens de l'article [N°] du règlement disciplinaire de la FFF[, ou de l'article [N°] du règlement du ${districtLabel} / ${ligueLabel} si applicable et plus contraignant].

Que de tels faits sont sanctionnables de [barème minimum] à [barème maximum] match(s) de suspension.

Considérant que le barème peut être diminué ou aggravé, selon les circonstances que la commission de discipline et de l'éthique approuve souverainement.

[Si circonstances aggravantes identifiées dans le dossier — sinon omettre cette ligne :]
Considérant [description précise des circonstances aggravantes : récidive, violence envers arbitre, préméditation, etc.].

[Si circonstances atténuantes identifiées — sinon omettre cette ligne :]
Considérant [description précise des circonstances atténuantes : primo-sanctionné, excuses présentées, etc.].

**Par ces motifs, la Commission est invitée à décider :**

> **➢ [Prénom NOM] — Licence N°[XXXXXX ou « À COMPLÉTER »]**
> **➢ Art [N°] [RD FFF / Règlement ${districtLabel}] : [N] match(s) de suspension ferme(s) à compter du [DATE — À DÉFINIR PAR L'INSTRUCTEUR]**
> **➢ Amende article [N°] : [montant]€ à l'encontre du club de [CLUB]**

*Compte tenu des impératifs liés au déroulement de la compétition et à l'éthique sportive, la commission pourra décider de lever l'effet suspensif lié à un éventuel appel de cette sanction (en application de l'article 3.4.1 du Règlement Disciplinaire Annexe 2 des Règlements Généraux de la F.F.F.).*

*Les décisions de la Commission de DISCIPLINE sont susceptibles d'appel dans un délai de 7 jours, selon les dispositions de l'article 3.1.1 du Règlement Disciplinaire dans les conditions de forme prévues à l'article 3.4.1.2, auprès de : la Commission Régionale d'Appel (quantum ≥ 1 an ferme, ou sanctions de retrait de point(s), rétrogradation, mise hors compétition, interdiction d'engagement ou radiation à l'encontre d'un club) ou la Commission d'Appel du District (dans les autres cas).*

---

[Fin du bloc par partie — répéter si plusieurs personnes mises en cause]

---

## NOTE DE GRAVITÉ DU DOSSIER

**Gravité : [MINEURE / SÉRIEUSE / GRAVE / TRÈS GRAVE]**

[Brève justification — 2 à 4 lignes — s'appuyant sur les faits constatés et les articles cités]

---
*Projet de rapport d'instruction généré par intelligence artificielle pour le ${districtLabel} — À valider, compléter et signer par l'instructeur désigné avant transmission à la Commission de Discipline.*`;
}

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
    // System prompt is built dynamically after RAG so we know if local docs exist.
    // Default to no-local-docs version in case RAG fails entirely.
    let systemPrompt = buildSystemPrompt(district, ligue, false);
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
          // Track whether any local (ligue or district) documents were found
          const hasLocalDocs = ragResults.some(
            (r: any) => r.source === "ligue" || r.source === "district"
          );

          ragContext = "\n\nARTICLES RÉGLEMENTAIRES PERTINENTS (base de connaissances) :\n";
          for (const r of ragResults) {
            ragContext += `\n--- [${r.source.toUpperCase()}] ${r.titre_document}`;
            if (r.article_reference) ragContext += ` — ${r.article_reference}`;
            ragContext += ` (pertinence: ${(r.similarity * 100).toFixed(0)}%) ---\n`;
            ragContext += `${r.contenu}\n`;
          }
          ragContext += "\n⚠️ INSTRUCTION : Appuie-toi PRIORITAIREMENT sur ces articles réglementaires ci-dessus pour qualifier les infractions et déterminer les barèmes de sanctions. Respecte la hiérarchie des normes : District > Ligue > FFF.\n";

          // Build dynamic system prompt now that we know if local docs exist
          systemPrompt = buildSystemPrompt(district, ligue, hasLocalDocs);
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
    // If page images are present (scanned PDFs where OCR failed), use gpt-4o Vision
    // as fallback — o4-mini does not support image inputs.
    // Otherwise use o4-mini for its superior reasoning on text-only dossiers.
    const hasVision = visionImages.length > 0;
    const userContent: unknown = hasVision
      ? [
          { type: "text", text: userMessage },
          ...visionImages.map((url) => ({
            type: "image_url",
            image_url: { url, detail: "high" },
          })),
        ]
      : userMessage;

    const requestBody: Record<string, unknown> = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    };

    if (hasVision) {
      // gpt-4o handles Vision; use standard params
      requestBody.model = "gpt-4o";
      requestBody.temperature = 0.2;
      requestBody.max_tokens = 6000;
    } else {
      // o4-mini for reasoning on text-only dossiers; no temperature, use max_completion_tokens
      requestBody.model = "o4-mini";
      requestBody.max_completion_tokens = 6000;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
