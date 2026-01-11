-- Tabela para configurar entregáveis do produto
CREATE TABLE public.product_deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('member_access', 'email', 'external_link', 'file')),
  name TEXT NOT NULL,
  description TEXT,
  -- Para member_access: URL da área de membros
  -- Para email: template do email
  -- Para external_link: URL do conteúdo
  -- Para file: URL do arquivo
  content_url TEXT,
  email_subject TEXT,
  email_body TEXT,
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para registrar entregas realizadas (auditoria)
CREATE TABLE public.delivery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES public.product_deliverables(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  delivery_type TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para acesso à área de membros (vincula usuário ao produto)
CREATE TABLE public.member_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_name TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  access_status TEXT NOT NULL DEFAULT 'active' CHECK (access_status IN ('active', 'suspended', 'expired', 'cancelled')),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_email, product_id)
);

-- Enable RLS
ALTER TABLE public.product_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_access ENABLE ROW LEVEL SECURITY;

-- Policies para product_deliverables
CREATE POLICY "Product owners can manage deliverables" 
ON public.product_deliverables 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_deliverables.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Policies para delivery_logs
CREATE POLICY "Product owners can view delivery logs" 
ON public.delivery_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = delivery_logs.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Policies para member_access
CREATE POLICY "Product owners can view member access" 
ON public.member_access 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = member_access.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own access" 
ON public.member_access 
FOR SELECT 
USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Indexes
CREATE INDEX idx_product_deliverables_product ON public.product_deliverables(product_id);
CREATE INDEX idx_delivery_logs_sale ON public.delivery_logs(sale_id);
CREATE INDEX idx_delivery_logs_product ON public.delivery_logs(product_id);
CREATE INDEX idx_member_access_email ON public.member_access(user_email);
CREATE INDEX idx_member_access_product ON public.member_access(product_id);
CREATE INDEX idx_member_access_status ON public.member_access(access_status);

-- Trigger para updated_at
CREATE TRIGGER update_product_deliverables_updated_at
BEFORE UPDATE ON public.product_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_access_updated_at
BEFORE UPDATE ON public.member_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();