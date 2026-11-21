"use client";

import { useCallback, useEffect, useState } from "react";
import type { TourStep } from "@/lib/tour";

type Status = "idle" | "playing" | "paused" | "done";

interface Options {
  steps: TourStep[];
  /** Flies the camera; the tour calls it for every step. */
  flyTo: (placeId: string | null) => void;
  focusId: string | null;
  flying: boolean;
  /** Start by itself shortly after the page loads. */
  autoStart: boolean;
}

/**
 * Plays the steps in order: fly, wait for the camera to arrive, stay a moment,
 * move on. The user taking over (stop) hands the map back.
 */
export function useTour({ steps, flyTo, focusId, flying, autoStart }: Options) {
  const [status, setStatus] = useState<Status>("idle");
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)];

  // Send the camera to the current step.
  useEffect(() => {
    if (status === "playing") flyTo(step.placeId);
  }, [status, step, flyTo]);

  // Once there, stay for the step's dwell time, then move on.
  useEffect(() => {
    if (status !== "playing" || flying || focusId !== step.placeId) return;
    const t = window.setTimeout(() => {
      if (index + 1 < steps.length) setIndex(index + 1);
      else setStatus("done");
    }, step.dwell);
    return () => window.clearTimeout(t);
  }, [status, flying, focusId, step, index, steps.length]);

  useEffect(() => {
    if (!autoStart) return;
    const t = window.setTimeout(() => {
      setIndex(0);
      setStatus("playing");
    }, 1000);
    return () => window.clearTimeout(t);
  }, [autoStart]);

  const play = useCallback(() => {
    if (status === "idle" || status === "done") setIndex(0);
    setStatus("playing");
  }, [status]);
  const pause = useCallback(() => setStatus("paused"), []);
  const stop = useCallback(() => setStatus((s) => (s === "idle" ? s : "idle")), []);
  const skip = useCallback(() => {
    setIndex((i) => Math.min(i + 1, steps.length - 1));
    setStatus("playing");
  }, [steps.length]);

  return {
    status,
    caption: status === "idle" ? null : step.caption,
    progress: steps.length > 1 ? index / (steps.length - 1) : 0,
    play,
    pause,
    stop,
    skip,
  };
}
