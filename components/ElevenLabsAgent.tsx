import { useEffect, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink } from 'lucide-react';

declare global {
  interface Window {
    ElevenLabs: {
      Agent: {
        init: (options: {
          agentId: string;
          element: HTMLElement;
          apiKey: string;
          callbacks?: {
            onAgentConnected?: () => void;
            onAgentDisconnected?: () => void;
            onMessage?: (message: any) => void;
            onError?: (error: any) => void;
            onAgentStateChange?: (state: any) => void;
          };
          userData?: Record<string, any>;
        }) => any;
      };
    };
  }
}

interface ElevenLabsAgentProps {
  userData: any;
  onToggleToTextChat?: () => void;
}

export function ElevenLabsAgent({ userData, onToggleToTextChat }: ElevenLabsAgentProps) {
  const agentContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isAgentReady, setIsAgentReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [useIframeMethod, setUseIframeMethod] = useState(true);
  const agentInstanceRef = useRef<any>(null);
  const supabase = createClientComponentClient<Database>();
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  // Format data for ElevenLabs
  const formatUserData = () => {
    return {
      profile: {
        name: userData.profile?.full_name || 'User',
        age: userData.profile?.age || '',
        gender: userData.profile?.gender || '',
        medical_conditions: userData.profile?.medical_conditions || [],
        allergies: userData.profile?.allergies || []
      },
      medications: userData.medications?.map((med: any) => ({
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        start_date: med.start_date,
        end_date: med.end_date,
        doctor: med.doctor,
        notes: med.notes
      })) || [],
      appointments: userData.appointments?.map((apt: any) => ({
        doctor: apt.doctor_name,
        purpose: apt.title,
        location: apt.location,
        date: apt.appointment_date ? new Date(apt.appointment_date).toISOString().split('T')[0] : '',
        time: apt.appointment_date ? new Date(apt.appointment_date).toTimeString().split(' ')[0].substr(0, 5) : '',
        notes: apt.notes
      })) || []
    };
  };

  // Function to load the ElevenLabs script
  const loadElevenLabsScript = () => {
    if (useIframeMethod) {
      // Skip script loading if using iframe
      setIsLoading(false);
      return;
    }
    
    setLoadError(null);
    setIsLoading(true);

    // Check if script already exists and remove it if it does
    if (scriptRef.current) {
      try {
        document.body.removeChild(scriptRef.current);
      } catch (e) {
        console.error('Error removing previous script:', e);
      }
      scriptRef.current = null;
    }

    console.log('Loading ElevenLabs widget script...');
    const script = document.createElement('script');
    script.src = 'https://widget.elevenlabs.io/widget.js';
    script.async = true;
    
    // Add unique query parameter to prevent caching
    script.src = `${script.src}?t=${new Date().getTime()}`;
    
    script.onload = () => {
      console.log('ElevenLabs widget script loaded successfully');
      setIsScriptLoaded(true);
      setLoadError(null);
    };
    
    script.onerror = (error) => {
      console.error('Failed to load ElevenLabs widget script:', error);
      setLoadError('Unable to load the voice assistant widget. Trying alternate method...');
      setIsLoading(false);
      
      // Log detailed information about the error
      if (error instanceof Event) {
        const target = error.target as HTMLScriptElement;
        console.error('Script error details:', {
          src: target.src,
          status: 'error',
          readyState: target.readyState
        });
      }
      
      // Switch to iframe method
      setUseIframeMethod(true);
    };
    
    document.body.appendChild(script);
    scriptRef.current = script;
  };

  // Load the script on component mount
  useEffect(() => {
    // Skip script loading if we're using the iframe method
    if (useIframeMethod) {
      setIsLoading(false);
      return;
    }
    
    loadElevenLabsScript();
    
    return () => {
      // Clean up on unmount
      if (scriptRef.current) {
        try {
          document.body.removeChild(scriptRef.current);
        } catch (e) {
          console.error('Error removing script during cleanup:', e);
        }
      }
    };
  }, [useIframeMethod]);

  // Initialize the agent once the script is loaded and we have a container
  useEffect(() => {
    if (isScriptLoaded && agentContainerRef.current && !isAgentReady && userData && !useIframeMethod) {
      const initAgent = async () => {
        try {
          // Check if the ElevenLabs global object exists
          if (!window.ElevenLabs || !window.ElevenLabs.Agent) {
            console.error('ElevenLabs global object not found');
            setLoadError('ElevenLabs API not available. Trying alternate method...');
            setIsLoading(false);
            setUseIframeMethod(true);
            return;
          }
          
          // Check if we have an agent ID
          const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
          if (!agentId || agentId === 'your-agent-id-here') {
            console.error('Missing ElevenLabs agent ID');
            setLoadError('Missing agent configuration. Please check your settings.');
            setIsLoading(false);
            return;
          }
          
          // Check if we have an API key
          const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
          if (!apiKey) {
            console.error('Missing ElevenLabs API key');
            setLoadError('Missing API key. Please check your settings.');
            setIsLoading(false);
            return;
          }

          // Format data for ElevenLabs agent
          const formattedUserData = formatUserData();

          console.log('Initializing ElevenLabs agent with user data:', formattedUserData);
          console.log('Using agent ID:', agentId);

          // Initialize the agent
          const agent = window.ElevenLabs.Agent.init({
            agentId: agentId,
            element: agentContainerRef.current,
            apiKey: apiKey,
            callbacks: {
              onAgentConnected: () => {
                console.log('ElevenLabs agent connected');
                setIsAgentReady(true);
                setIsLoading(false);
                setLoadError(null);
              },
              onAgentDisconnected: () => {
                console.log('ElevenLabs agent disconnected');
                setIsAgentReady(false);
              },
              onError: (error) => {
                console.error('ElevenLabs agent error:', error);
                setLoadError('There was an error with the voice assistant. Trying alternate method...');
                setUseIframeMethod(true);
              },
              onMessage: (message) => {
                console.log('Agent message:', message);
              }
            },
            userData: formattedUserData
          });

          agentInstanceRef.current = agent;
        } catch (error) {
          console.error('Error initializing ElevenLabs agent:', error);
          setLoadError('Could not initialize the voice assistant. Trying alternate method...');
          setIsLoading(false);
          setUseIframeMethod(true);
        }
      };

      initAgent();
    }
  }, [isScriptLoaded, userData]);

  // Handle retry
  const handleRetry = () => {
    setIsScriptLoaded(false);
    setIsAgentReady(false);
    setIsLoading(true);
    setLoadError(null);
    
    // Toggle between iframe and script method
    if (useIframeMethod) {
      // Try the script method
      setUseIframeMethod(false);
      loadElevenLabsScript();
    } else {
      // Try the iframe method
      setUseIframeMethod(true);
      setIsLoading(false);
    }
  };

  // Directly go to ElevenLabs website
  const handleGoToElevenLabs = () => {
    window.open(`https://elevenlabs.io/app/talk-to?agent_id=${process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID}&full=true`, '_blank');
  };

  // Render the iframe direct embed
  if (useIframeMethod) {
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    // Add parameters that might help with the embedding
    const iframeUrl = `https://elevenlabs.io/app/talk-to?agent_id=${agentId}&embed=true&allowMic=true`;
    
    return (
      <div className="flex flex-col items-center w-full">
        <div className="mb-4 flex w-full justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">ElevenLabs Voice Assistant</h3>
            <p className="text-sm text-gray-500">Using direct integration with ElevenLabs</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Try Widget
            </Button>
            <Button
              onClick={handleGoToElevenLabs}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              Open in ElevenLabs
            </Button>
            <Button
              onClick={() => {
                if (onToggleToTextChat) {
                  onToggleToTextChat();
                }
              }}
              variant="secondary"
              size="sm"
            >
              Return to Text Chat
            </Button>
          </div>
        </div>
        
        <iframe 
          ref={iframeRef}
          src={iframeUrl}
          width="100%" 
          height="600px"
          style={{ 
            border: "1px solid #e5e7eb", 
            borderRadius: "0.5rem", 
            minHeight: "600px" 
          }}
          allow="microphone; camera; autoplay; clipboard-read; clipboard-write"
          allowFullScreen
          title="ElevenLabs Voice Assistant"
        ></iframe>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {isLoading && !loadError && (
        <div className="text-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Initializing voice assistant...</p>
        </div>
      )}
      
      {loadError && (
        <div className="text-center my-8 p-6 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-500 mb-4">{loadError}</p>
          <div className="flex gap-4 justify-center">
            <Button onClick={handleRetry} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button 
              onClick={() => {
                if (onToggleToTextChat) {
                  onToggleToTextChat();
                } else {
                  window.location.href = window.location.pathname;
                }
              }} 
              variant="secondary" 
              className="flex items-center gap-2"
            >
              Return to Text Chat
            </Button>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            <p>Debug Information:</p>
            <p>Agent ID: {process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'Not set'}</p>
            <p>API Key: {process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ? 'Set' : 'Not set'}</p>
            <p>User Data: {userData ? 'Available' : 'Not available'}</p>
            <p>Script Loaded: {isScriptLoaded ? 'Yes' : 'No'}</p>
            <p>Global Object: {window.ElevenLabs ? 'Available' : 'Not available'}</p>
            <p className="mt-2">
              <a 
                href="https://elevenlabs.io/docs/api-reference/introduction" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View ElevenLabs Documentation
              </a>
            </p>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-700">
              If you continue to experience issues, you can try using the voice assistant directly on ElevenLabs' website.
            </p>
            <Button 
              onClick={handleGoToElevenLabs}
              variant="outline" 
              size="sm"
              className="mt-2 flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in ElevenLabs
            </Button>
            <p className="mt-2 text-xs text-gray-500">
              Direct URL: https://elevenlabs.io/app/talk-to?agent_id={process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID}&full=true
            </p>
          </div>
        </div>
      )}
      
      <div 
        ref={agentContainerRef} 
        className={`w-full h-[600px] rounded-lg overflow-hidden ${isLoading || loadError ? 'hidden' : 'block'}`}
        style={{ minHeight: '600px' }}
      ></div>
    </div>
  );
} 