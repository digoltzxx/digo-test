-- Add new columns to checkout_settings for full functionality

ALTER TABLE public.checkout_settings
ADD COLUMN IF NOT EXISTS layout_type text DEFAULT 'moderno',
ADD COLUMN IF NOT EXISTS form_layout text DEFAULT 'direct',
ADD COLUMN IF NOT EXISTS invert_columns boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS require_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_min_shipping_price boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_item_removal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_store_info boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS column_scroll_type text DEFAULT 'independent',
ADD COLUMN IF NOT EXISTS cart_display_type text DEFAULT 'mobile',
ADD COLUMN IF NOT EXISTS button_status text DEFAULT 'COMPRAR',
ADD COLUMN IF NOT EXISTS document_type_accepted text DEFAULT 'cpf',
ADD COLUMN IF NOT EXISTS order_bump_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS coupon_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS marquee_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS marquee_text text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sales_counter_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sales_counter_value integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'dark',
ADD COLUMN IF NOT EXISTS border_style text DEFAULT 'rounded',
ADD COLUMN IF NOT EXISTS favicon_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS show_logo boolean DEFAULT true;