import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { useSpeechRecognition, textToSpeech, playAudio } from '@/lib/elevenlabs';
import { toast } from '@/components/ui/use-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import { usePipeline } from '@/lib/hooks/use-pipeline';

interface CallComponentProps {
  userData: any;
}

export function CallComponent({ userData }: CallComponentProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callTranscript, setCallTranscript] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState('21m00Tcm4TlvDq8ikWAM'); // Rachel voice
  const [callLoading, setCallLoading] = useState(false);
  const supabase = createClientComponentClient<Database>();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // For generating embeddings
  const generateEmbedding = usePipeline(
    'feature-extraction',
    'Supabase/gte-small'
  );
  
  const { 
    transcript, 
    isListening, 
    startListening, 
    stopListening,
    hasRecognitionSupport 
  } = useSpeechRecognition();

  // Auto-listening management during active call
  useEffect(() => {
    if (isInCall && !isProcessing && !isSpeaking && !isListening && !isMuted) {
      // Small delay before starting to listen again to avoid immediate re-triggering
      const timer = setTimeout(() => {
        startListening();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isInCall, isProcessing, isSpeaking, isListening, isMuted, startListening]);
  
  // Handle user speech ending and process it
  useEffect(() => {
    if (isInCall && !isListening && transcript.trim()) {
      processUserInput(transcript);
    }
  }, [isListening, transcript, isInCall]);
  
  // Process user input and get AI response
  const processUserInput = async (text: string) => {
    try {
      if (!text.trim() || isProcessing) return;
      
      setIsProcessing(true);
      
      // Add user message to transcript
      setCallTranscript(prev => [...prev, { role: 'user', content: text }]);
      
      if (!generateEmbedding) {
        throw new Error('Unable to generate embeddings');
      }

      // Generate embedding for semantic search
      const output = await generateEmbedding(text, {
        pooling: 'mean',
        normalize: true,
      });

      const embedding = JSON.stringify(Array.from(output.data));

      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: 'destructive',
          description: 'You must be logged in to use the voice call feature.',
        });
        return;
      }
      
      // If a previous request is in progress, abort it
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController();
      
      // Log what we're sending to debug
      console.log('Sending userData to API:', {
        userDataEmpty: !userData || Object.keys(userData).length === 0,
        userDataKeys: userData ? Object.keys(userData) : [],
        messageCount: callTranscript.length,
        hasEmbedding: !!embedding
      });
      
      // Make API call to get the response
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          // Only send the current user message for the embedding search
          // but include all previous messages for conversation context
          message: text,
          messages: callTranscript.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          embedding,
          userData // Make sure we're sending the userData
        }),
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }
      
      // Handle the response as text
      let assistantResponse = '';
      let responseText = '';
      
      try {
        // First try to get the response as text to debug
        responseText = await response.text();
        console.log('API response text:', responseText.substring(0, 200) + '...');
        
        // Try to parse the response
        try {
          // If it's a JSON response
          const responseData = JSON.parse(responseText);
          console.log('Parsed response data:', responseData);
          
          if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
            assistantResponse = responseData.choices[0].message.content;
          } else {
            // Fallback to accessing other potential properties
            assistantResponse = responseData.text || responseData.content || responseData.message || 
                               "I'm sorry, I couldn't retrieve your health information at this moment.";
          }
        } catch (parseError) {
          // If not valid JSON, it might be SSE format
          console.log('Not a valid JSON response, trying to parse as streaming text');
          
          if (responseText.includes('data:')) {
            // Try to parse as SSE
            assistantResponse = responseText
              .split('\n')
              .filter(line => line.startsWith('data:') && !line.includes('[DONE]'))
              .map(line => {
                try {
                  const content = line.substring(5).trim();
                  // Skip [DONE] messages
                  if (content === '[DONE]') return '';
                  
                  // Try to parse as JSON
                  const jsonData = JSON.parse(content);
                  return jsonData.choices?.[0]?.delta?.content || 
                         jsonData.choices?.[0]?.message?.content || '';
                } catch (e) {
                  // If not valid JSON, return the content as is
                  return line.substring(5).trim();
                }
              })
              .join('');
          } else {
            // If not SSE format, use the response text directly
            assistantResponse = responseText;
          }
        }
      } catch (error) {
        console.error('Error processing response:', error);
        assistantResponse = "I'm sorry, there was an issue processing your health information. Please try asking in a different way.";
      }
      
      // Update call transcript with assistant's response
      setCallTranscript(prev => [...prev, { role: 'assistant', content: assistantResponse }]);
      
      // Speak the response
      await speakResponse(assistantResponse);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error processing voice input:', error);
        toast({
          variant: 'destructive',
          description: 'There was an error processing your request. Please try again.',
        });
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };
  
  // Handle call initiation
  const startCall = () => {
    if (!hasRecognitionSupport) {
      toast({
        variant: 'destructive',
        description: 'Speech recognition is not supported in your browser. Please try using Chrome.',
      });
      return;
    }
    
    // Log user data to verify it's available
    console.log('Starting call with user data:', {
      hasUserData: !!userData,
      profile: userData?.profile || {},
      medications: (userData?.medications || []).length,
      appointments: (userData?.appointments || []).length
    });
    
    setCallLoading(true);
    
    // Simulating connection time
    setTimeout(() => {
      setIsInCall(true);
      
      // Reset call transcript
      setCallTranscript([]);
      setCallLoading(false);
      
      // Initial greeting from assistant
      const greeting = "Hello! I'm your health assistant. How can I help you today?";
      setCallTranscript([{ role: 'assistant', content: greeting }]);
      
      // Speak the greeting
      speakResponse(greeting);
    }, 1500);
  };
  
  // Handle ending the call
  const endCall = () => {
    if (isListening) {
      stopListening();
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsInCall(false);
    setIsSpeaking(false);
    setIsProcessing(false);
  };
  
  // Toggle mute/unmute
  const toggleMute = () => {
    if (isListening && !isMuted) {
      stopListening();
    } else if (!isListening && isMuted) {
      startListening();
    }
    setIsMuted(!isMuted);
  };
  
  // Convert text to speech and play it
  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);
      
      if (!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
        toast({
          variant: 'destructive',
          description: 'Voice synthesis is not configured. Please check your settings.',
        });
        return;
      }
      
      // Break the response into smaller chunks if it's too long
      // ElevenLabs works better with shorter text segments
      const maxChunkLength = 300;
      const chunks = [];
      
      // Simple chunking by sentence
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkLength) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // Process each chunk sequentially
      for (const chunk of chunks) {
        if (chunk.trim()) {
          const audioBuffer = await textToSpeech({
            text: chunk,
            voiceId: selectedVoiceId,
          });
          
          await playAudio(audioBuffer);
        }
      }
    } catch (error) {
      console.error('Error generating speech:', error);
      toast({
        variant: 'destructive',
        description: 'Could not generate voice response. Please try again.',
      });
    } finally {
      setIsSpeaking(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Main Call Button */}
      {!isInCall ? (
        <Button
          className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
          onClick={startCall}
          disabled={callLoading}
        >
          <Phone className="h-8 w-8 text-white" />
        </Button>
      ) : (
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-4">
            {/* Mute Button */}
            <Button
              className={`rounded-full w-14 h-14 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-300 hover:bg-gray-400'}`}
              onClick={toggleMute}
              disabled={!isInCall || isProcessing}
            >
              {isMuted ? (
                <MicOff className="h-6 w-6 text-white" />
              ) : (
                <Mic className="h-6 w-6 text-gray-700" />
              )}
            </Button>
            
            {/* End Call Button */}
            <Button
              className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
              onClick={endCall}
            >
              <PhoneOff className="h-8 w-8 text-white" />
            </Button>
          </div>
          
          {/* Call Status */}
          <div className="text-sm text-gray-500">
            {isProcessing ? (
              'Processing...'
            ) : isSpeaking ? (
              'Health Assistant is speaking...'
            ) : isListening ? (
              'Listening...'
            ) : isMuted ? (
              'Microphone is muted'
            ) : (
              'Connected'
            )}
          </div>
        </div>
      )}
      
      {/* Call Transcript (optional, can be hidden for a cleaner UI) */}
      {isInCall && callTranscript.length > 0 && (
        <div className="mt-4 w-full max-w-md p-4 border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Call Transcript</h3>
          {callTranscript.map((message, index) => (
            <div key={index} className="mb-2">
              <span className="font-bold">
                {message.role === 'user' ? 'You: ' : 'Assistant: '}
              </span>
              <span>{message.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 