import { createContext, useContext, useCallback } from 'react';
import confetti from 'canvas-confetti';

const FeedbackContext = createContext({
  triggerConfetti: () => {},
  playSound: () => {},
});

export const FeedbackProvider = ({ children }) => {
  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  const playSound = useCallback((type) => {
    // Use a public CDN sound as fallback — replace with local assets in production
    const urls = {
      confirm: 'https://cdn.freesound.org/previews/341/341695_5858296-lq.mp3',
      success: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
    };
    try {
      const audio = new Audio(urls[type] || urls.confirm);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // Audio playback not available — silent fallback
    }
  }, []);

  return (
    <FeedbackContext.Provider value={{ triggerConfetti, playSound }}>
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => useContext(FeedbackContext);
