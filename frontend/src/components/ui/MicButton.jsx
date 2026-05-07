import React from 'react';
import { Mic, Square } from 'lucide-react';

export default function MicButton({ isRecording, onClick, size = 80 }) {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-full flex items-center justify-center transition-all
        ${isRecording
          ? 'bg-destructive text-destructive-foreground animate-mic-pulse'
          : 'gradient-primary text-primary-foreground animate-mic-idle hover:scale-105'
        }
      `}
      style={{ width: size, height: size }}
    >
      {isRecording ? (
        <Square className="w-6 h-6" fill="currentColor" />
      ) : (
        <Mic className="w-8 h-8" />
      )}
    </button>
  );
}
