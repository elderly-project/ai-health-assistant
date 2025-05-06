import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key is not configured' },
        { status: 500 }
      );
    }
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'ElevenLabs Agent ID is not configured' },
        { status: 500 }
      );
    }
    
    console.log(`Fetching signed URL for agent ID: ${agentId}`);
    
    // Call ElevenLabs API to get a signed URL
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      }
    );
    
    if (!response.ok) {
      let errorData;
      try {
        // Try to parse error as JSON
        errorData = await response.json();
      } catch (e) {
        // If not JSON, get as text
        errorData = await response.text();
      }
      
      console.error('Error from ElevenLabs API:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      // For 404 errors, provide a more specific message
      if (response.status === 404) {
        return NextResponse.json(
          { 
            error: 'Agent not found. Please check if your agent ID is correct and the agent is published.',
            details: errorData
          },
          { status: 404 }
        );
      }
      
      // For other errors
      return NextResponse.json(
        { 
          error: `Failed to get signed URL: ${response.statusText}`,
          details: errorData
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    if (!data.signed_url) {
      console.error('No signed URL returned:', data);
      return NextResponse.json(
        { error: 'No signed URL was returned from ElevenLabs API', details: data },
        { status: 500 }
      );
    }
    
    console.log('Successfully retrieved signed URL');
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate signed URL',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 