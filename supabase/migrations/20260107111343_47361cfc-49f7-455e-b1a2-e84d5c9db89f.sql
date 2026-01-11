-- Allow anyone to insert abandoned carts (checkout visitors are not authenticated)
CREATE POLICY "Anyone can create abandoned carts" 
ON public.abandoned_carts 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to update abandoned carts by ID (for updating customer data)
CREATE POLICY "Anyone can update abandoned carts by id" 
ON public.abandoned_carts 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Allow anyone to delete abandoned carts by ID (for removing when purchase completes)
CREATE POLICY "Anyone can delete abandoned carts by id" 
ON public.abandoned_carts 
FOR DELETE 
USING (true);