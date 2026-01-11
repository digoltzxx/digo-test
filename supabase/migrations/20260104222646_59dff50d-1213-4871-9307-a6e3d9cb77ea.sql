-- Create order_bumps table for Order Bump feature
CREATE TABLE public.order_bumps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bump_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  discount_price NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_bumps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order bumps for their products"
ON order_bumps FOR SELECT
USING (EXISTS (SELECT 1 FROM products WHERE products.id = order_bumps.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can create order bumps for their products"
ON order_bumps FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = order_bumps.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can update order bumps for their products"
ON order_bumps FOR UPDATE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = order_bumps.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can delete order bumps for their products"
ON order_bumps FOR DELETE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = order_bumps.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Public can view active order bumps for checkout"
ON order_bumps FOR SELECT
USING (is_active = true AND EXISTS (SELECT 1 FROM products WHERE products.id = order_bumps.product_id AND products.status = 'active'));

-- Create product_links table for custom links
CREATE TABLE public.product_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  custom_price NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, slug)
);

ALTER TABLE public.product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view links for their products"
ON product_links FOR SELECT
USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_links.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can create links for their products"
ON product_links FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = product_links.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can update links for their products"
ON product_links FOR UPDATE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_links.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can delete links for their products"
ON product_links FOR DELETE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_links.product_id AND products.user_id = auth.uid()));

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  coupon_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaigns for their products"
ON campaigns FOR SELECT
USING (EXISTS (SELECT 1 FROM products WHERE products.id = campaigns.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can create campaigns for their products"
ON campaigns FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = campaigns.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can update campaigns for their products"
ON campaigns FOR UPDATE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = campaigns.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can delete campaigns for their products"
ON campaigns FOR DELETE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = campaigns.product_id AND products.user_id = auth.uid()));

-- Create product_reviews table for reviews
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews for their products"
ON product_reviews FOR SELECT
USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_reviews.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can create reviews for their products"
ON product_reviews FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = product_reviews.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can update reviews for their products"
ON product_reviews FOR UPDATE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_reviews.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can delete reviews for their products"
ON product_reviews FOR DELETE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_reviews.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Public can view approved reviews"
ON product_reviews FOR SELECT
USING (status = 'approved');

-- Create social_proofs table
CREATE TABLE public.social_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'testimonial',
  author_name TEXT NOT NULL,
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  video_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.social_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view social proofs for their products"
ON social_proofs FOR SELECT
USING (EXISTS (SELECT 1 FROM products WHERE products.id = social_proofs.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can create social proofs for their products"
ON social_proofs FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = social_proofs.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can update social proofs for their products"
ON social_proofs FOR UPDATE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = social_proofs.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can delete social proofs for their products"
ON social_proofs FOR DELETE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = social_proofs.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Public can view active social proofs"
ON social_proofs FOR SELECT
USING (is_active = true AND EXISTS (SELECT 1 FROM products WHERE products.id = social_proofs.product_id AND products.status = 'active'));

-- Create product_settings table for product-specific settings
CREATE TABLE public.product_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  enable_affiliates BOOLEAN NOT NULL DEFAULT true,
  affiliate_commission NUMERIC NOT NULL DEFAULT 30,
  enable_pixel_facebook TEXT,
  enable_pixel_google TEXT,
  enable_pixel_tiktok TEXT,
  custom_thank_you_message TEXT,
  enable_email_notifications BOOLEAN NOT NULL DEFAULT true,
  enable_whatsapp_notifications BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view settings for their products"
ON product_settings FOR SELECT
USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_settings.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can create settings for their products"
ON product_settings FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = product_settings.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can update settings for their products"
ON product_settings FOR UPDATE
USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_settings.product_id AND products.user_id = auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_order_bumps_updated_at BEFORE UPDATE ON order_bumps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_links_updated_at BEFORE UPDATE ON product_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_social_proofs_updated_at BEFORE UPDATE ON social_proofs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_settings_updated_at BEFORE UPDATE ON product_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();