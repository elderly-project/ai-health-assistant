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
  profile: {
    id: string;
    full_name: string;
    date_of_birth: string | null;
    phone_number: string | null;
    allergies: string[];
    medical_conditions: string[];
    emergency_contact: string | null;
    emergency_contact_phone: string | null;
    updated_at: string;
    created_at?: string;
  };
  updatedBy: string; // ID of the provider making the update
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
    let providerId: string | undefined = undefined;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader) {
      // If the request has an auth header, validate it and get the user
      const token = authHeader.replace('Bearer ', '');
      const { data: authData } = await supabaseAdmin.auth.getUser(token);
      if (authData?.user) {
        providerId = authData.user.id;
      }
    }
    
    // Parse request body
    const { profile, updatedBy } = await req.json() as RequestBody;
    
    // Use provider ID from token or from request body
    providerId = providerId || updatedBy;
    
    if (!profile || !profile.id) {
      return new Response(
        JSON.stringify({ error: 'Profile data and ID are required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        }
      );
    }

    const patientId = profile.id;
    
    // Verify that the provider has a relationship with this patient
    const { data: relationshipData, error: relationshipError } = await supabaseAdmin
      .from('patient_relationships')
      .select('*')
      .eq('provider_id', providerId)
      .eq('patient_id', patientId)
      .single();
    
    if (relationshipError) {
      console.error('Error checking relationship:', relationshipError);
      return new Response(
        JSON.stringify({ 
          error: 'Permission denied. You do not have a relationship with this patient',
          details: relationshipError
        }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        }
      );
    }
    
    // Update the profile with admin permissions, bypassing RLS
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert(profile)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        profile: data,
        message: 'Profile updated successfully' 
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      }
    );
  } catch (error) {
    console.error('Error in update-patient-profile function:', error);
    
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