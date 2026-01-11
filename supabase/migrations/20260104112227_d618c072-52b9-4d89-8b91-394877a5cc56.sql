-- Create students table for product buyers/students
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  document TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_students_product_id ON public.students(product_id);
CREATE INDEX idx_students_seller_user_id ON public.students(seller_user_id);
CREATE INDEX idx_students_email ON public.students(email);

-- RLS Policies
CREATE POLICY "Sellers can view their own students"
ON public.students
FOR SELECT
USING (auth.uid() = seller_user_id);

CREATE POLICY "Sellers can insert students"
ON public.students
FOR INSERT
WITH CHECK (auth.uid() = seller_user_id);

CREATE POLICY "Sellers can update their own students"
ON public.students
FOR UPDATE
USING (auth.uid() = seller_user_id);

CREATE POLICY "Sellers can delete their own students"
ON public.students
FOR DELETE
USING (auth.uid() = seller_user_id);

CREATE POLICY "Admins can view all students"
ON public.students
FOR SELECT
USING (is_admin_or_moderator(auth.uid()));

CREATE POLICY "Admins can manage all students"
ON public.students
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();