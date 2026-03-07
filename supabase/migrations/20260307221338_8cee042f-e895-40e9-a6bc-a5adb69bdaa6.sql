
-- Add tenant columns to reglements table
ALTER TABLE public.reglements ADD COLUMN IF NOT EXISTS district text DEFAULT NULL;
ALTER TABLE public.reglements ADD COLUMN IF NOT EXISTS ligue text DEFAULT NULL;

-- Update match_reglements to filter by tenant context
CREATE OR REPLACE FUNCTION public.match_reglements(
  query_embedding extensions.vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 10,
  filter_source source_reglement DEFAULT NULL,
  filter_district text DEFAULT NULL,
  filter_ligue text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  source source_reglement,
  titre_document text,
  article_reference text,
  contenu text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.source,
    r.titre_document,
    r.article_reference,
    r.contenu,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM public.reglements r
  WHERE
    1 - (r.embedding <=> query_embedding) > match_threshold
    AND (filter_source IS NULL OR r.source = filter_source)
    AND (
      -- FFF docs are global, accessible to everyone
      r.source = 'fff'
      -- Ligue docs: match by ligue name
      OR (r.source = 'ligue' AND (filter_ligue IS NULL OR r.ligue = filter_ligue))
      -- District docs: match by district name
      OR (r.source = 'district' AND (filter_district IS NULL OR r.district = filter_district))
    )
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
