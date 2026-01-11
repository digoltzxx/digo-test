-- Function to automatically enable order_bump_enabled when order bump is created/activated
CREATE OR REPLACE FUNCTION public.sync_order_bump_enabled()
RETURNS TRIGGER AS $$
BEGIN
  -- When an order bump is created or updated to active
  IF NEW.is_active = true THEN
    UPDATE checkout_settings 
    SET order_bump_enabled = true, updated_at = NOW()
    WHERE product_id = NEW.product_id 
    AND (order_bump_enabled = false OR order_bump_enabled IS NULL);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for order_bumps
DROP TRIGGER IF EXISTS sync_order_bump_on_create ON public.order_bumps;
CREATE TRIGGER sync_order_bump_on_create
AFTER INSERT OR UPDATE OF is_active ON public.order_bumps
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_bump_enabled();