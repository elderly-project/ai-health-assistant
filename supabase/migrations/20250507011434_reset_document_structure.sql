-- Reset and align document structure with the specified schema

-- First, drop any existing triggers that might conflict
DROP TRIGGER IF EXISTS on_file_upload ON storage.objects;
DROP TRIGGER IF EXISTS embed_document_sections ON document_sections;

-- Drop and recreate the handle_storage_update function
CREATE OR REPLACE FUNCTION private.handle_storage_update() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
declare
  document_id bigint;
  result int;
begin
  -- Only process files from the files bucket
  IF new.bucket_id <> 'files' THEN
    RETURN null;
  END IF;

  -- Check for path_tokens before using them
  IF new.path_tokens IS NULL OR 
     NOT pg_typeof(new.path_tokens) = 'text[]'::regtype OR
     cardinality(new.path_tokens) < 2 THEN
    -- If path_tokens is invalid, use name as fallback
    INSERT INTO documents (name, storage_object_id, created_by)
    VALUES (new.name, new.id, new.owner)
    RETURNING id INTO document_id;
  ELSE
    -- Use path_tokens[2] as specified in the schema
    INSERT INTO documents (name, storage_object_id, created_by)
    VALUES (new.path_tokens[2], new.id, new.owner)
    RETURNING id INTO document_id;
  END IF;

  -- Call the edge function to process the document
  -- This uses current_setting('request.headers') which should be available in trigger context
  BEGIN
    SELECT
      net.http_post(
        url := supabase_url() || '/functions/v1/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', current_setting('request.headers')::json->>'authorization'
        ),
        body := jsonb_build_object(
          'document_id', document_id
        )
      )
    INTO result;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but continue
    RAISE LOG 'Error calling process function: %', SQLERRM;
  END;

  -- Return null as specified in the schema
  RETURN null;
end;
$$;

-- Create the embed function
CREATE OR REPLACE FUNCTION private.embed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
  content_column text = TG_ARGV[0];
  embedding_column text = TG_ARGV[1];
  batch_size int = case when array_length(TG_ARGV, 1) >= 3 then TG_ARGV[2]::int else 5 end;
  timeout_milliseconds int = case when array_length(TG_ARGV, 1) >= 4 then TG_ARGV[3]::int else 40 * 60 * 1000 end;
  batch_count int = ceiling((select count(*) from inserted) / batch_size::float);
begin
  -- Loop through each batch and invoke an edge function to handle the embedding generation
  for i in 0 .. (batch_count-1) loop
  perform
    net.http_post(
      url := supabase_url() || '/functions/v1/embed',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', current_setting('request.headers')::json->>'authorization'
      ),
      body := jsonb_build_object(
        'ids', (select json_agg(ds.id) from (select id from inserted limit batch_size offset i*batch_size) ds),
        'table', TG_TABLE_NAME,
        'contentColumn', content_column,
        'embeddingColumn', embedding_column
      ),
      timeout_milliseconds := timeout_milliseconds
    );
  end loop;

  return null;
end;
$$;

-- Create the match function
CREATE OR REPLACE FUNCTION match_document_sections(
  embedding vector(384),
  match_threshold float
)
RETURNS setof document_sections
LANGUAGE plpgsql
AS $$
#variable_conflict use_variable
begin
  return query
  select *
  from document_sections
  where document_sections.embedding <#> embedding < -match_threshold
  order by document_sections.embedding <#> embedding;
end;
$$;

-- Re-create the triggers with the correct functions
CREATE TRIGGER on_file_upload
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE PROCEDURE private.handle_storage_update();

CREATE TRIGGER embed_document_sections
  AFTER INSERT ON document_sections
  REFERENCING NEW TABLE AS inserted
  FOR EACH STATEMENT
  EXECUTE PROCEDURE private.embed('content', 'embedding', 2);

-- Grant necessary permissions
ALTER FUNCTION private.handle_storage_update() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION private.handle_storage_update() TO postgres, anon, authenticated, service_role;

ALTER FUNCTION private.embed() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION private.embed() TO postgres, anon, authenticated, service_role;

ALTER FUNCTION match_document_sections(vector(384), float) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION match_document_sections(vector(384), float) TO postgres, anon, authenticated, service_role;

-- Fix any orphaned documents by re-triggering processing
DO $$
DECLARE
  doc_record RECORD;
BEGIN
  -- Find documents without sections
  FOR doc_record IN
    SELECT d.id
    FROM documents d
    LEFT JOIN document_sections ds ON d.id = ds.document_id
    WHERE ds.id IS NULL
  LOOP
    -- Attempt to reprocess by calling the edge function directly
    BEGIN
      PERFORM
        net.http_post(
          url := supabase_url() || '/functions/v1/process',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || nullif(current_setting('app.settings.service_role_key', true), '')::text
          ),
          body := jsonb_build_object(
            'document_id', doc_record.id
          )
        );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error reprocessing document %: %', doc_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;


