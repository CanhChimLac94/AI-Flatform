"use client";

// US01 AC3: Hold microphone button → voice-to-text via Web Speech API
// Shows audio-wave animation while recording.

import { useCallback, useEffect, useRef, useState } from "react";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/24/solid";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "vi-VN,en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return (
    <button
      type="button"
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      disabled={disabled}
      className={`p-2 rounded-lg transition-all ${
        recording
          ? "bg-red-600 text-white animate-pulse scale-110"
          : "text-gray-400 hover:text-white hover:bg-gray-700"
      } disabled:opacity-40`}
      title={recording ? "Release to stop" : "Hold to speak"}
    >
      {recording ? (
        <StopIcon className="w-5 h-5" />
      ) : (
        <MicrophoneIcon className="w-5 h-5" />
      )}
    </button>
  );
}
