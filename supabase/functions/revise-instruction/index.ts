import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un assistant juridique expert en droit disciplinaire du football amateur français.
Tu as précédemment rédigé un projet de rapport d'instruction au format officiel de procès-verbal de commission disciplinaire. L'instructeur désigné te donne maintenant son retour et ses décisions.

TON RÔLE :
- Intégrer les remarques et décisions de l'instructeur dans le rapport existant
- Conserver la structure officielle du rapport PV : Rappel des faits, Délibération (par partie), Décisions proposées (blocs ➢), Note de gravité
- Conserver les citations réglementaires exactes (articles FFF, Ligue, District) avec leurs sources
- Modifier uniquement les parties concernées par le feedback de l'instructeur
- Si l'instructeur précise une décision de sanction (nombre de matchs, montant d'amende, date de prise d'effet), remplacer les placeholders « À COMPLÉTER PAR L'INSTRUCTEUR » par ces valeurs dans les blocs de décision
- Conserver le format blockquote Markdown (lignes > **➢ ...**) pour les blocs de décision
- Conserver les paragraphes en italique (*...*) pour les mentions d'effet suspensif et les voies de recours
- Rester objectif et factuel, même en intégrant les décisions de l'instructeur
- NE PAS supprimer d'informations factuelles existantes sauf si l'instructeur le demande explicitement

FORMAT : Retourne le rapport complet révisé en Markdown strict, identique au format d'origine, prêt à être imprimé.`;

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

    // Verify user identity
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

    const { rapport_actuel, feedback_instructeur } = await req.json();

    if (!rapport_actuel || !feedback_instructeur) {
      return new Response(
        JSON.stringify({ error: "rapport_actuel et feedback_instructeur sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Voici le rapport d'instruction actuel :\n\n${rapport_actuel}\n\n---\n\nRetour de l'instructeur :\n${feedback_instructeur}\n\nMerci de produire le rapport révisé complet en Markdown.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA insuffisants." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const revisedReport = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ rapport: revisedReport }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("revise-instruction error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur interne";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
