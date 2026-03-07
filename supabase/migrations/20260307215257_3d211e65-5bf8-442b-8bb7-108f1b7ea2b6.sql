
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create enum for document source
CREATE TYPE public.source_reglement AS ENUM ('fff', 'ligue', 'district');

-- Table for regulatory document chunks with embeddings
CREATE TABLE public.reglements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source source_reglement NOT NULL,
  titre_document text NOT NULL,
  article_reference text DEFAULT '',
  contenu text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.reglements ENABLE ROW LEVEL SECURITY;

-- Admins can do everything, authenticated users can read
CREATE POLICY "Authenticated users can view reglements"
  ON public.reglements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert reglements"
  ON public.reglements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reglements"
  ON public.reglements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reglements"
  ON public.reglements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for vector similarity search
CREATE INDEX ON public.reglements USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function to search similar regulatory chunks
CREATE OR REPLACE FUNCTION public.match_reglements(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_source source_reglement DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source source_reglement,
  titre_document text,
  article_reference text,
  contenu text,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
