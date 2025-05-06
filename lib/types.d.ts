// Type definitions for Web Speech API and AudioContext
interface Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
  AudioContext: typeof AudioContext;
  webkitAudioContext: typeof AudioContext;
} 