import { useState, useEffect } from 'react';

// Define SpeechRecognition interfaces for TypeScript
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionError extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onerror: ((event: SpeechRecognitionError) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

// ElevenLabs API URLs
const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const VOICES_URL = 'https://api.elevenlabs.io/v1/voices';

// You should store this in an environment variable for production
// For now, we'll need to add it to our .env.local file
const getApiKey = () => {
  return process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
};

// Interface for text-to-speech params
interface TTSParams {
  text: string;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: {
    stability: number;
    similarity_boost: number;
  };
}

/**
 * Convert text to speech using ElevenLabs API
 */
export const textToSpeech = async ({ 
  text, 
  voiceId = '21m00Tcm4TlvDq8ikWAM', // Default voice - Rachel
  modelId = 'eleven_monolingual_v1',
  voiceSettings = { stability: 0.5, similarity_boost: 0.75 }
}: TTSParams): Promise<ArrayBuffer> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error('ElevenLabs API key is not defined');
  }

  const response = await fetch(`${TTS_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`ElevenLabs API Error: ${response.status} ${JSON.stringify(errorData)}`);
  }

  return await response.arrayBuffer();
};

/**
 * Fetch available voices from ElevenLabs
 */
export const getVoices = async () => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error('ElevenLabs API key is not defined');
  }

  const response = await fetch(VOICES_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices;
};

/**
 * React hook for speech recognition
 */
export const useSpeechRecognition = () => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    // Initialize speech recognition
    const SpeechRecognitionConstructor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognitionInstance = new SpeechRecognitionConstructor() as SpeechRecognition;
    
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      let currentTranscript = '';
      
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      
      setTranscript(currentTranscript);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    recognitionInstance.onerror = (event: SpeechRecognitionError) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    setRecognition(recognitionInstance);

    // Cleanup
    return () => {
      if (recognitionInstance) {
        recognitionInstance.abort();
      }
    };
  }, []);

  const startListening = () => {
    if (recognition) {
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
    }
  };

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    hasRecognitionSupport: !!recognition,
  };
};

/**
 * Play audio from an array buffer
 */
export const playAudio = (audioBuffer: ArrayBuffer): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Audio playback is only available in browser environments'));
      return;
    }
    
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      reject(new Error('AudioContext not supported in this browser'));
      return;
    }
    
    const audioContext = new AudioContext();
    
    audioContext.decodeAudioData(
      audioBuffer,
      (buffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        
        source.onended = () => {
          resolve();
        };
        
        source.start(0);
      },
      (error) => {
        reject(error);
      }
    );
  });
}; 