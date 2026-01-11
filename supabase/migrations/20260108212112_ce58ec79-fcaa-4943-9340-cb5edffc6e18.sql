-- Fix security warnings

-- Fix function search_path for update_fee_updated_at
CREATE OR REPLACE FUNCTION public.update_fee_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix function search_path for log_fee_changes
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop overly permissive policy and replace with proper one
DROP POLICY IF EXISTS "Insert fee logs" ON public.fee_change_logs;

CREATE POLICY "Insert fee logs"
ON public.fee_change_logs
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_platform_admin(auth.uid()) OR 
    tenant_id = auth.uid() OR
    changed_by = auth.uid()
);

-- Fix tenant_settings policy
DROP POLICY IF EXISTS "Manage own tenant settings" ON public.tenant_settings;

CREATE POLICY "Tenant can manage own settings"
ON public.tenant_settings
FOR ALL
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());