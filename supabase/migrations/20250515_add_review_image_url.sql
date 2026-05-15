-- Add image_url column to reviews table
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS image_url TEXT;
