import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un assistant juridique expert en droit disciplinaire du football amateur français.
Tu as précédemment rédigé un rapport d'instruction. L'instructeur désigné te donne maintenant son retour et ses décisions.

TON RÔLE :
- Intégrer les remarques et décisions de l'instructeur dans le rapport existant
- Conserver la structure globale du rapport (synthèse, qualification, circonstances, sanctions, tableau)
- Conserver les citations réglementaires exactes (articles FFF, Ligue, District)
- Modifier les parties concernées par le feedback de l'instructeur
- Si l'instructeur donne une décision de sanction, l'intégrer clairement dans le rapport
- Rester objectif et factuel, même en intégrant les décisions de l'instructeur
- NE PAS supprimer d'informations factuelles existantes sauf si l'instructeur le demande explicitement

FORMAT : Retourne le rapport complet révisé en Markdown, prêt à être imprimé.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
