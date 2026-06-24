"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Lock,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Volume2,
  Waves,
} from "lucide-react";
import { SoundFieldCanvas } from "@/components/SoundFieldCanvas";

type Pattern = "steady" | "sweep" | "pulse" | "scatter";

type DeviceInfo = {
  sampleRate: number;
  maxFrequency: number;
  effectiveFrequency: number;
};

type UltrasonicEmitterProps = {
  enabled: boolean;
};

const minFrequency = 18_000;
const requestedMaxFrequency = 48_000;

const patterns: Array<{ id: Pattern; label: string }> = [
  { id: "sweep", label: "Barrido" },
  { id: "pulse", label: "Pulso" },
  { id: "scatter", label: "Cambio" },
  { id: "steady", label: "Fijo" },
];

function getAudioContextClass() {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function formatKhz(value: number) {
  return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} kHz`;
}

export function UltrasonicEmitter({ enabled }: UltrasonicEmitterProps) {
  const [frequency, setFrequency] = useState(21_500);
  const [intensity, setIntensity] = useState(2);
  const [pattern, setPattern] = useState<Pattern>("sweep");
  const [running, setRunning] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);

  const targetGain = useMemo(() => Math.min(0.08, 0.012 + intensity * 0.011), [intensity]);
  const limited = Boolean(deviceInfo && frequency > deviceInfo.maxFrequency);

  const clearPatternTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getSafeFrequency = useCallback((requested: number, maxFrequency: number) => {
    return Math.max(minFrequency, Math.min(requested, maxFrequency));
  }, []);

  const applyPattern = useCallback(
    (context: AudioContext, oscillator: OscillatorNode, gain: GainNode, maxFrequency: number) => {
      clearPatternTimer();

      const now = context.currentTime;
      const safeFrequency = getSafeFrequency(frequency, maxFrequency);
      oscillator.frequency.cancelScheduledValues(now);
      oscillator.frequency.setTargetAtTime(safeFrequency, now, 0.03);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(targetGain, now, 0.04);

      if (pattern === "steady") {
        return;
      }

      if (pattern === "pulse") {
        let high = true;
        intervalRef.current = window.setInterval(() => {
          high = !high;
          const nextGain = high ? targetGain : targetGain * 0.08;
          gain.gain.setTargetAtTime(nextGain, context.currentTime, 0.035);
        }, 420);
        return;
      }

      if (pattern === "scatter") {
        const band = [
          minFrequency,
          getSafeFrequency(19_800, maxFrequency),
          getSafeFrequency(22_400, maxFrequency),
          getSafeFrequency(26_000, maxFrequency),
          getSafeFrequency(frequency, maxFrequency),
        ];
        let index = 0;
        intervalRef.current = window.setInterval(() => {
          index = (index + 1) % band.length;
          oscillator.frequency.setTargetAtTime(band[index], context.currentTime, 0.045);
        }, 260);
        return;
      }

      let direction = 1;
      let sweepFrequency = minFrequency;
      intervalRef.current = window.setInterval(() => {
        sweepFrequency += direction * 650;

        if (sweepFrequency >= safeFrequency) {
          sweepFrequency = safeFrequency;
          direction = -1;
        }

        if (sweepFrequency <= minFrequency) {
          sweepFrequency = minFrequency;
          direction = 1;
        }

        oscillator.frequency.setTargetAtTime(sweepFrequency, context.currentTime, 0.04);
      }, 180);
    },
    [clearPatternTimer, frequency, getSafeFrequency, pattern, targetGain],
  );

  const stop = useCallback(() => {
    clearPatternTimer();

    const context = contextRef.current;
    const gain = gainRef.current;
    const oscillator = oscillatorRef.current;

    if (context && gain) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setTargetAtTime(0, context.currentTime, 0.04);
    }

    if (oscillator) {
      window.setTimeout(() => {
        try {
          oscillator.stop();
        } catch {
          // Oscillator may already be stopped by the browser.
        }
      }, 80);
    }

    if (context) {
      window.setTimeout(() => {
        void context.close().catch(() => undefined);
      }, 140);
    }

    contextRef.current = null;
    oscillatorRef.current = null;
    gainRef.current = null;
    setRunning(false);
  }, [clearPatternTimer]);

  const start = useCallback(async () => {
    if (!enabled) {
      setMessage("Activa la suscripción para desbloquear el emisor.");
      return;
    }

    const AudioContextClass = getAudioContextClass();

    if (!AudioContextClass) {
      setMessage("Este navegador no ofrece Web Audio API.");
      return;
    }

    setMessage(null);
    const context = new AudioContextClass();
    await context.resume();

    const maxFrequency = Math.floor(Math.min(requestedMaxFrequency, context.sampleRate / 2 - 160));

    if (maxFrequency < minFrequency) {
      await context.close();
      setMessage("El dispositivo no expone rango ultrasónico suficiente.");
      return;
    }

    const effectiveFrequency = getSafeFrequency(frequency, maxFrequency);
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = effectiveFrequency;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();

    contextRef.current = context;
    oscillatorRef.current = oscillator;
    gainRef.current = gain;
    setDeviceInfo({
      sampleRate: context.sampleRate,
      maxFrequency,
      effectiveFrequency,
    });
    setRunning(true);
    applyPattern(context, oscillator, gain, maxFrequency);
  }, [applyPattern, enabled, frequency, getSafeFrequency]);

  useEffect(() => {
    if (!running || !contextRef.current || !oscillatorRef.current || !gainRef.current || !deviceInfo) {
      return;
    }

    const effectiveFrequency = getSafeFrequency(frequency, deviceInfo.maxFrequency);
    setDeviceInfo((current) => (current ? { ...current, effectiveFrequency } : current));
    applyPattern(contextRef.current, oscillatorRef.current, gainRef.current, deviceInfo.maxFrequency);
  }, [applyPattern, deviceInfo, frequency, getSafeFrequency, running]);

  useEffect(() => stop, [stop]);

  return (
    <section className="panel emitter-panel" aria-labelledby="emitter-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Emisor</p>
          <h2 id="emitter-title">18-48 kHz</h2>
        </div>
        {enabled ? <Waves aria-hidden="true" /> : <Lock aria-hidden="true" />}
      </div>

      <SoundFieldCanvas
        frequency={deviceInfo?.effectiveFrequency ?? frequency}
        intensity={intensity}
        limited={limited}
        running={running}
      />

      <div className="metrics-grid" aria-label="Estado del emisor">
        <div>
          <Gauge aria-hidden="true" />
          <span>{formatKhz(frequency)}</span>
          <small>solicitado</small>
        </div>
        <div>
          <Activity aria-hidden="true" />
          <span>{formatKhz(deviceInfo?.effectiveFrequency ?? frequency)}</span>
          <small>salida</small>
        </div>
        <div>
          <Volume2 aria-hidden="true" />
          <span>{intensity}/5</span>
          <small>nivel</small>
        </div>
      </div>

      <div className="control-grid">
        <label className="range-control">
          Frecuencia
          <input
            disabled={!enabled}
            max={requestedMaxFrequency}
            min={minFrequency}
            onChange={(event) => setFrequency(Number(event.target.value))}
            step={250}
            type="range"
            value={frequency}
          />
        </label>

        <label className="range-control">
          Intensidad
          <input
            disabled={!enabled}
            max={5}
            min={1}
            onChange={(event) => setIntensity(Number(event.target.value))}
            step={1}
            type="range"
            value={intensity}
          />
        </label>
      </div>

      <div className="toolbar" aria-label="Patrón de frecuencia">
        <SlidersHorizontal aria-hidden="true" />
        <div className="segmented compact">
          {patterns.map((item) => (
            <button
              className={pattern === item.id ? "selected" : ""}
              disabled={!enabled}
              key={item.id}
              onClick={() => setPattern(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="action-row">
        <button
          className={running ? "danger-button" : "primary-button"}
          disabled={!enabled}
          onClick={running ? stop : start}
          type="button"
        >
          {running ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
          {running ? "Detener" : "Activar"}
        </button>
        <span className={enabled ? "status-pill active" : "status-pill locked"}>
          {enabled ? <ShieldCheck aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {enabled ? "Desbloqueado" : "Bloqueado"}
        </span>
      </div>

      <div className="notice safety">
        <AlertTriangle aria-hidden="true" />
        <span>
          18-20 kHz puede ser audible. Mascotas y altavoces sensibles pueden reaccionar; detén la emisión ante molestias.
        </span>
      </div>

      {deviceInfo ? (
        <p className="device-note">
          Dispositivo: {Math.round(deviceInfo.sampleRate / 1000)} kHz de muestreo, máximo real{" "}
          {formatKhz(deviceInfo.maxFrequency)}.
        </p>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
