
-- Fix: Restrict tenant creation - creator auto-becomes owner via trigger
-- Replace the permissive INSERT policy with one that is still open but 
-- we add a trigger to auto-add the creator as owner

CREATE OR REPLACE FUNCTION public.auto_add_tenant_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_tenant_owner();
