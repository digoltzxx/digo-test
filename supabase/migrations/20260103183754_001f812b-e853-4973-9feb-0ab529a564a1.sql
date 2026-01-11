-- Policies para gerentes de conta acessarem dados baseado nas permissões

-- Gerentes podem ver profiles se tiverem permissão
CREATE POLICY "Account managers can view profiles with permission"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.account_manager_permissions
    WHERE user_id = auth.uid()
      AND is_active = true
      AND can_view_accounts = true
  )
);

-- Gerentes podem ver vendas se tiverem permissão
CREATE POLICY "Account managers can view sales with permission"
ON public.sales
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.account_manager_permissions
    WHERE user_id = auth.uid()
      AND is_active = true
      AND can_view_sales = true
  )
);

-- Gerentes podem ver saques se tiverem permissão  
CREATE POLICY "Account managers can view withdrawals with permission"
ON public.withdrawals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.account_manager_permissions
    WHERE user_id = auth.uid()
      AND is_active = true
      AND can_view_withdrawals = true
  )
);

-- Gerentes podem ver afiliações se tiverem permissão
CREATE POLICY "Account managers can view affiliations with permission"
ON public.affiliations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.account_manager_permissions
    WHERE user_id = auth.uid()
      AND is_active = true
      AND can_manage_affiliates = true
  )
);

-- Gerentes podem atualizar afiliações se tiverem permissão
CREATE POLICY "Account managers can update affiliations with permission"
ON public.affiliations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.account_manager_permissions
    WHERE user_id = auth.uid()
      AND is_active = true
      AND can_manage_affiliates = true
  )
);

-- Gerentes podem ver bank_accounts se tiverem permissão de ver saques
CREATE POLICY "Account managers can view bank_accounts with permission"
ON public.bank_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.account_manager_permissions
    WHERE user_id = auth.uid()
      AND is_active = true
      AND can_view_withdrawals = true
  )
);

-- Policy para produtores atualizarem afiliações dos seus produtos
CREATE POLICY "Product owners can update their product affiliations"
ON public.affiliations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = affiliations.product_id
      AND products.user_id = auth.uid()
  )
);