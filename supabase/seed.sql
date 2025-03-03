select vault.create_secret( -- vault stores configurations and secrets within the db. it encrypts the information
  'http://api.supabase.internal:8000',
  'supabase_url'
);