create extension if not exists pg_net with schema extensions;
create extension if not exists vector with schema extensions;

create table documents (
  id bigint primary key generated always as identity,
  name text not null,
  storage_object_id uuid not null references storage.objects (id),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamp with time zone not null default now()
);

create view documents_with_storage_path
with (security_invoker=true) -- this lines means that this view would inherit the security permissions of whoever invokes this view
as
  select documents.*, storage.objects.name as storage_object_path
  from documents
  join storage.objects
    on storage.objects.id = documents.storage_object_id;

create table document_sections (
  id bigint primary key generated always as identity,
  document_id bigint not null references documents (id),
  content text not null,
  embedding vector (384)
);

alter table document_sections
drop constraint document_sections_document_id_fkey,
add constraint document_sections_document_id_fkey
  foreign key (document_id)
  references documents(id)
  on delete cascade;

create index on document_sections using hnsw (embedding vector_ip_ops);

alter table documents enable row level security;
alter table document_sections enable row level security;

create policy "Users can insert documents"
on documents for insert to authenticated with check (
  auth.uid() = created_by
);

create policy "Users can query their own documents"
on documents for select to authenticated using (
  auth.uid() = created_by
);

create policy "Users can insert document sections"
on document_sections for insert to authenticated with check (
  document_id in (
    select id
    from documents
    where created_by = auth.uid()
  )
);

create policy "Users can update their own document sections"
on document_sections for update to authenticated using (
  document_id in (
    select id
    from documents
    where created_by = auth.uid()
  )
) with check (
  document_id in (
    select id
    from documents
    where created_by = auth.uid()
  )
);

create policy "Users can query their own document sections"
on document_sections for select to authenticated using (
  document_id in (
    select id
    from documents
    where created_by = auth.uid()
  )
);

-- MOVED TO fix_storage_schema.sql
-- The handle_storage_update function and on_file_upload trigger are now defined in fix_storage_schema.sql
-- to ensure proper functionality when pushing to cloud.

-- Function to get the Supabase URL from the vault
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'supabase_url'
  ) THEN
    CREATE FUNCTION supabase_url()
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      secret_value text;
    BEGIN
      SELECT decrypted_secret INTO secret_value FROM vault.decrypted_secrets WHERE name = 'supabase_url';
      RETURN secret_value;
    END;
    $$;
  END IF;
END
$$;