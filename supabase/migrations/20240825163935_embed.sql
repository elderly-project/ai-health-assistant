-- create function private.embed()
-- returns trigger
-- language plpgsql
-- as $$
-- declare
--   content_column text = TG_ARGV[0];
--   embedding_column text = TG_ARGV[1];
--   batch_size int = case when array_length(TG_ARGV, 1) >= 3 then TG_ARGV[2]::int else 5 end;
--   timeout_milliseconds int = case when array_length(TG_ARGV, 1) >= 4 then TG_ARGV[3]::int else 5 * 60 * 1000 end;
--   batch_count int = ceiling((select count(*) from inserted) / batch_size::float);
-- begin
--   -- Loop through each batch and invoke an edge function to handle the embedding generation
--   for i in 0 .. (batch_count-1) loop
--   perform
--     net.http_post(
--       url := supabase_url() || '/functions/v1/embed',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', current_setting('request.headers')::json->>'authorization'
--       ),
--       body := jsonb_build_object(
--         'ids', (select json_agg(ds.id) from (select id from inserted limit batch_size offset i*batch_size) ds),
--         'table', TG_TABLE_NAME,
--         'contentColumn', content_column,
--         'embeddingColumn', embedding_column
--       ),
--       timeout_milliseconds := timeout_milliseconds
--     );
--   end loop;

--   return null;
-- end;
-- $$;

-- -- Create the process_file function if it doesn't exist
-- create or replace function private.process_file()
-- returns trigger
-- language plpgsql
-- as $$
-- begin
--   perform
--     net.http_post(
--       url := supabase_url() || '/functions/v1/process',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', current_setting('request.headers')::json->>'authorization'
--       ),
--       body := jsonb_build_object(
--         'document_id', NEW.id
--       )
--     );
--   return NEW;
-- end;
-- $$;

-- -- Ensure the trigger for processing uploaded files exists
-- drop trigger if exists process_uploaded_file on files;
-- create trigger process_uploaded_file
--   after insert on files
--   for each row
--   execute function private.process_file();

-- -- Ensure the trigger for embedding document sections exists
-- drop trigger if exists embed_document_sections on document_sections;
-- create trigger embed_document_sections
--   after insert on document_sections
--   referencing new table as inserted
--   for each statement
--   execute function private.embed('content', 'embedding');

create function private.embed()
returns trigger
language plpgsql
as $$
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

create trigger embed_document_sections
  after insert on document_sections
  referencing new table as inserted
  for each statement
  execute procedure private.embed(content, embedding, 10);