-- Add unique constraint on key column for upsert to work
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_key_unique UNIQUE (key);