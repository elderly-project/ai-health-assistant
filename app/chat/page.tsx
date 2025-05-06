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
import { PhoneCall, MessageCircle } from 'lucide-react';
import { ElevenLabsAgent } from '@/components/ElevenLabsAgent';
import { ElevenLabsApiAgent } from '@/components/ElevenLabsApiAgent';
import { ElevenLabsReactAgent } from '@/components/ElevenLabsReactAgent';

export default function ChatPage() {
  const supabase = createClientComponentClient<Database>();
  const [userData, setUserData] = useState<any>(null);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const [showVoiceUI, setShowVoiceUI] = useState(false);
  const [agentImplementation, setAgentImplementation] = useState<'iframe' | 'api' | 'react'>('react');

  const generateEmbedding = usePipeline(
    'feature-extraction',
    'Supabase/gte-small'
  );

  // Fetch user data on component load
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        // Check if user has completed onboarding
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userData.user?.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError);
        }

        // Fetch medications
        const { data: medsData, error: medsError } = await supabase
          .from('medications')
          .select('*, documents(*)')
          .eq('user_id', userData.user?.id);

        if (medsError) {
          console.error('Error fetching medications:', medsError);
        }

        // Fetch appointments
        const { data: apptsData, error: apptsError } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', userData.user?.id)
          .order('appointment_date', { ascending: true });

        if (apptsError) {
          console.error('Error fetching appointments:', apptsError);
        }

        // Format the data for the chat function
        const formattedUserData = {
          profile: profileData || {},
          medications: medsData || [],
          appointments: apptsData || []
        };

        setUserData(formattedUserData);
        setUserDataLoaded(true);
        
        console.log('User data loaded for chat:', !!formattedUserData);

      } catch (error) {
        console.error('Error fetching user data:', error);
        toast({
          variant: 'destructive',
          description: 'Failed to load your health information. Some chat features may be limited.',
        });
        setUserDataLoaded(true); // Set to true even on error so chat can still function
      }
    };

    fetchUserData();
  }, [supabase]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
    });

  const isReady = !!generateEmbedding && userDataLoaded;

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
      {/* Mode toggle button */}
      <div className="w-full flex justify-end mb-2">
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
                <svg
                  className="opacity-10"
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

              // Send the user data with every message to maintain consistency
              handleSubmit(e, {
                options: {
                  headers: {
                    authorization: `Bearer ${session.access_token}`,
                  },
                  body: {
                    embedding,
                    userData, // Always send user data to maintain consistency
                  },
                },
              });
            }}
          >
            <Input
              type="text"
              autoFocus
              placeholder="Send a message"
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
          <div className="w-full flex justify-end mb-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAgentImplementation('iframe')}
                className={agentImplementation === 'iframe' ? 'bg-blue-50' : ''}
              >
                Iframe Embed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAgentImplementation('api')}
                className={agentImplementation === 'api' ? 'bg-blue-50' : ''}
              >
                API Integration
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAgentImplementation('react')}
                className={agentImplementation === 'react' ? 'bg-blue-50' : ''}
              >
                React SDK UI
              </Button>
            </div>
          </div>
          
          <h2 className="text-xl font-semibold mb-8">Health Assistant Voice Agent</h2>
          {userData && agentImplementation === 'iframe' && (
            <ElevenLabsAgent userData={userData} onToggleToTextChat={() => setShowVoiceUI(false)} />
          )}
          {userData && agentImplementation === 'api' && (
            <ElevenLabsApiAgent userData={userData} onToggleToTextChat={() => setShowVoiceUI(false)} />
          )}
          {userData && agentImplementation === 'react' && (
            <ElevenLabsReactAgent userData={userData} onToggleToTextChat={() => setShowVoiceUI(false)} />
          )}
        </div>
      )}
    </div>
  );
}
