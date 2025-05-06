'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { RefreshCw, ExternalLink, ArrowLeft, PhoneCall, PhoneOff, Mic, MicOff } from 'lucide-react';
import { useConversation } from '@11labs/react';

// This component follows the approach from ElevenLabs' Next.js quickstart guide
interface ElevenLabsReactAgentProps {
  userData: any;
  onToggleToTextChat?: () => void;
}

export function ElevenLabsReactAgent({ userData, onToggleToTextChat }: ElevenLabsReactAgentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  
  // Use the official ElevenLabs React SDK
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      setConnectionStatus('connected');
      toast({
        description: "Connected to health assistant",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setConnectionStatus('disconnected');
      toast({
        description: "Disconnected from health assistant",
      });
    },
    onMessage: (message) => {
      console.log('Message from agent:', message);
    },
    onError: (error) => {
      console.error('Error from ElevenLabs agent:', error);
      const errorMsg = typeof error === 'object' && error !== null && 'message' in error 
        ? (error as Error).message 
        : 'Failed to connect to the voice assistant';
      setErrorMessage(`Error: ${errorMsg}`);
      toast({
        variant: 'destructive',
        description: "Error connecting to health assistant",
      });
    },
    onStateChange: (state: Record<string, unknown>) => {
      // Update local state based on conversation state
      if ('isListening' in state) {
        setIsListening(!!state.isListening);
      }
      if ('isSpeaking' in state) {
        setIsSpeaking(!!state.isSpeaking);
      }
    }
  });
  
  // Handle direct link to ElevenLabs
  const handleGoToElevenLabs = () => {
    window.open(`https://elevenlabs.io/app/talk-to?agent_id=${process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID}&full=true`, '_blank');
  };
  
  // Get a signed URL for the agent
  const getSignedUrl = async (): Promise<string | null> => {
    try {
      // Call our API endpoint to get a signed URL
      const response = await fetch("/api/elevenlabs/signed-url");
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to get signed url: ${response.statusText}`);
      }
      
      const { signedUrl } = await response.json();
      return signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  };
  
  // Format user data for the agent
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
  
  // Start the conversation with the agent
  const startConversation = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get signed URL or use agent ID directly
      const signedUrl = await getSignedUrl();
      
      // Format user data
      const formattedUserData = formatUserData();
      
      // Create dynamic variables for use in system prompt
      const prepareDynamicVariables = () => {
        // Basic profile info
        const vars: Record<string, string | number | boolean> = {
          user_name: userData.profile?.full_name || 'User',
          age: userData.profile?.age || 'unknown',
          gender: userData.profile?.gender || 'unspecified',
          medical_conditions: userData.profile?.medical_conditions?.join(', ') || 'None recorded',
          allergies: userData.profile?.allergies?.join(', ') || 'None recorded',
          emergency_contact: userData.profile?.emergency_contact || 'Not specified',
          medication_count: userData.medications?.length || 0,
          appointment_count: userData.appointments?.length || 0,
        };
        
        // Process medications (up to 5)
        const medications = userData.medications || [];
        for (let i = 1; i <= 5; i++) {
          if (i <= medications.length) {
            vars[`med${i}_name`] = medications[i-1].name;
            vars[`med${i}_dosage`] = medications[i-1].dosage;
            vars[`med${i}_frequency`] = medications[i-1].frequency;
            vars[`med${i}_doctor`] = medications[i-1].prescribing_doctor || 'Not specified';
            vars[`med${i}_notes`] = medications[i-1].notes || 'None';
          } else {
            vars[`med${i}_name`] = 'none';
            vars[`med${i}_dosage`] = 'none';
            vars[`med${i}_frequency`] = 'none';
            vars[`med${i}_doctor`] = 'none';
            vars[`med${i}_notes`] = 'none';
          }
        }
        
        // Process appointments (up to 3)
        const appointments = userData.appointments || [];
        
        // Format next appointment (index 0)
        if (appointments.length > 0) {
          const nextAppt = appointments[0];
          const apptDate = nextAppt.appointment_date ? new Date(nextAppt.appointment_date) : null;
          
          vars.next_appointment_date = apptDate ? apptDate.toLocaleDateString() : 'not specified';
          vars.next_appointment_doctor = nextAppt.doctor_name || 'not specified';
          vars.next_appointment_location = nextAppt.location || 'not specified';
          vars.next_appointment_purpose = nextAppt.title || 'not specified';
        } else {
          vars.next_appointment_date = 'none scheduled';
          vars.next_appointment_doctor = 'none';
          vars.next_appointment_location = 'none';
          vars.next_appointment_purpose = 'none';
        }
        
        // Process additional appointments
        for (let i = 2; i <= 3; i++) {
          if (i <= appointments.length) {
            const appt = appointments[i-1];
            const apptDate = appt.appointment_date ? new Date(appt.appointment_date) : null;
            
            vars[`apt${i}_date`] = apptDate ? apptDate.toLocaleDateString() : 'not specified';
            vars[`apt${i}_doctor`] = appt.doctor_name || 'not specified';
            vars[`apt${i}_location`] = appt.location || 'not specified';
            vars[`apt${i}_purpose`] = appt.title || 'not specified';
          } else {
            vars[`apt${i}_date`] = 'none';
            vars[`apt${i}_doctor`] = 'none';
            vars[`apt${i}_location`] = 'none';
            vars[`apt${i}_purpose`] = 'none';
          }
        }
        
        return vars;
      };

      // Get the dynamic variables
      const dynamicVariables = prepareDynamicVariables();
      
      console.log('Starting conversation with dynamic variables:', dynamicVariables);
      
      if (signedUrl) {
        // Start with signed URL
        await conversation.startSession({
          signedUrl,
          dynamicVariables: dynamicVariables
        });
      } else {
        // Start with agent ID directly
        await conversation.startSession({
          agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
          dynamicVariables: dynamicVariables
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setErrorMessage(`Failed to start conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  }, [conversation, userData]);
  
  // End the conversation
  const stopConversation = useCallback(async () => {
    try {
      await conversation.endSession();
      toast({
        description: "Conversation ended",
      });
    } catch (error) {
      console.error('Error ending conversation:', error);
      toast({
        variant: 'destructive',
        description: "Error ending conversation",
      });
    }
  }, [conversation]);
  
  // Toggle mic mute status
  const toggleMute = useCallback(() => {
    try {
      // Since toggleMicrophone might not exist in the SDK type, use a safer approach
      console.log('Toggling microphone state');
      setIsListening(!isListening);
      // Attempt to call toggleMicrophone if it exists
      if (typeof conversation === 'object' && conversation !== null && 'toggleMicrophone' in conversation) {
        (conversation as any).toggleMicrophone();
      }
      
      toast({
        description: isListening ? "Microphone muted" : "Microphone active",
      });
    } catch (error) {
      console.error('Error toggling microphone:', error);
    }
  }, [conversation, isListening]);
  
  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-6 flex w-full justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">ElevenLabs Conversation Agent</h3>
          <p className="text-sm text-gray-500">
            Using official ElevenLabs React SDK
          </p>
        </div>
        <div className="flex gap-2">
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
              if (connectionStatus === 'connected') {
                stopConversation();
              }
              if (onToggleToTextChat) {
                onToggleToTextChat();
              }
            }}
            variant="secondary"
            size="sm"
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Text Chat
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-10 border rounded-lg w-full" style={{ minHeight: "400px" }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-500">
            Connecting to health assistant...
          </p>
        </div>
      ) : errorMessage ? (
        <div className="p-6 border rounded-lg bg-red-50 w-full">
          <p className="text-red-500 mb-4">{errorMessage}</p>
          
          <div className="flex justify-center gap-4 mb-6">
            <Button 
              onClick={startConversation}
              variant="outline"
            >
              Try Again
            </Button>
            <Button 
              onClick={handleGoToElevenLabs}
              variant="secondary"
            >
              Open in ElevenLabs
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium mb-2">Troubleshooting</h4>
            <p className="text-sm text-gray-600 mb-2">
              If you're seeing errors, try these steps:
            </p>
            <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-1">
              <li>Make sure your agent is published and active on ElevenLabs</li>
              <li>Check your API key and agent ID configuration</li>
              <li>Verify microphone permissions in your browser</li>
              <li>Try the external link to confirm the agent works directly on ElevenLabs</li>
            </ol>
          </div>
          
          <div className="mt-6 p-4 border rounded-lg bg-white">
            <h4 className="font-medium mb-2">Debug Information</h4>
            <p className="text-sm">Agent ID: {process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'Not set'}</p>
            <p className="text-sm">API Key: {process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ? 'Set' : 'Not set'}</p>
            <p className="text-sm mb-2">User Data: {userData ? 'Available' : 'Not available'}</p>
          </div>
        </div>
      ) : connectionStatus === 'connected' ? (
        <div className="p-8 border rounded-lg w-full flex flex-col items-center" style={{ minHeight: "400px" }}>
          <div className="mb-8 text-lg">
            Conversation is active
          </div>
          
          <div className="flex items-center space-x-4 mb-8">
            {/* Mute Button */}
            <Button
              className={`rounded-full w-14 h-14 ${!isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-200 hover:bg-gray-300'}`}
              onClick={toggleMute}
            >
              {!isListening ? (
                <MicOff className="h-6 w-6 text-white" />
              ) : (
                <Mic className="h-6 w-6 text-gray-700" />
              )}
            </Button>
            
            {/* End Call Button */}
            <Button
              className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
              onClick={stopConversation}
            >
              <PhoneOff className="h-8 w-8 text-white" />
            </Button>
          </div>
          
          <div className="text-sm text-gray-500">
            {isSpeaking ? "Agent is speaking..." : isListening ? "Listening for your voice..." : "Microphone is muted"}
          </div>
          
          <div className="mt-8 p-4 border rounded-lg bg-blue-50 w-full max-w-md">
            <h4 className="font-medium mb-2">About This Integration</h4>
            <p className="text-sm text-gray-600">
              This component implements the ElevenLabs voice agent using their official React SDK following 
              <a href="https://elevenlabs.io/docs/conversational-ai/guides/quickstarts/next-js" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="text-blue-500 hover:underline mx-1">
                ElevenLabs' Next.js integration guide
              </a>.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              The agent has access to your health information including:
            </p>
            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mt-1">
              <li>Profile information</li>
              <li>Medications ({userData?.medications?.length || 0})</li>
              <li>Appointments ({userData?.appointments?.length || 0})</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="p-8 border rounded-lg w-full flex flex-col items-center" style={{ minHeight: "400px" }}>
          <div className="mb-8 text-lg">
            Start a conversation with your Health Assistant
          </div>
          
          <Button
            onClick={startConversation}
            className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
          >
            <PhoneCall className="h-8 w-8 text-white" />
          </Button>
          
          <div className="mt-8 text-sm text-gray-500">
            Click the button above to begin talking with your health assistant
          </div>
          
          <div className="mt-8 p-4 border rounded-lg bg-blue-50 w-full max-w-md">
            <h4 className="font-medium mb-2">About This Agent</h4>
            <p className="text-sm text-gray-600">
              This voice agent connects to ElevenLabs using their official React SDK. The agent has access to your health data and can provide personalized responses based on your:
            </p>
            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mt-2">
              <li>Medical profile</li>
              <li>Current medications</li>
              <li>Upcoming appointments</li>
            </ul>
            <p className="text-sm text-gray-600 mt-2">
              You can speak naturally to the agent and ask health-related questions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 