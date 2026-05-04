import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTauriEvents } from "../hooks/useTauriEvents";

type OverlayState = "idle" | "recording" | "transcribing" | "error";

// Each bar has a base weight that shapes the waveform pattern (taller in center)
const BAR_WEIGHTS = [0.35, 0.65, 1.0, 0.65, 0.35];
const MIN_HEIGHT = 3;
const MAX_HEIGHT = 16;

export function Overlay() {
  const [state, setState] = useState<OverlayState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [partialText, setPartialText] = useState("");
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [realtimeArmed, setRealtimeArmed] = useState(false);
  const [autoPaste, setAutoPaste] = useState(false);
  const [targetCaptured, setTargetCaptured] = useState(false);
  const [realtimeChanging, setRealtimeChanging] = useState(false);
  const [barHeights, setBarHeights] = useState<number[] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const smoothedLevel = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useTauriEvents((event) => {
    if (event.type === "recording-started") {
      setState("recording");
      setElapsed(0);
      setPartialText("");
      setRealtimeActive(event.realtime);
      setRealtimeArmed(event.realtime);
      setAutoPaste(event.autoPaste);
      setTargetCaptured(event.targetCaptured);
    } else if (event.type === "recording-stopped") {
      setState(event.finalizing ? "transcribing" : "idle");
      setBarHeights(null);
      if (!event.finalizing) {
        setPartialText("");
        setRealtimeActive(false);
      }
    } else if (event.type === "realtime-transcription") {
      setPartialText(event.fullText);
    } else if (event.type === "realtime-mode-updated") {
      setRealtimeArmed(event.armed);
      setRealtimeActive(event.active);
      setRealtimeChanging(false);
      if (!event.active) {
        setPartialText("");
      }
    } else if (event.type === "transcription-complete") {
      setState("idle");
      setPartialText("");
      setRealtimeActive(false);
    } else if (event.type === "transcription-error") {
      setErrorMsg(event.message);
      setRealtimeActive(false);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  });

  useEffect(() => {
    void invoke<{ realtime_transcription: boolean }>("get_settings")
      .then((settings) => setRealtimeArmed(settings.realtime_transcription))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const toggleRealtimeMode = async () => {
    const nextMode = !realtimeArmed;
    setRealtimeChanging(true);
    setRealtimeArmed(nextMode);
    try {
      await invoke("set_realtime_transcription", { enabled: nextMode });
    } catch (error) {
      setRealtimeArmed(!nextMode);
      setRealtimeChanging(false);
      setErrorMsg(String(error));
      setState("error");
      setTimeout(() => setState("recording"), 3000);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    listen<{ level: number }>("audio-level", (e) => {
      if (cancelled) return;
      const raw = e.payload.level;
      smoothedLevel.current += (raw - smoothedLevel.current) * 0.4;
      const level = smoothedLevel.current;

      const heights = BAR_WEIGHTS.map((weight) => {
        const jitter = 1 + (Math.random() - 0.5) * 0.3;
        const h = MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * weight * level * jitter;
        return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h));
      });
      setBarHeights(heights);
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  if (state === "idle") return null;

  return (
    <div className="overlay-root">
      {state === "recording" && (
        <div
          className={`overlay-pill overlay-recording ${
            realtimeActive ? "overlay-recording-live" : ""
          }`}
        >
          <div className="overlay-row">
            <span className="recording-dot" />
            <div className="waveform">
              {BAR_WEIGHTS.map((_, i) => (
                <span
                  key={i}
                  className="waveform-bar"
                  style={barHeights ? { height: `${barHeights[i]}px` } : {}}
                />
              ))}
            </div>
            <span className="overlay-timer">{formatTime(elapsed)}</span>
            <span
              className={`overlay-mode-badge ${
                realtimeActive ? "overlay-mode-badge-live" : "overlay-mode-badge-disabled"
              }`}
            >
              {realtimeActive ? "Realtime" : realtimeArmed ? "Armed" : "Batch"}
            </span>
            <span
              className={`overlay-target-badge ${
                autoPaste && targetCaptured
                  ? "overlay-target-badge-ready"
                  : "overlay-target-badge-muted"
              }`}
            >
              {autoPaste ? (targetCaptured ? "Typing" : "No target") : "Paste off"}
            </span>
            <button
              className="overlay-mode-toggle"
              onClick={(event) => {
                event.stopPropagation();
                void toggleRealtimeMode();
              }}
              disabled={realtimeChanging}
              title={realtimeArmed ? "Disable realtime transcription" : "Arm realtime transcription"}
            >
              {realtimeArmed ? "Disable" : "Arm"}
            </button>
          </div>
          {realtimeActive && (
            <div className={`overlay-partial ${partialText ? "" : "overlay-partial-pending"}`}>
              {partialText || "Listening for live transcription..."}
            </div>
          )}
        </div>
      )}
      {state === "transcribing" && (
        <div className="overlay-pill overlay-transcribing">
          <span className="spinner" />
          <span className="overlay-status">Transcribing…</span>
        </div>
      )}
      {state === "error" && (
        <div className="overlay-pill overlay-error">
          <span className="overlay-text">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
