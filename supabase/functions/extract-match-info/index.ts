import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `Tu es un assistant spécialisé dans l'extraction d'informations à partir de documents officiels de football (feuilles de match, rapports d'arbitre, PV de commission disciplinaire, etc.).

À partir du texte fourni, extrais TOUTES les informations que tu peux trouver parmi les suivantes. Sois minutieux et intelligent dans ta recherche — les informations peuvent être sous différents formats, abréviations, ou dispositions.

INFORMATIONS À EXTRAIRE :
- date_match : la date du match (format YYYY-MM-DD)
- competition : le nom de la compétition / division / championnat / coupe
- equipe_domicile : le nom de l'équipe à domicile (recevante)
- equipe_exterieur : le nom de l'équipe à l'extérieur (visiteur)
- score : le score du match (format "X - Y")
- lieu_match : le lieu / stade / terrain du match
- arbitre_prenom : le prénom de l'arbitre
- arbitre_nom : le nom de l'arbitre
- type_incident : le type d'incident parmi ces valeurs EXACTES : exclusion_simple, violence_physique, propos_injurieux, comportement_supporters, fraude_licence, cumul_avertissements, autre
- parties : un tableau des personnes impliquées, chacune avec :
  - nom : nom de famille
  - prenom : prénom
  - type_partie : parmi joueur, entraineur, dirigeant, supporter, club
  - club : nom du club
  - est_mis_en_cause : true/false
  - role_dans_incident : description courte du rôle dans l'incident
  - numero_licence : numéro de licence si disponible

RÈGLES :
- Ne retourne QUE les champs que tu as pu identifier avec confiance
- Pour la date, convertis toujours en format YYYY-MM-DD
- Pour le type d'incident, choisis la valeur la plus appropriée parmi la liste fournie
- Pour les parties, identifie TOUS les individus mentionnés dans le contexte disciplinaire
- Les joueurs expulsés/sanctionnés sont "mis en cause"
- L'arbitre n'est PAS une partie (sauf s'il est lui-même mis en cause)
- Sois intelligent : "RC" peut signifier "Racing Club", un score "2-1" peut être écrit "2 à 1", etc.

RÉPONDS UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaire.`;

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

    const { documents_texte, images } = await req.json();

    // Build text from all documents
    let allText = "";
    for (const doc of (documents_texte || [])) {
      const t = (doc.contenu || "").trim();
      if (t && !t.startsWith("[Erreur")) {
        allText += `\n--- ${doc.type || "document"} ---\n${t}\n`;
      }
    }

    if (!allText.trim() && (!images || images.length === 0)) {
      return new Response(JSON.stringify({ extracted: null, reason: "no_text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "Clé API OpenAI non configurée." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user content - support Vision if images provided
    const userText = allText.trim()
      ? `Voici le texte extrait des documents :\n${allText}`
      : "Le texte n'a pas pu être extrait. Analyse les images ci-jointes pour trouver les informations.";

    const userContent: unknown = (images && images.length > 0)
      ? [
          { type: "text", text: userText },
          ...images.map((url: string) => ({
            type: "image_url",
            image_url: { url, detail: "high" },
          })),
        ]
      : userText;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: result.error?.message || "Erreur OpenAI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const raw = result.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle potential markdown wrapping)
    let extracted: Record<string, unknown> | null = null;
    try {
      const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse extraction result:", raw);
      extracted = null;
    }

    return new Response(JSON.stringify({ extracted }), {
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
