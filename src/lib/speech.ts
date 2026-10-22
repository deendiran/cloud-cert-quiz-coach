/**
 * Speech helpers built on window.speechSynthesis.
 * Used by the quiz reader, notes reader and settings page.
 */

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export const isSpeechSupported = speechSupported;

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Speak a list of text parts one after another. */
export function speakSequence(
  parts: string[],
  opts: { rate?: number; lang?: string; onEnd?: () => void; onError?: () => void } = {}
) {
  if (!speechSupported()) {
    opts.onError?.();
    opts.onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  let remaining = parts.length;
  if (remaining === 0) {
    opts.onEnd?.();
    return;
  }
  parts.forEach((text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts.rate ?? 1;
    if (opts.lang) utterance.lang = opts.lang;
    const done = () => {
      remaining -= 1;
      if (remaining === 0) opts.onEnd?.();
    };
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  });
}
