import { createClient } from '@supabase/supabase-js';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { codeBlock } from 'common-tags';
import OpenAI from 'openai';

// These are automatically injected
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

// Debug information
console.log('Environment variables:');
console.log('SUPABASE_URL exists:', !!supabaseUrl);
console.log('SUPABASE_ANON_KEY exists:', !!supabaseAnonKey);
console.log('OPENAI_API_KEY exists:', !!openaiApiKey);

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Step 1: Check for authorization header
    const authorization = req.headers.get('Authorization');
  
    if (!authorization) {
      console.log('No authorization header found');
      return new Response(
        JSON.stringify({ error: `No authorization header passed` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  
    // Step 2: Create Supabase client with authorization
    const supabase = createClient(supabaseUrl, supabaseAnonKey!, {
      global: {
        headers: {
          authorization,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    // Step 3: Parse request body
    const { chatId, message, messages = [], embedding, userData } = await req.json();
    console.log('Request parsed successfully');
    console.log('Client-provided userData exists:', !!userData);
    
    // Step 4: Set up user data variables
    let user;
    let profileData;
    let medications = [];
    let appointments = [];
    
    // If client provided userData, use it directly
    if (userData && Object.keys(userData).length > 0) {
      console.log('Using client-provided user data');
      profileData = userData.profile || {};
      medications = userData.medications || [];
      appointments = userData.appointments || [];
      
      // Try to get user ID from auth as a backup
      try {
        const { data: authData } = await supabase.auth.getUser();
        user = authData.user;
      } catch (e) {
        console.log('Could not get authenticated user, using client data only');
        user = { id: 'client-provided-user' };
      }
    } else {
      // Otherwise, fetch data from the database
      console.log('No client-provided user data, fetching from database');
      
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          console.log('Authentication error or user not found, using empty data');
          // Use minimal data
          user = { id: 'unknown-user' };
          
          // Basic profile data
          profileData = {
            id: 'unknown-user',
            full_name: 'User',
          };
          
          // Empty medications and appointments
          medications = [];
          appointments = [];
        } else {
          user = userData.user;
          console.log('User found:', user.id);
          
          // Get actual user profile data
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.error('Error getting user profile:', profileError);
            // Use basic profile data
            profileData = {
              id: user.id,
              full_name: 'User',
            };
          } else {
            profileData = profile;
          }
          
          // Get actual medications
          const { data: meds, error: medicationsError } = await supabase
            .from('medications')
            .select('*, documents(*)')
            .eq('user_id', user.id);
          
          if (medicationsError) {
            console.error('Error getting medications:', medicationsError);
            // Use empty array - no mock data
            medications = [];
          } else if (meds && meds.length > 0) {
            medications = meds;
          } else {
            // If no medications found, use empty array
            medications = [];
          }
          
          // Get actual appointments
          const { data: apts, error: appointmentsError } = await supabase
            .from('appointments')
            .select('*')
            .eq('user_id', user.id);
          
          if (appointmentsError) {
            console.error('Error getting appointments:', appointmentsError);
            // Use empty array - no mock data
            appointments = [];
          } else if (apts && apts.length > 0) {
            appointments = apts;
          } else {
            // If no appointments found, use empty array
            appointments = [];
          }
        }
      } catch (authError) {
        console.error('Error in authentication process:', authError);
        // Use minimal data instead of mock data
        user = { id: 'error-user' };
        profileData = {
          id: 'error-user',
          full_name: 'User',
        };
        medications = [];
        appointments = [];
      }
    }
    
    console.log('Profile data found:', !!profileData);
    console.log('Medications found:', medications?.length || 0);
    console.log('Appointments found:', appointments?.length || 0);
    
    try {
      // Step 5: Get matching documents if embedding is provided
      let injectedDocs = 'No documents found';
      
      if (embedding) {
        console.log('Embedding found, searching documents');
        try {
          const { data: documents, error: matchError } = await supabase
            .rpc('match_document_sections', {
              embedding,
              match_threshold: 0.8,
            })
            .select('content')
            .limit(5);

          if (matchError) {
            console.error('Error matching documents:', matchError);
            // Continue without documents rather than failing
          } else {
            injectedDocs = documents && documents.length > 0
              ? documents.map(({ content }) => content).join('\n\n')
              : 'No documents found';

            console.log('Documents found:', documents?.length || 0);
          }
        } catch (docError) {
          console.error('Error in document search:', docError);
          // Continue without documents rather than failing
          injectedDocs = 'Error accessing documents';
        }
      } else {
        console.log('No embedding or invalid embedding provided');
      }
      
      // Step 6: Format user data
      const formattedUserData = {
        profile: profileData || {},
        medications: medications || [],
        appointments: appointments || [],
      };
      
      // Format medications for easy reference
      const formattedMedications = (medications || []).map(med => {
        const prescriptionContent = med.documents?.content || 'No prescription available';
        return {
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          start_date: med.start_date,
          end_date: med.end_date,
          doctor: med.doctor,
          notes: med.notes,
          prescription: prescriptionContent
        };
      });
      
      // Format appointments for easy reference
      const formattedAppointments = (appointments || []).map(apt => {
        // Parse the appointment_date to get separate date and time
        let dateStr = '';
        let timeStr = '';
        if (apt.appointment_date) {
          const dateObj = new Date(apt.appointment_date);
          dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
          timeStr = dateObj.toTimeString().split(' ')[0].substr(0, 5); // HH:MM
        }
        
        return {
          doctor: apt.doctor_name || 'No doctor specified',
          purpose: apt.title || 'No purpose specified',
          location: apt.location || 'No location specified',
          date: dateStr || 'No date specified',
          time: timeStr || 'No time specified',
          notes: apt.notes || ''
        };
      });
      
      // Step 7: Create completion messages
      const completionMessages = [
        {
          role: 'system',
          content: codeBlock`
            You are a helpful health assistant for elderly users. Your goal is to provide clear, 
            compassionate guidance about their health, medications, and appointments.
            
            User Profile Information:
            ${JSON.stringify(profileData || {}, null, 2)}
            
            Medications:
            ${medications.length === 0 
              ? "The user currently has no medications recorded in the system." 
              : JSON.stringify(formattedMedications, null, 2)}
            
            Appointments:
            ${appointments.length === 0 
              ? "The user currently has no appointments scheduled in the system." 
              : JSON.stringify(formattedAppointments, null, 2)}
            
            Relevant Documents:
            ${injectedDocs}
            
            When responding to the user:
            1. Be concise and clear - use simple language
            2. If they ask about their medications, provide specific details about their prescriptions, or let them know if they have no medications recorded
            3. If they ask about appointments, provide details about upcoming appointments, or let them know if they have no appointments scheduled
            4. If they ask something you don't have information about, kindly let them know
            5. Be warm and reassuring, as many users may be elderly or anxious about their health
            
            Keep responses relatively brief and focused on addressing their specific question.
        `,
        },
        ...messages,
      ];
      
      // Step 8: Call OpenAI
      console.log('Calling OpenAI');
      const completionStream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: completionMessages,
        max_tokens: 1024,
        temperature: 0.2,
        stream: true,
      });
  
      // Step 9: Return streaming response
      const stream = OpenAIStream(completionStream);
      return new StreamingTextResponse(stream, { headers: corsHeaders });
    } catch (innerError) {
      console.error('Error in OpenAI or document processing:', innerError);
      return new Response(
        JSON.stringify({ error: `Error processing request: ${innerError.message}` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(
      JSON.stringify({ error: `Error in chat function: ${error.message}` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});