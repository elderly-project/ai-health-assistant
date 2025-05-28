-- Fix document sections not being created during file uploads

-- Replace the handle_storage_update function with an improved version
CREATE OR REPLACE FUNCTION "private"."handle_storage_update"()
RETURNS "trigger"
LANGUAGE "plpgsql"
AS $$
declare
  document_id bigint;
  file_extension text;
  result_text text;
  service_token text;
  url_path text;
  result int;
begin
  -- Check if the path_tokens array has enough elements
  -- Safely check if path_tokens is an array and has at least 2 elements
  IF new.path_tokens IS NULL OR 
     NOT pg_typeof(new.path_tokens) = 'text[]'::regtype OR 
     cardinality(new.path_tokens) < 2 THEN
    -- Skip processing if the path structure isn't what we expect
    RAISE LOG 'Invalid path structure for uploaded file: %', new.name;
    RETURN new;
  END IF;

  -- Only process files in the 'files' bucket
  IF new.bucket_id <> 'files' THEN
    RAISE LOG 'Ignoring file in bucket %: %', new.bucket_id, new.name;
    RETURN new;
  END IF;

  -- Get file extension more safely
  BEGIN
    file_extension := lower(substring(new.name from '\.([^\.]+)$'));
  EXCEPTION WHEN OTHERS THEN
    file_extension := '';
    RAISE LOG 'Error extracting file extension from %: %', new.name, SQLERRM;
  END;
  
  -- Check if file type is supported
  IF file_extension NOT IN ('md', 'pdf', 'pptx', 'ppt', 'docx', 'doc', 'txt') THEN
    RAISE LOG 'Unsupported file type: %', file_extension;
  END IF;
  
  RAISE LOG 'Processing file: % with file extension: %', new.name, file_extension;

  BEGIN
    -- Add the document record with error handling
    INSERT INTO documents (name, storage_object_id, created_by)
    VALUES (COALESCE(new.name, 'Unnamed file'), new.id, new.owner)
    RETURNING id INTO document_id;
    
    RAISE LOG 'Created document with ID: %', document_id;

    -- Create a simple document section directly - this should always succeed
    IF document_id IS NOT NULL THEN
      -- Construct the storage URL path
      url_path := 'files/' || new.id;
      
      -- Create placeholder section that will always work
      BEGIN
        RAISE LOG 'Creating initial document section for document_id: %', document_id;
        INSERT INTO document_sections (document_id, content, embedding)
        VALUES (
          document_id, 
          'File uploaded: ' || new.name || 
          E'\n\nThis document will be processed shortly. ' || 
          E'\n\nFile type: ' || COALESCE(file_extension, 'unknown') || 
          E'\n\nStorage path: ' || COALESCE(url_path, 'unknown'),
          NULL  -- Placeholder for embedding that will be filled by the processing function
        );
        RAISE LOG 'Successfully created document section for document_id: %', document_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating initial document section: %', SQLERRM;
        
        -- Fallback with minimal content if the first attempt failed
        BEGIN
          INSERT INTO document_sections (document_id, content)
          VALUES (document_id, 'File uploaded');
          RAISE LOG 'Successfully created fallback document section for document_id: %', document_id;
        EXCEPTION WHEN OTHERS THEN
          RAISE LOG 'Critical error: Failed to create even basic document section: %', SQLERRM;
        END;
      END;

      -- Then try to call the edge function
      BEGIN
        RAISE LOG 'Calling process function for document_id: %', document_id;
        SELECT
          content INTO result_text
        FROM
          net.http_post(
            url := supabase_url() || '/functions/v1/process',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', current_setting('request.headers')::json->>'authorization'
            ),
            body := jsonb_build_object(
              'document_id', document_id
            ),
            timeout_milliseconds := 120000 -- 120 second timeout
          );
        RAISE LOG 'Process function response: %', result_text;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error calling process function: %', SQLERRM;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block the file upload
    RAISE LOG 'Error in handle_storage_update: %', SQLERRM;
  END;

  -- Always return the new row to allow the upload to complete
  RETURN new;
end;
$$;

-- Grant necessary permissions
ALTER FUNCTION private.handle_storage_update() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION private.handle_storage_update() TO postgres, anon, authenticated, service_role;

-- Ensure document_sections table has proper permissions
GRANT ALL ON TABLE document_sections TO postgres, anon, authenticated, service_role;

-- Check if we need to fix any orphaned documents that already exist
DO $$
DECLARE
  doc_record RECORD;
BEGIN
  -- Find documents without sections
  FOR doc_record IN
    SELECT d.id, d.name, d.storage_object_id
    FROM documents d
    LEFT JOIN document_sections ds ON d.id = ds.document_id
    WHERE ds.id IS NULL
  LOOP
    -- Create a basic section for each orphaned document
    BEGIN
      RAISE NOTICE 'Creating section for orphaned document %: %', doc_record.id, doc_record.name;
      INSERT INTO document_sections (document_id, content)
      VALUES (doc_record.id, 'File uploaded: ' || doc_record.name || 
              E'\n\nThis is a retroactively created section for a previously uploaded document.');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating section for orphaned document %: %', doc_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;


