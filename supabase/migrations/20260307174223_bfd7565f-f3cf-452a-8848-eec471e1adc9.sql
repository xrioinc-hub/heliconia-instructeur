
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.statut_dossier AS ENUM ('brouillon', 'en_instruction', 'rapport_genere', 'clos');
CREATE TYPE public.type_incident AS ENUM ('exclusion_simple', 'violence_physique', 'propos_injurieux', 'comportement_supporters', 'fraude_licence', 'cumul_avertissements', 'autre');
CREATE TYPE public.gravite_niveau AS ENUM ('mineur', 'serieux', 'grave', 'tres_grave');
CREATE TYPE public.type_partie AS ENUM ('joueur', 'entraineur', 'dirigeant', 'supporter', 'club');
CREATE TYPE public.type_document AS ENUM ('feuille_match', 'rapport_arbitre', 'rapport_delegue', 'rapport_club', 'piece_defense', 'autre');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  prenom TEXT,
  nom TEXT,
  email TEXT,
  district TEXT DEFAULT '',
  ligue TEXT DEFAULT '',
  poste TEXT DEFAULT 'instructeur',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Admin can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create dossiers table
CREATE TABLE public.dossiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  statut public.statut_dossier NOT NULL DEFAULT 'brouillon',
  type_incident public.type_incident NOT NULL DEFAULT 'autre',
  gravite public.gravite_niveau,
  date_match DATE,
  competition TEXT DEFAULT '',
  equipe_domicile TEXT DEFAULT '',
  equipe_exterieur TEXT DEFAULT '',
  score TEXT DEFAULT '',
  arbitre_nom TEXT DEFAULT '',
  arbitre_prenom TEXT DEFAULT '',
  lieu_match TEXT DEFAULT '',
  contexte_supplementaire TEXT DEFAULT '',
  rapport_ia TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deadline_defense TIMESTAMP WITH TIME ZONE,
  deadline_instruction TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dossiers" ON public.dossiers FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own dossiers" ON public.dossiers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dossiers" ON public.dossiers FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Create parties table
CREATE TABLE public.parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  type_partie public.type_partie NOT NULL DEFAULT 'joueur',
  nom TEXT NOT NULL DEFAULT '',
  prenom TEXT DEFAULT '',
  numero_licence TEXT DEFAULT '',
  club TEXT DEFAULT '',
  role_dans_incident TEXT DEFAULT '',
  est_mis_en_cause BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view parties of own dossiers" ON public.parties FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.dossiers WHERE dossiers.id = dossier_id AND (dossiers.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users can insert parties to own dossiers" ON public.parties FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.dossiers WHERE dossiers.id = dossier_id AND dossiers.user_id = auth.uid()));
CREATE POLICY "Users can update parties of own dossiers" ON public.parties FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.dossiers WHERE dossiers.id = dossier_id AND dossiers.user_id = auth.uid()));
CREATE POLICY "Users can delete parties of own dossiers" ON public.parties FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.dossiers WHERE dossiers.id = dossier_id AND dossiers.user_id = auth.uid()));

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  type_document public.type_document NOT NULL DEFAULT 'autre',
  nom_fichier TEXT NOT NULL DEFAULT '',
  taille BIGINT DEFAULT 0,
  storage_path TEXT DEFAULT '',
  contenu_texte TEXT DEFAULT '',
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents of own dossiers" ON public.documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.dossiers WHERE dossiers.id = dossier_id AND (dossiers.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users can insert documents to own dossiers" ON public.documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.dossiers WHERE dossiers.id = dossier_id AND dossiers.user_id = auth.uid()));
CREATE POLICY "Users can update documents of own dossiers" ON public.documents FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.dossiers WHERE dossiers.id = dossier_id AND dossiers.user_id = auth.uid()));
CREATE POLICY "Users can delete documents of own dossiers" ON public.documents FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.dossiers WHERE dossiers.id = dossier_id AND dossiers.user_id = auth.uid()));

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_dossiers_updated_at
  BEFORE UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, nom)
  VALUES (NEW.id, NEW.email, '', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-generate dossier reference
CREATE OR REPLACE FUNCTION public.generate_dossier_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 10) AS INT)), 0) + 1
  INTO next_num
  FROM public.dossiers
  WHERE reference LIKE 'INS-' || EXTRACT(YEAR FROM now())::TEXT || '-%';
  
  NEW.reference := 'INS-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_dossier_reference
  BEFORE INSERT ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.generate_dossier_reference();

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('dossier-documents', 'dossier-documents', false);

CREATE POLICY "Users can upload documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dossier-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'dossier-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE
  USING (bucket_id = 'dossier-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
