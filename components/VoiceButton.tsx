import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Volume2 } from 'lucide-react';
import { useSpeechRecognition, textToSpeech, playAudio } from '@/lib/elevenlabs';
import { toast } from '@/components/ui/use-toast';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  onResponse: (response: string) => void;
  isProcessing: boolean;
  disabled?: boolean;
}

export function VoiceButton({ 
  onTranscript, 
  onResponse, 
  isProcessing,
  disabled = false
}: VoiceButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState('21m00Tcm4TlvDq8ikWAM'); // Rachel voice
  const [isBrowser, setIsBrowser] = useState(false);
  
  // Check if we're in a browser environment on component mount
  useEffect(() => {
    setIsBrowser(true);
  }, []);
  
  const { 
    transcript, 
    isListening, 
    startListening, 
    stopListening,
    hasRecognitionSupport 
  } = useSpeechRecognition();

  // Effect to monitor transcript changes and send it when speech recognition stops
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      onTranscript(transcript);
    }
  }, [isListening, transcript, onTranscript]);

  // Handle voice button click
  const handleVoiceButtonClick = async () => {
    try {
      if (isListening) {
        stopListening();
      } else {
        if (!hasRecognitionSupport) {
          toast({
            variant: 'destructive',
            description: 'Speech recognition is not supported in this browser.',
          });
          return;
        }
        
        startListening();
      }
    } catch (error) {
      console.error('Voice recognition error:', error);
      toast({
        variant: 'destructive',
        description: 'Error with voice recognition. Please try again.',
      });
    }
  };

  // Play the response as audio
  const speakResponse = async (text: string) => {
    try {
      if (!isBrowser) return;
      
      setIsPlaying(true);
      
      // Check for API key
      if (!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
        toast({
          variant: 'destructive',
          description: 'ElevenLabs API key is not configured. Audio response is unavailable.',
        });
        return;
      }
      
      // Convert the text to speech
      const audioBuffer = await textToSpeech({
        text,
        voiceId: selectedVoiceId,
      });
      
      // Play the audio
      await playAudio(audioBuffer);
      
      // Notify the parent component
      onResponse(text);
    } catch (error) {
      console.error('Text-to-speech error:', error);
      toast({
        variant: 'destructive',
        description: 'Error generating voice response. Please try again.',
      });
    } finally {
      setIsPlaying(false);
    }
  };

  // If we're not in the browser yet, render a placeholder to avoid hydration issues
  if (!isBrowser) {
    return (
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={true}
          className="rounded-full"
        >
          <Mic className="h-5 w-5" />
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={true}
          className="rounded-full"
        >
          <Volume2 className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size="icon"
        onClick={handleVoiceButtonClick}
        disabled={isProcessing || isPlaying || disabled}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
        className="rounded-full"
      >
        {isListening ? (
          <Square className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
      
      {/* Only show speak button if there's a response to speak */}
      {onResponse && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            // Get the last message (which should be the bot response)
            const lastBotMessage = document.querySelector('[data-bot-message="true"]:last-child');
            if (lastBotMessage) {
              speakResponse(lastBotMessage.textContent || '');
            } else {
              toast({
                description: 'No response to speak.',
              });
            }
          }}
          disabled={isListening || isProcessing || isPlaying || disabled}
          aria-label="Speak last response"
          className="rounded-full"
        >
          <Volume2 className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
} 