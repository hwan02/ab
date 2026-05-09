-- Allow video uploads and increase file size limit in property-photos bucket
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ],
  file_size_limit = 209715200  -- 200MB
WHERE id = 'property-photos';
