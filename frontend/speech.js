import { LocalState } from "./state.js";

export function startSpeechRecognition({ onTranscript, onPause }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn("[speech] SpeechRecognition not supported in this browser");
    return;
  }

  const recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let pauseTimer = null;
  let accumulatedFinal = "";

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    LocalState.subtitles = interim || final;
    onTranscript(LocalState.subtitles);

    if (final) {
      accumulatedFinal += " " + final;
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => {
        const text = accumulatedFinal.trim();
        accumulatedFinal = "";
        LocalState.subtitles = "";
        onTranscript("");
        if (text) onPause(text);
      }, 1500);
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      console.warn("[speech] Microphone permission denied");
      return;
    }
    console.warn("[speech] Error:", event.error);
  };

  // Chrome stops recognition on silence — restart automatically
  recognition.onend = () => {
    if (LocalState.isListening) {
      try {
        recognition.start();
      } catch {
        // Already starting — ignore
      }
    }
  };

  recognition.start();
  LocalState.isListening = true;
  console.log("[speech] Recognition started");
}
