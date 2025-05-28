// Follow Supabase edge function format
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS headers for the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  email: string;
  password: string;
  fullName?: string;
  creatorId?: string; // ID of the doctor/guardian creating the patient
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  
  try {
    // Create a Supabase client with the Admin key
    const supabaseAdmin = createClient(
      // Get Supabase URL from environment variable
      Deno.env.get('SUPABASE_URL') ?? '',
      // Get Supabase admin key from environment variable
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false }}
    );
    
    // Get client Auth details for the creator (if JWT token is provided)
    let creatorId: string | undefined = undefined;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader) {
      // If the request has an auth header, validate it and get the user
      const token = authHeader.replace('Bearer ', '');
      const { data: authData } = await supabaseAdmin.auth.getUser(token);
      if (authData?.user) {
        creatorId = authData.user.id;
      }
    }
    
    // Parse request body
    const { email, password, fullName, creatorId: requestCreatorId } = await req.json() as RequestBody;
    
    // Use creator ID from token or from request body
    creatorId = creatorId || requestCreatorId;
    
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        }
      );
    }
    
    // Create user in Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
    });
    
    if (userError) {
      return new Response(
        JSON.stringify({ error: userError.message }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        }
      );
    }
    
    // Create user profile if user was created
    if (userData?.user) {
      const userId = userData.user.id;
      
      // Create user profile using admin client to bypass RLS
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: userId,
          full_name: fullName,
          created_at: new Date().toISOString(),
        });
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
        
        // Return a detailed error but don't fail completely - the auth user was created
        return new Response(
          JSON.stringify({ 
            userId: userData.user.id,
            warning: 'User created but profile creation failed',
            profileError: profileError.message,
            message: 'User created but incomplete'
          }),
          { 
            status: 207, // Partial success
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }
          }
        );
      }
      
      // Create relationship between creator and patient if creator ID is provided
      if (creatorId) {
        try {
          const { error: relationshipError } = await supabaseAdmin
            .from('patient_relationships')
            .insert({
              patient_id: userId,
              provider_id: creatorId,
              relationship_type: 'primary',
              created_at: new Date().toISOString(),
            });
          
          if (relationshipError) {
            console.error('Error creating relationship:', relationshipError);
            // Don't fail completely if relationship creation fails
          }
        } catch (relationshipError) {
          console.error('Error in relationship creation:', relationshipError);
          // Continue even if relationship creation fails
        }
      }
      
      return new Response(
        JSON.stringify({ 
          userId: userData.user.id,
          message: 'User created successfully' 
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to create user' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      }
    );
  } catch (error) {
    console.error('Error in create-patient-user function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      }
    );
  }
}); 