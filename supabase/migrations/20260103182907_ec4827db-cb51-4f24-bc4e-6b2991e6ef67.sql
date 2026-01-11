-- Criar tabela de permissões de gerentes de conta
CREATE TABLE public.account_manager_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view_accounts BOOLEAN NOT NULL DEFAULT false,
  can_view_sales BOOLEAN NOT NULL DEFAULT false,
  can_view_withdrawals BOOLEAN NOT NULL DEFAULT false,
  can_support BOOLEAN NOT NULL DEFAULT false,
  can_manage_affiliates BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.account_manager_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all permissions
CREATE POLICY "Admins can manage all permissions"
ON public.account_manager_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Account managers can view their own permissions
CREATE POLICY "Account managers can view their own permissions"
ON public.account_manager_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_account_manager_permissions_updated_at
  BEFORE UPDATE ON public.account_manager_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar permissão específica de um gerente
CREATE OR REPLACE FUNCTION public.manager_has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _permission
    WHEN 'view_accounts' THEN can_view_accounts
    WHEN 'view_sales' THEN can_view_sales
    WHEN 'view_withdrawals' THEN can_view_withdrawals
    WHEN 'support' THEN can_support
    WHEN 'manage_affiliates' THEN can_manage_affiliates
    ELSE false
  END
  FROM public.account_manager_permissions
  WHERE user_id = _user_id AND is_active = true
$$;