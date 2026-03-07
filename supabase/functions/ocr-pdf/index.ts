import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "Clé API OpenAI non configurée." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { images } = await req.json() as { images: string[] };

    if (!images || images.length === 0) {
      return new Response(JSON.stringify({ text: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit to 15 pages max to avoid excessive API usage
    const pagesToProcess = images.slice(0, 15);
    let fullText = "";

    for (let i = 0; i < pagesToProcess.length; i++) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Tu es un assistant de transcription de documents officiels français. Transcris fidèlement et intégralement tout le texte visible sur cette image. Conserve la structure, la mise en forme, les titres, les tableaux et les listes. Ne commente pas, transcris uniquement le contenu textuel du document.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: pagesToProcess[i],
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error(`OCR error on page ${i + 1}:`, err);
        fullText += `\n[Erreur OCR page ${i + 1}]\n`;
        continue;
      }

      const result = await response.json();
      const pageText = result.choices?.[0]?.message?.content || "";
      if (pageText) {
        fullText += (i > 0 ? "\n\n" : "") + pageText;
      }
    }

    return new Response(JSON.stringify({ text: fullText.trim() }), {
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
