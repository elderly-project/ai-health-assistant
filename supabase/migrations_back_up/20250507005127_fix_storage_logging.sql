-- Make the storage upload trigger more robust with enhanced logging

-- Create enhanced version of the handle_storage_update function with better error handling
CREATE OR REPLACE FUNCTION private.handle_storage_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
  document_id bigint;
  file_extension text;
  result_text text;
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
              'Authorization', current_setting('request.headers')::json->>'authorization'
            ),
            body := jsonb_build_object(
              'document_id', document_id
            ),
            timeout_milliseconds := 120000 -- 120 second timeout (increased from 30s)
          );
          
        RAISE LOG 'Process function response: %', result_text;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't block the file upload
        RAISE LOG 'Error calling process function: %', SQLERRM;
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

-- Add a comment to explain the function's purpose
COMMENT ON FUNCTION private.handle_storage_update() IS 'Processes files uploaded to the storage bucket and creates document records';

-- Grant necessary permissions to ensure the function can be executed
ALTER FUNCTION private.handle_storage_update() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION private.handle_storage_update() TO postgres, anon, authenticated, service_role;
