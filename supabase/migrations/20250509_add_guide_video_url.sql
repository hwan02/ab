-- Add video_url column for YouTube/external video links
ALTER TABLE property_guides
  ADD COLUMN IF NOT EXISTS video_url TEXT;
