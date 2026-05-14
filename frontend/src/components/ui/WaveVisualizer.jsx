import { useEffect, useRef } from 'react';

export default function WaveVisualizer({ isActive = false, audioLevelRef, barCount = 16 }) {
  const barsRef = useRef([]);
  const rafRef  = useRef(null);

  useEffect(() => {
    if (!isActive) {
      cancelAnimationFrame(rafRef.current);
      // reset bars to idle height
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const base = 0.2 + Math.sin((i / barCount) * Math.PI) * 0.3;
        bar.style.height = `${Math.max(8, base * 64)}px`;
        bar.className = 'w-1 rounded-full bg-primary/30';
      });
      return;
    }

    const animate = (t) => {
      const level = audioLevelRef?.current ?? 0;
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const h = 0.3 + level * 0.7 * Math.sin((i / barCount) * Math.PI + t / 200);
        bar.style.height = `${Math.max(8, h * 64)}px`;
        bar.className = 'w-1 rounded-full gradient-primary';
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, audioLevelRef, barCount]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          ref={el => { barsRef.current[i] = el; }}
          className="w-1 rounded-full bg-primary/30"
          style={{ height: '8px' }}
        />
      ))}
    </div>
  );
}
