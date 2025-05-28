'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePipeline } from '@/lib/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { Database } from '@/supabase/functions/_lib/database';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useChat } from 'ai/react';
import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { VoiceButton } from '@/components/VoiceButton';
import { PhoneCall, MessageCircle, ArrowLeft, User } from 'lucide-react';
import { ElevenLabsReactAgent } from '@/components/ElevenLabsReactAgent';
import Link from 'next/link';

interface PatientProfile {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  allergies: string[] | null;
  medical_conditions: string[] | null;
  emergency_contact: string | null;
  emergency_contact_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function PatientChatPage({ params }: { params: { id: string } }) {
  const supabase = createClientComponentClient<Database>();
  const [patientData, setPatientData] = useState<any>(null);
  const [patientDataLoaded, setPatientDataLoaded] = useState(false);
  const [showVoiceUI, setShowVoiceUI] = useState(false);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);

  const generateEmbedding = usePipeline(
    'feature-extraction',
    'Supabase/gte-small'
  );

  // Fetch patient data on component load
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        // Get current user to verify access
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        // Verify the user has access to this patient
        const { data: relationship, error: relationshipError } = await supabase
          .from('patient_relationships')
          .select('*')
          .eq('provider_id', userData.user?.id)
          .eq('patient_id', params.id)
          .single();

        if (relationshipError) {
          throw new Error('You do not have access to this patient');
        }

        // Fetch patient profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', params.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching patient profile:', profileError);
        }

        setPatientProfile(profileData || {
          id: params.id,
          full_name: 'Patient (No Profile)',
          date_of_birth: null,
          phone_number: null,
          allergies: [],
          medical_conditions: [],
          emergency_contact: null,
          emergency_contact_phone: null,
          created_at: null,
          updated_at: null
        });

        // Fetch patient medications
        const { data: medsData, error: medsError } = await supabase
          .from('medications')
          .select('*, documents(*)')
          .eq('user_id', params.id);

        if (medsError) {
          console.error('Error fetching patient medications:', medsError);
        }

        // Fetch patient appointments
        const { data: apptsData, error: apptsError } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', params.id)
          .order('appointment_date', { ascending: true });

        if (apptsError) {
          console.error('Error fetching patient appointments:', apptsError);
        }

        // Format the data for the chat function
        const formattedPatientData = {
          profile: profileData || {},
          medications: medsData || [],
          appointments: apptsData || [],
          patientId: params.id,
          isPatientChat: true // Flag to indicate this is a patient-specific chat
        };

        setPatientData(formattedPatientData);
        setPatientDataLoaded(true);
        
        console.log('Patient data loaded for chat:', !!formattedPatientData);

      } catch (error) {
        console.error('Error fetching patient data:', error);
        toast({
          variant: 'destructive',
          description: 'Failed to load patient information. Some chat features may be limited.',
        });
        setPatientDataLoaded(true); // Set to true even on error so chat can still function
      }
    };

    fetchPatientData();
  }, [supabase, params.id]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
    });

  const isReady = !!generateEmbedding && patientDataLoaded;

  // Handle voice transcript
  const handleVoiceTranscript = (text: string) => {
    if (text) {
      setInput(text);
      // Auto-submit the form after a short delay
      setTimeout(() => {
        const formElement = document.querySelector('form');
        if (formElement) {
          const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
          formElement.dispatchEvent(submitEvent);
        }
      }, 500);
    }
  };

  // Handle voice response (for analytics or future enhancements)
  const handleVoiceResponse = (responseText: string) => {
    console.log('Voice response played:', responseText.substring(0, 50) + '...');
  };

  // Toggle between chat UI and voice UI
  const toggleVoiceUI = () => {
    setShowVoiceUI(!showVoiceUI);
  };

  return (
    <div className="max-w-6xl flex flex-col items-center w-full h-full">
      {/* Header with patient info and navigation */}
      <div className="w-full flex justify-between items-center mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-4">
          <Link href={`/patients/${params.id}/dashboard`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-blue-900">
                Chat with {patientProfile?.full_name || 'Patient'}
              </h2>
              <p className="text-sm text-blue-700">
                AI Assistant trained on this patient's health information
              </p>
            </div>
          </div>
        </div>
        
        {/* Mode toggle button */}
        <Button
          onClick={toggleVoiceUI}
          variant="outline"
          className="flex items-center gap-2"
        >
          {showVoiceUI ? (
            <>
              <MessageCircle className="h-4 w-4" />
              Switch to Text Chat
            </>
          ) : (
            <>
              <PhoneCall className="h-4 w-4" />
              Switch to Voice Assistant
            </>
          )}
        </Button>
      </div>
      
      {/* Chat UI */}
      {!showVoiceUI ? (
        <div className="flex flex-col w-full gap-6 grow my-2 sm:my-10 p-4 sm:p-8 sm:border rounded-sm overflow-y-auto">
          <div className="border-slate-400 rounded-lg flex flex-col justify-start gap-4 pr-2 grow overflow-y-scroll">
            {messages.map(({ id, role, content }) => (
              <div
                key={id}
                className={cn(
                  'rounded-xl bg-gray-500 text-white px-4 py-2 max-w-lg',
                  role === 'user' ? 'self-end bg-blue-600' : 'self-start'
                )}
                data-bot-message={role === 'assistant' ? 'true' : 'false'}
              >
                {content}
              </div>
            ))}
            {isLoading && (
              <div className="self-start m-6 text-gray-500 before:text-gray-500 after:text-gray-500 dot-pulse" />
            )}
            {messages.length === 0 && (
              <div className="self-stretch flex grow items-center justify-center">
                <div className="text-center">
                  <svg
                    className="opacity-10 mx-auto mb-4"
                    width="150px"
                    height="150px"
                    version="1.1"
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g>
                      <path d="m77.082 39.582h-29.164c-3.543 0-6.25 2.707-6.25 6.25v16.668c0 3.332 2.707 6.25 6.25 6.25h20.832l8.332 8.332v-8.332c3.543 0 6.25-2.918 6.25-6.25v-16.668c0-3.5391-2.707-6.25-6.25-6.25z" />
                      <path d="m52.082 25h-29.164c-3.543 0-6.25 2.707-6.25 6.25v16.668c0 3.332 2.707 6.25 6.25 6.25v8.332l8.332-8.332h6.25v-8.332c0-5.832 4.582-10.418 10.418-10.418h10.418v-4.168c-0.003907-3.543-2.7109-6.25-6.2539-6.25z" />
                    </g>
                  </svg>
                  <p className="text-gray-500 mb-2">
                    Start a conversation about {patientProfile?.full_name || 'this patient'}
                  </p>
                  <p className="text-sm text-gray-400">
                    Ask about medications, appointments, or health information
                  </p>
                </div>
              </div>
            )}
          </div>
          <form
            className="flex items-center space-x-2 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!generateEmbedding) {
                throw new Error('Unable to generate embeddings');
              }

              const output = await generateEmbedding(input, {
                pooling: 'mean',
                normalize: true,
              });

              const embedding = JSON.stringify(Array.from(output.data));

              const {
                data: { session },
              } = await supabase.auth.getSession();

              if (!session) {
                toast({
                  variant: 'destructive',
                  description: 'You must be logged in to use the chat.',
                });
                return;
              }

              // Send the patient data with every message to maintain consistency
              handleSubmit(e, {
                options: {
                  headers: {
                    authorization: `Bearer ${session.access_token}`,
                  },
                  body: {
                    embedding,
                    userData: patientData, // Send patient data instead of user data
                  },
                },
              });
            }}
          >
            <Input
              type="text"
              autoFocus
              placeholder={`Ask about ${patientProfile?.full_name || 'this patient'}...`}
              value={input}
              onChange={handleInputChange}
              className="flex-grow"
            />
            <Button type="submit" disabled={!isReady || !input.trim()}>
              {isReady ? 'Send' : 'Loading...'}
            </Button>
            
            {/* Voice Button */}
            <VoiceButton 
              onTranscript={handleVoiceTranscript}
              onResponse={handleVoiceResponse}
              isProcessing={isLoading}
              disabled={!isReady}
            />
          </form>
        </div>
      ) : (
        /* ElevenLabs Voice UI */
        <div className="flex flex-col w-full h-[80vh] items-center justify-center p-4 sm:p-8 sm:border rounded-sm">
          <h2 className="text-xl font-semibold mb-2">
            Voice Assistant for {patientProfile?.full_name || 'Patient'}
          </h2>
          <p className="text-gray-600 mb-8">
            Speak with the AI assistant about this patient's health information
          </p>
          {patientData && (
            <ElevenLabsReactAgent 
              userData={patientData} 
              onToggleToTextChat={() => setShowVoiceUI(false)} 
            />
          )}
        </div>
      )}
    </div>
  );
} 