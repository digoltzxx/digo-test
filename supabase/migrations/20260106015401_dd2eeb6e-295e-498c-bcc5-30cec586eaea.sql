-- Create table for banner carousel slides
CREATE TABLE public.banner_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title_1 TEXT,
  title_2 TEXT,
  date_text TEXT,
  gradient_from TEXT DEFAULT '#0c1929',
  gradient_via TEXT DEFAULT '#152238',
  gradient_to TEXT DEFAULT '#0c1929',
  accent_color TEXT DEFAULT '#3b82f6',
  highlight_color TEXT DEFAULT '#facc15',
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banner_slides ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (banners are public)
CREATE POLICY "Banner slides are viewable by everyone" 
ON public.banner_slides 
FOR SELECT 
USING (true);

-- Create policy for admin write access
CREATE POLICY "Admins can manage banner slides" 
ON public.banner_slides 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_banner_slides_updated_at
BEFORE UPDATE ON public.banner_slides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();