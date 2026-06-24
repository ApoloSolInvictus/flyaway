"use client";

import { useEffect, useRef } from "react";

type SoundFieldCanvasProps = {
  running: boolean;
  frequency: number;
  intensity: number;
  limited: boolean;
};

export function SoundFieldCanvas({ running, frequency, intensity, limited }: SoundFieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    let frame = 0;
    let animationFrame = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * scale));
      const height = Math.max(1, Math.floor(rect.height * scale));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = "#202020";
      context.fillRect(0, 0, width, height);

      const centerY = height * 0.5;
      const baseAmplitude = (height * 0.08 + intensity * height * 0.015) * (running ? 1 : 0.3);
      const waveCount = limited ? 5 : 7;

      for (let wave = 0; wave < waveCount; wave += 1) {
        const progress = wave / Math.max(1, waveCount - 1);
        const offset = frame * (running ? 0.012 : 0.003) + progress * Math.PI;
        const hueColor = wave % 3 === 0 ? "#1F9D8A" : wave % 3 === 1 ? "#D19B2B" : "#F6F3EA";
        context.strokeStyle = hueColor;
        context.globalAlpha = 0.25 + progress * 0.45;
        context.lineWidth = Math.max(1, 2.5 * scale);
        context.beginPath();

        for (let x = 0; x <= width; x += 4 * scale) {
          const normalized = x / width;
          const pulse = Math.sin(normalized * Math.PI * (4 + frequency / 9000) + offset);
          const envelope = Math.sin(normalized * Math.PI);
          const y = centerY + pulse * baseAmplitude * envelope * (0.55 + progress);

          if (x === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.stroke();
      }

      context.globalAlpha = 1;
      context.fillStyle = running ? "#1F9D8A" : "#77736A";
      context.beginPath();
      context.arc(width * 0.5, centerY, (8 + intensity * 1.5) * scale, 0, Math.PI * 2);
      context.fill();

      frame += 1;
      animationFrame = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrame);
  }, [frequency, intensity, limited, running]);

  return <canvas ref={canvasRef} className="sound-canvas" aria-label="Campo de frecuencia FlyAway" />;
}
