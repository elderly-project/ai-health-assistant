SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";


CREATE EXTENSION IF NOT EXISTS "pgsodium";


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';

-- Add the 'files' bucket to storage
INSERT INTO storage.buckets (id, name)
VALUES ('files', 'files')
ON CONFLICT DO NOTHING;


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE TYPE "public"."email_type" AS ENUM (
    'welcome_email',
    'low_credits_warning',
    'first_folder_created',
    'first_study_materials_generated'
);


ALTER TYPE "public"."email_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."embed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "private"."embed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."handle_storage_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  document_id bigint;
  result int;
begin
  insert into documents (name, storage_object_id, created_by)
    values (new.path_tokens[2], new.id, new.owner)
    returning id into document_id;

  select
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
  into result;

  return null;
end;
$$;


ALTER FUNCTION "private"."handle_storage_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."uuid_or_null"("str" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
begin
  return str::uuid;
  exception when invalid_text_representation then
    return null;
  end;
$$;


ALTER FUNCTION "private"."uuid_or_null"("str" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_email_type"("user_id_input" "uuid", "email_type_input" "public"."email_type") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE user_credits
    SET 
        emails_sent = array_append(emails_sent, email_type_input),
        updated_at = NOW()  -- Update the updated_at timestamp
    WHERE 
        user_id = user_id_input
        AND NOT (email_type_input = ANY(emails_sent));
END;
$$;


ALTER FUNCTION "public"."append_email_type"("user_id_input" "uuid", "email_type_input" "public"."email_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_credit_deduction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if the amount is less than 0
    IF NEW.credits < 0 THEN
        RAISE EXCEPTION 'Invalid deduction amount';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_credit_deduction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_credit"("user_id" "uuid", "amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.user_credits
  SET credits = credits - amount
  WHERE user_credits.user_id = deduct_credit.user_id AND credits >= amount;
END;
$$;


ALTER FUNCTION "public"."deduct_credit"("user_id" "uuid", "amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_file_and_associated_data"("input_file_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  error_message TEXT;
BEGIN
  -- Start a transaction
  BEGIN
    -- Delete notes
    DELETE FROM notes WHERE file_id = input_file_id;
    
    -- Delete quizzes
    DELETE FROM quizzes WHERE file_id = input_file_id;
    
    -- Delete cheatsheets
    DELETE FROM cheatsheets WHERE file_id = input_file_id;
    
    -- Delete flashcards
    DELETE FROM flashcards WHERE file_id = input_file_id;
    
    
    -- Delete the file record
    DELETE FROM files WHERE id = input_file_id;

    -- If we get here, everything was successful
    RETURN 'Success';
  EXCEPTION
    WHEN OTHERS THEN
      -- Get the error message
      GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
      
      -- Return the error message
      RETURN 'Error: ' || error_message;
  END;
END;
$$;


ALTER FUNCTION "public"."delete_file_and_associated_data"("input_file_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_user_credits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, email, folder_count)
  VALUES (NEW.id, NEW.email, 0); -- Store the email from the new user
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."initialize_user_credits"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."document_sections" (
    "id" bigint NOT NULL,
    "document_id" bigint NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "extensions"."vector"(384)
);


ALTER TABLE "public"."document_sections" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_document_sections"("embedding" "extensions"."vector", "match_threshold" double precision) RETURNS SETOF "public"."document_sections"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."match_document_sections"("embedding" "extensions"."vector", "match_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_document_sections_by_folder"("query_embedding" "extensions"."vector", "match_threshold" double precision, "folder_id" "uuid") RETURNS TABLE("id" bigint, "document_id" bigint, "content" "text", "embedding" "extensions"."vector")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id,
    ds.document_id,
    ds.content,
    ds.embedding
  FROM document_sections ds
  JOIN documents d ON d.id = ds.document_id
  JOIN files f ON f.storage_path = d.storage_object_path
  WHERE f.folder_id = folder_id
    AND (ds.embedding <#> query_embedding) * -1 > match_threshold
  ORDER BY ds.embedding <#> query_embedding;
END;
$$;


ALTER FUNCTION "public"."match_document_sections_by_folder"("query_embedding" "extensions"."vector", "match_threshold" double precision, "folder_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reload_monthly_credits"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  IF NEW.subscription_status = 'paid' AND 
     (NEW.last_credit_reload IS NULL OR 
      NEW.last_credit_reload < DATE_TRUNC('month', NOW()))
  THEN
    NEW.credits := 40;
    NEW.last_credit_reload := DATE_TRUNC('month', NOW());
  END IF;
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."reload_monthly_credits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supabase_url"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  secret_value text;
begin
  select decrypted_secret into secret_value from vault.decrypted_secrets where name = 'supabase_url';
  return secret_value;
end;
$$;


ALTER FUNCTION "public"."supabase_url"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cheatsheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cheatsheets" OWNER TO "postgres";


ALTER TABLE "public"."document_sections" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."document_sections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "storage_object_id" "uuid" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


ALTER TABLE "public"."documents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."documents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."documents_with_storage_path" WITH ("security_invoker"='true') AS
 SELECT "documents"."id",
    "documents"."name",
    "documents"."storage_object_id",
    "documents"."created_by",
    "documents"."created_at",
    "objects"."name" AS "storage_object_path"
   FROM ("public"."documents"
     JOIN "storage"."objects" ON (("objects"."id" = "documents"."storage_object_id")));


ALTER TABLE "public"."documents_with_storage_path" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "folder_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flashcards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "cards" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."flashcards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quizzes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "questions" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quizzes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "subscription_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "credits" integer DEFAULT 5 NOT NULL,
    "last_credit_reload" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "folder_count" integer DEFAULT 0 NOT NULL,
    "subscription_end_date" timestamp with time zone,
    "stripe_customer_id" "text",
    "emails_sent" "public"."email_type"[] DEFAULT '{}'::"public"."email_type"[]
);


ALTER TABLE "public"."user_credits" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cheatsheets"
    ADD CONSTRAINT "cheatsheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_sections"
    ADD CONSTRAINT "document_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flashcards"
    ADD CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "cheatsheets_file_id_idx" ON "public"."cheatsheets" USING "btree" ("file_id");



CREATE INDEX "document_sections_embedding_idx" ON "public"."document_sections" USING "hnsw" ("embedding" "extensions"."vector_ip_ops");



CREATE INDEX "flashcards_file_id_idx" ON "public"."flashcards" USING "btree" ("file_id");



CREATE INDEX "idx_user_credits_emails_sent" ON "public"."user_credits" USING "gin" ("emails_sent");



CREATE INDEX "notes_file_id_idx" ON "public"."notes" USING "btree" ("file_id");



CREATE INDEX "quizzes_file_id_idx" ON "public"."quizzes" USING "btree" ("file_id");



CREATE OR REPLACE TRIGGER "before_update_user_credits" BEFORE UPDATE ON "public"."user_credits" FOR EACH ROW EXECUTE FUNCTION "public"."reload_monthly_credits"();



CREATE OR REPLACE TRIGGER "check_deduction_amount" BEFORE INSERT OR UPDATE ON "public"."user_credits" FOR EACH ROW EXECUTE FUNCTION "public"."check_credit_deduction"();



CREATE OR REPLACE TRIGGER "embed_document_sections" AFTER INSERT ON "public"."document_sections" REFERENCING NEW TABLE AS "inserted" FOR EACH STATEMENT EXECUTE FUNCTION "private"."embed"('content', 'embedding', '2');



ALTER TABLE ONLY "public"."cheatsheets"
    ADD CONSTRAINT "cheatsheets_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_sections"
    ADD CONSTRAINT "document_sections_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_storage_object_id_fkey" FOREIGN KEY ("storage_object_id") REFERENCES "storage"."objects"("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flashcards"
    ADD CONSTRAINT "flashcards_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can access their own cheatsheets" ON "public"."cheatsheets" USING (("file_id" IN ( SELECT "files"."id"
   FROM "public"."files"
  WHERE ("files"."folder_id" IN ( SELECT "folders"."id"
           FROM "public"."folders"
          WHERE ("folders"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can access their own flashcards" ON "public"."flashcards" USING (("file_id" IN ( SELECT "files"."id"
   FROM "public"."files"
  WHERE ("files"."folder_id" IN ( SELECT "folders"."id"
           FROM "public"."folders"
          WHERE ("folders"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can access their own notes" ON "public"."notes" USING (("file_id" IN ( SELECT "files"."id"
   FROM "public"."files"
  WHERE ("files"."folder_id" IN ( SELECT "folders"."id"
           FROM "public"."folders"
          WHERE ("folders"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can access their own quizzes" ON "public"."quizzes" USING (("file_id" IN ( SELECT "files"."id"
   FROM "public"."files"
  WHERE ("files"."folder_id" IN ( SELECT "folders"."id"
           FROM "public"."folders"
          WHERE ("folders"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create their own folders" ON "public"."folders" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own files" ON "public"."files" FOR DELETE USING (("auth"."uid"() IN ( SELECT "folders"."user_id"
   FROM "public"."folders"
  WHERE ("folders"."id" = "files"."folder_id"))));



CREATE POLICY "Users can delete their own folders" ON "public"."folders" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert document sections" ON "public"."document_sections" FOR INSERT TO "authenticated" WITH CHECK (("document_id" IN ( SELECT "documents"."id"
   FROM "public"."documents"
  WHERE ("documents"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can insert documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert their own files" ON "public"."files" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "folders"."user_id"
   FROM "public"."folders"
  WHERE ("folders"."id" = "files"."folder_id"))));



CREATE POLICY "Users can query their own document sections" ON "public"."document_sections" FOR SELECT TO "authenticated" USING (("document_id" IN ( SELECT "documents"."id"
   FROM "public"."documents"
  WHERE ("documents"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can query their own documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update their own credit information" ON "public"."user_credits" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own document sections" ON "public"."document_sections" FOR UPDATE TO "authenticated" USING (("document_id" IN ( SELECT "documents"."id"
   FROM "public"."documents"
  WHERE ("documents"."created_by" = "auth"."uid"())))) WITH CHECK (("document_id" IN ( SELECT "documents"."id"
   FROM "public"."documents"
  WHERE ("documents"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can update their own folders" ON "public"."folders" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own credit information" ON "public"."user_credits" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own files" ON "public"."files" FOR SELECT USING (("auth"."uid"() IN ( SELECT "folders"."user_id"
   FROM "public"."folders"
  WHERE ("folders"."id" = "files"."folder_id"))));



CREATE POLICY "Users can view their own folders" ON "public"."folders" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."cheatsheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flashcards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quizzes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."append_email_type"("user_id_input" "uuid", "email_type_input" "public"."email_type") TO "anon";
GRANT ALL ON FUNCTION "public"."append_email_type"("user_id_input" "uuid", "email_type_input" "public"."email_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_email_type"("user_id_input" "uuid", "email_type_input" "public"."email_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_credit_deduction"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_credit_deduction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_credit_deduction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_credit"("user_id" "uuid", "amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_credit"("user_id" "uuid", "amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_credit"("user_id" "uuid", "amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_file_and_associated_data"("input_file_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_file_and_associated_data"("input_file_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_file_and_associated_data"("input_file_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_user_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_user_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_user_credits"() TO "service_role";



GRANT ALL ON TABLE "public"."document_sections" TO "anon";
GRANT ALL ON TABLE "public"."document_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."document_sections" TO "service_role";









GRANT ALL ON FUNCTION "public"."reload_monthly_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."reload_monthly_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reload_monthly_credits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."supabase_url"() TO "anon";
GRANT ALL ON FUNCTION "public"."supabase_url"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."supabase_url"() TO "service_role";






























GRANT ALL ON TABLE "public"."cheatsheets" TO "anon";
GRANT ALL ON TABLE "public"."cheatsheets" TO "authenticated";
GRANT ALL ON TABLE "public"."cheatsheets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."document_sections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."document_sections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."document_sections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."documents_with_storage_path" TO "anon";
GRANT ALL ON TABLE "public"."documents_with_storage_path" TO "authenticated";
GRANT ALL ON TABLE "public"."documents_with_storage_path" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."flashcards" TO "anon";
GRANT ALL ON TABLE "public"."flashcards" TO "authenticated";
GRANT ALL ON TABLE "public"."flashcards" TO "service_role";



GRANT ALL ON TABLE "public"."folders" TO "anon";
GRANT ALL ON TABLE "public"."folders" TO "authenticated";
GRANT ALL ON TABLE "public"."folders" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."quizzes" TO "anon";
GRANT ALL ON TABLE "public"."quizzes" TO "authenticated";
GRANT ALL ON TABLE "public"."quizzes" TO "service_role";



GRANT ALL ON TABLE "public"."user_credits" TO "anon";
GRANT ALL ON TABLE "public"."user_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credits" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
