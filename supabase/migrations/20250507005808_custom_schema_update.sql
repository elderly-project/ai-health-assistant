-- This migration applies the essential components from the remote schema while
-- avoiding conflicts with existing database objects

-- Ensure all schemas exist
CREATE SCHEMA IF NOT EXISTS "storage";
CREATE SCHEMA IF NOT EXISTS "private";

-- First add the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('files', 'files')
ON CONFLICT DO NOTHING;

-- Create or replace the key functions
CREATE OR REPLACE FUNCTION "private"."handle_storage_update"()
RETURNS "trigger"
LANGUAGE "plpgsql"
AS $$
declare
  document_id bigint;
  file_extension text;
  result_text text;
  service_token text;
  result int;
begin
  -- Check if the path_tokens array has enough elements
  IF new.path_tokens IS NULL OR array_length(new.path_tokens, 1) < 2 THEN
    -- Skip processing if the path structure isn't what we expect
    RAISE LOG 'Invalid path structure for uploaded file: %', new.name;
    RETURN new;
  END IF;

  -- Only process files in the 'files' bucket
  IF new.bucket_id <> 'files' THEN
    RAISE LOG 'Ignoring file in bucket %: %', new.bucket_id, new.name;
    RETURN new;
  END IF;

  -- Get file extension
  file_extension := lower(split_part(new.name, '.', array_length(split_part(new.name, '.', 1), 1) + 1));
  
  -- Check if file type is supported
  IF file_extension NOT IN ('md', 'pdf', 'pptx', 'ppt', 'docx', 'doc', 'txt') THEN
    RAISE LOG 'Unsupported file type: %', file_extension;
  END IF;
  
  RAISE LOG 'Processing file: % with file extension: %', new.name, file_extension;

  BEGIN
    -- Add the document record with error handling
    INSERT INTO documents (name, storage_object_id, created_by)
    VALUES (COALESCE(new.path_tokens[2], new.name), new.id, new.owner)
    RETURNING id INTO document_id;
    
    RAISE LOG 'Created document with ID: %', document_id;

    -- Try to get service role token for better authorization
    BEGIN
      SELECT decrypted_secret INTO service_token 
      FROM vault.decrypted_secrets 
      WHERE name = 'service_role_key';
      
      IF service_token IS NULL THEN
        service_token := current_setting('request.headers')::json->>'authorization';
      ELSE
        service_token := 'Bearer ' || service_token;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      service_token := current_setting('request.headers')::json->>'authorization';
    END;

    -- Only call the edge function if document insertion succeeded
    IF document_id IS NOT NULL THEN
      BEGIN
        RAISE LOG 'Calling process function for document_id: %', document_id;
        
        SELECT
          content INTO result_text
        FROM
          net.http_post(
            url := supabase_url() || '/functions/v1/process',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', service_token
            ),
            body := jsonb_build_object(
              'document_id', document_id
            ),
            timeout_milliseconds := 120000 -- 120 second timeout
          );
          
        RAISE LOG 'Process function response: %', result_text;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't block the file upload
        RAISE LOG 'Error calling process function: %', SQLERRM;
        
        -- Fallback: Create a simple text section directly in the database
        BEGIN
          RAISE LOG 'Using fallback to create document section directly for document_id: %', document_id;
          INSERT INTO document_sections (document_id, content)
          VALUES (document_id, 'File uploaded: ' || new.name || 
                  ' - This is a placeholder section created when automatic processing failed. ' ||
                  'Please check the Edge Function logs for more details.');
        EXCEPTION WHEN OTHERS THEN
          RAISE LOG 'Error creating fallback document section: %', SQLERRM;
        END;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block the file upload
    RAISE LOG 'Error in handle_storage_update: %', SQLERRM;
  END;

  -- Always return the new row to allow the upload
  RETURN new;
end;
$$;

-- Ensure the function has proper permissions
ALTER FUNCTION private.handle_storage_update() OWNER TO postgres;

-- Make sure the trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_file_upload'
  ) THEN
    CREATE TRIGGER on_file_upload
    AFTER INSERT ON storage.objects
    FOR EACH ROW
    EXECUTE FUNCTION private.handle_storage_update();
  END IF;
END
$$;

-- Storage policies
DO $$
BEGIN
  -- Drop policies if they exist to avoid conflicts
  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if policies don't exist
  END;

  -- Create the policies
  CREATE POLICY "Authenticated users can upload files"
  ON storage.objects
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (bucket_id = 'files'::text) AND 
    (owner = auth.uid()) AND 
    (private.uuid_or_null(path_tokens[1]) IS NOT NULL)
  );

  CREATE POLICY "Users can view their own files"
  ON storage.objects
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (bucket_id = 'files'::text) AND 
    (owner = auth.uid())
  );

  CREATE POLICY "Users can update their own files"
  ON storage.objects
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  WITH CHECK (
    (bucket_id = 'files'::text) AND 
    (owner = auth.uid())
  );

  CREATE POLICY "Users can delete their own files"
  ON storage.objects
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    (bucket_id = 'files'::text) AND 
    (owner = auth.uid())
  );
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA storage TO postgres, anon, authenticated, service_role;


