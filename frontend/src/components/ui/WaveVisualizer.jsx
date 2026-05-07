import React from 'react';

export default function WaveVisualizer({ isActive = false, audioLevel = 0, barCount = 16 }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {Array.from({ length: barCount }).map((_, i) => {
        const baseHeight = 0.2 + Math.sin((i / barCount) * Math.PI) * 0.3;
        const activeHeight = isActive ? (0.3 + audioLevel * 0.7 * Math.sin((i / barCount) * Math.PI + Date.now() / 200)) : baseHeight;
        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all ${isActive ? 'gradient-primary' : 'bg-primary/30'}`}
            style={{
              height: `${Math.max(8, activeHeight * 64)}px`,
              animationDelay: `${i * 0.05}s`,
              animationName: isActive ? 'wave-bar' : 'none',
              animationDuration: '0.6s',
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
            }}
          />
        );
      })}
    </div>
  );
}
