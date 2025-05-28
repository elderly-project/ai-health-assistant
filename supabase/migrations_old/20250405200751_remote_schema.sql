CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION initialize_user_credits();


create policy "Authenticated users can upload files"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (((bucket_id = 'files'::text) AND (owner = auth.uid()) AND (private.uuid_or_null(path_tokens[1]) IS NOT NULL)));


create policy "Users can delete their own files"
on "storage"."objects"
as permissive
for delete
to authenticated
using (((bucket_id = 'files'::text) AND (owner = auth.uid())));


create policy "Users can update their own files"
on "storage"."objects"
as permissive
for update
to authenticated
with check (((bucket_id = 'files'::text) AND (owner = auth.uid())));


create policy "Users can view their own files"
on "storage"."objects"
as permissive
for select
to authenticated
using (((bucket_id = 'files'::text) AND (owner = auth.uid())));


CREATE TRIGGER on_file_upload AFTER INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION private.handle_storage_update();


