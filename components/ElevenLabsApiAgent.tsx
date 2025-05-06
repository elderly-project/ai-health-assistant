import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { RefreshCw, ExternalLink, ArrowLeft } from 'lucide-react';

// This will be a placeholder for now as we integrate the ElevenLabs API
interface ElevenLabsApiAgentProps {
  userData: any;
  onToggleToTextChat?: () => void;
}

export function ElevenLabsApiAgent({ userData, onToggleToTextChat }: ElevenLabsApiAgentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const initializeAgent = async () => {
      try {
        // This is a placeholder for actual API integration
        // In a real implementation, we would use the elevenlabs library here
        
        setIsLoading(false);
        
        // For development purposes, we'll simulate initialization
        setTimeout(() => {
          setError('Direct API integration is still in development. Please use the iframe or direct ElevenLabs link.');
          setIsLoading(false);
        }, 1500);
      } catch (err) {
        console.error('Error initializing ElevenLabs API:', err);
        setError('Failed to initialize the ElevenLabs API agent.');
        setIsLoading(false);
      }
    };
    
    initializeAgent();
  }, []);
  
  // Handle opening in ElevenLabs
  const handleGoToElevenLabs = () => {
    window.open(`https://elevenlabs.io/app/talk-to?agent_id=${process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID}&full=true`, '_blank');
  };
  
  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-4 flex w-full justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">ElevenLabs API Agent</h3>
          <p className="text-sm text-gray-500">Direct API Integration (Development)</p>
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
          <p className="text-gray-500">Initializing API integration...</p>
        </div>
      ) : error ? (
        <div className="p-6 border rounded-lg bg-red-50 w-full">
          <p className="text-red-500 mb-4">{error}</p>
          <p className="text-gray-600 mb-4">
            The direct API integration is still under development. In the meantime, you can use one of these options:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 border rounded-lg bg-white">
              <h4 className="font-medium mb-2">Use Iframe Embed</h4>
              <p className="text-sm text-gray-500 mb-4">
                This embeds the ElevenLabs voice assistant directly from their website.
              </p>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                Try Iframe Embed
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg bg-white">
              <h4 className="font-medium mb-2">Open on ElevenLabs</h4>
              <p className="text-sm text-gray-500 mb-4">
                Use the agent directly on the ElevenLabs website.
              </p>
              <Button 
                onClick={handleGoToElevenLabs}
                variant="outline"
                className="w-full"
              >
                Open in ElevenLabs
              </Button>
            </div>
          </div>
          
          <div className="mt-6 p-4 border rounded-lg bg-blue-50">
            <h4 className="font-medium mb-2">Debug Information</h4>
            <p className="text-sm">Agent ID: {process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'Not set'}</p>
            <p className="text-sm">API Key: {process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ? 'Set' : 'Not set'}</p>
            <p className="text-sm mb-2">User Data: {userData ? 'Available' : 'Not available'}</p>
            <p className="text-sm">
              <a 
                href="https://elevenlabs.io/docs/api-reference/introduction" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                ElevenLabs API Documentation
              </a>
            </p>
          </div>
        </div>
      ) : (
        <div className="p-6 border rounded-lg w-full" style={{ minHeight: "400px" }}>
          <p className="text-center text-gray-500">Agent interface would appear here</p>
        </div>
      )}
    </div>
  );
} 