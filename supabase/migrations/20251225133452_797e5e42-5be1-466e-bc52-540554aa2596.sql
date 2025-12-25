-- Bootstrap user roles safely without touching reserved schemas.
-- Creates/returns a role for the currently authenticated user.

CREATE OR REPLACE FUNCTION public.bootstrap_user_role()
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_existing_role public.app_role;
  v_is_empty boolean;
BEGIN
  -- Ensure we have an authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Bypass RLS for this bootstrap function
  PERFORM set_config('row_security', 'off', true);

  -- Return existing role if present
  SELECT role INTO v_existing_role
  FROM public.user_roles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_existing_role IS NOT NULL THEN
    RETURN v_existing_role;
  END IF;

  -- If no roles exist yet, make this user the first admin; otherwise default to kasir
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO v_is_empty;

  IF v_is_empty THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin');
    RETURN 'admin';
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'kasir');
    RETURN 'kasir';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_user_role() TO authenticated;
