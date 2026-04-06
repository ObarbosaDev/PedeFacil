DROP POLICY IF EXISTS "Drivers can create own profile" ON public.delivery_drivers;
CREATE POLICY "Drivers can create own profile"
  ON public.delivery_drivers FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Drivers can claim profile by email" ON public.delivery_drivers;
CREATE POLICY "Drivers can claim profile by email"
  ON public.delivery_drivers FOR UPDATE
  USING (
    user_id IS NULL
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    user_id = auth.uid()
  );
