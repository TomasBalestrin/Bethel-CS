-- Ensure chat-attachments bucket accepts all file types (including PDFs)
-- and has adequate file size limit (50MB)
UPDATE storage.buckets
SET
  allowed_mime_types = NULL,  -- NULL = no restriction
  file_size_limit = 52428800   -- 50MB
WHERE id = 'chat-attachments';
