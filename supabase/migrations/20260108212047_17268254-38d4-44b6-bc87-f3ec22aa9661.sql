-- =============================================
-- SISTEMA DE TAXAS MULTI-TENANT PARA SAAS
-- =============================================

-- Enum para tipos de taxa
CREATE TYPE public.fee_type AS ENUM ('transaction', 'withdrawal', 'anticipation');

-- Enum para tipo de valor da taxa
CREATE TYPE public.fee_value_type AS ENUM ('fixed', 'percentage');

-- Tabela principal de taxas (global e por tenant)
CREATE TABLE public.platform_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = taxa global
    fee_type public.fee_type NOT NULL,
    value DECIMAL(10, 4) NOT NULL CHECK (value >= 0),
    value_type public.fee_value_type NOT NULL DEFAULT 'percentage',
    min_value DECIMAL(10, 2) DEFAULT 0, -- valor mínimo para taxas percentuais
    max_value DECIMAL(10, 2) DEFAULT NULL, -- valor máximo (cap)
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    currency VARCHAR(3) DEFAULT 'BRL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    -- Garantir unicidade: cada tenant só pode ter uma taxa de cada tipo
    CONSTRAINT unique_tenant_fee_type UNIQUE (tenant_id, fee_type)
);

-- Tabela de histórico/versionamento de taxas (audit log)
CREATE TABLE public.fee_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_id UUID REFERENCES public.platform_fees(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    fee_type public.fee_type NOT NULL,
    previous_value DECIMAL(10, 4),
    new_value DECIMAL(10, 4) NOT NULL,
    previous_value_type public.fee_value_type,
    new_value_type public.fee_value_type NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'activate', 'deactivate')),
    changed_by UUID REFERENCES auth.users(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de configurações por tenant
CREATE TABLE public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    use_custom_fees BOOLEAN DEFAULT false, -- se false, usa taxas globais
    company_name TEXT,
    cnpj VARCHAR(18),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_platform_fees_tenant ON public.platform_fees(tenant_id);
CREATE INDEX idx_platform_fees_type ON public.platform_fees(fee_type);
CREATE INDEX idx_platform_fees_active ON public.platform_fees(is_active) WHERE is_active = true;
CREATE INDEX idx_fee_change_logs_fee_id ON public.fee_change_logs(fee_id);
CREATE INDEX idx_fee_change_logs_tenant ON public.fee_change_logs(tenant_id);
CREATE INDEX idx_fee_change_logs_created ON public.fee_change_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário é admin global
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = 'admin'
    )
$$;

-- RLS Policies para platform_fees

-- Admins globais podem ver todas as taxas
CREATE POLICY "Admins can view all fees"
ON public.platform_fees
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()) OR tenant_id = auth.uid() OR tenant_id IS NULL);

-- Admins globais podem criar taxas globais, tenants podem criar suas próprias
CREATE POLICY "Create fees policy"
ON public.platform_fees
FOR INSERT
TO authenticated
WITH CHECK (
    (tenant_id IS NULL AND public.is_platform_admin(auth.uid())) OR
    (tenant_id = auth.uid())
);

-- Admins globais podem atualizar taxas globais, tenants suas próprias
CREATE POLICY "Update fees policy"
ON public.platform_fees
FOR UPDATE
TO authenticated
USING (
    (tenant_id IS NULL AND public.is_platform_admin(auth.uid())) OR
    (tenant_id = auth.uid())
);

-- Apenas admins globais podem deletar
CREATE POLICY "Delete fees policy"
ON public.platform_fees
FOR DELETE
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- RLS para fee_change_logs
CREATE POLICY "View fee logs"
ON public.fee_change_logs
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()) OR tenant_id = auth.uid());

CREATE POLICY "Insert fee logs"
ON public.fee_change_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS para tenant_settings
CREATE POLICY "View tenant settings"
ON public.tenant_settings
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()) OR tenant_id = auth.uid());

CREATE POLICY "Manage own tenant settings"
ON public.tenant_settings
FOR ALL
TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "Admin manage tenant settings"
ON public.tenant_settings
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_fee_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_platform_fees_timestamp
BEFORE UPDATE ON public.platform_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_fee_updated_at();

CREATE TRIGGER trigger_update_tenant_settings_timestamp
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_fee_updated_at();

-- Trigger para criar log automático de alterações
CREATE OR REPLACE FUNCTION public.log_fee_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.fee_change_logs (
            fee_id, tenant_id, fee_type, new_value, new_value_type, action, changed_by
        ) VALUES (
            NEW.id, NEW.tenant_id, NEW.fee_type, NEW.value, NEW.value_type, 'create', auth.uid()
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.fee_change_logs (
            fee_id, tenant_id, fee_type, previous_value, new_value, previous_value_type, new_value_type, action, changed_by
        ) VALUES (
            NEW.id, NEW.tenant_id, NEW.fee_type, OLD.value, NEW.value, OLD.value_type, NEW.value_type,
            CASE WHEN OLD.is_active != NEW.is_active THEN 
                CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END
            ELSE 'update' END,
            auth.uid()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.fee_change_logs (
            fee_id, tenant_id, fee_type, previous_value, new_value, previous_value_type, new_value_type, action, changed_by
        ) VALUES (
            OLD.id, OLD.tenant_id, OLD.fee_type, OLD.value, OLD.value, OLD.value_type, OLD.value_type, 'delete', auth.uid()
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_fee_changes
AFTER INSERT OR UPDATE OR DELETE ON public.platform_fees
FOR EACH ROW
EXECUTE FUNCTION public.log_fee_changes();

-- Inserir taxas globais padrão
INSERT INTO public.platform_fees (tenant_id, fee_type, value, value_type, description) VALUES
(NULL, 'transaction', 4.99, 'percentage', 'Taxa de transação padrão da plataforma'),
(NULL, 'withdrawal', 2.00, 'fixed', 'Taxa fixa por saque'),
(NULL, 'anticipation', 3.49, 'percentage', 'Taxa de antecipação de recebíveis');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_fees;