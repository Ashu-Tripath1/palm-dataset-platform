'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';

// ============================================================
// MediaPipe Hands Context
// Lazy-loads MediaPipe WASM and provides the hands detector
// Falls back to upload-only mode if MediaPipe fails to load
// ============================================================

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface MediaPipeContextValue {
  hands: unknown | null; // MediaPipe Hands instance
  loadState: LoadState;
  isReady: boolean;
  error: string | null;
}

const MediaPipeContext = createContext<MediaPipeContextValue>({
  hands: null,
  loadState: 'idle',
  isReady: false,
  error: null,
});

export function useMediaPipe() {
  return useContext(MediaPipeContext);
}

interface MediaPipeProviderProps {
  children: ReactNode;
}

export function MediaPipeProvider({ children }: MediaPipeProviderProps) {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const handsRef = useRef<unknown | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadMediaPipe() {
      try {
        setLoadState('loading');

        // Dynamically import @mediapipe/hands to avoid SSR issues
        const { Hands } = await import('@mediapipe/hands');


        const hands = new Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,          // Detect up to 2 (to catch multi-hand violations)
          modelComplexity: 1,      // Full model for accuracy
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        });

        // Warm up the model with a dummy detection
        await hands.initialize();

        if (mounted) {
          handsRef.current = hands;
          setLoadState('ready');
        }
      } catch (err) {
        if (mounted) {
          const message =
            err instanceof Error ? err.message : 'Failed to load hand detection';
          setError(message);
          setLoadState('error');
        }
      }
    }

    loadMediaPipe();

    return () => {
      mounted = false;
      // Close hands model to free WASM memory
      if (handsRef.current) {
        try {
          (handsRef.current as { close?: () => void }).close?.();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  return (
    <MediaPipeContext.Provider
      value={{
        hands: handsRef.current,
        loadState,
        isReady: loadState === 'ready',
        error,
      }}
    >
      {children}
    </MediaPipeContext.Provider>
  );
}

// ============================================================
// Hand landmark indices (MediaPipe convention)
// ============================================================

export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

// ============================================================
// Calculate bounding box from landmarks
// ============================================================

export function getBoundingBox(
  landmarks: Array<{ x: number; y: number; z: number }>,
  imageWidth: number,
  imageHeight: number,
) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const lm of landmarks) {
    const px = lm.x * imageWidth;
    const py = lm.y * imageHeight;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  // Add 15% padding around the bounding box
  const padX = (maxX - minX) * 0.15;
  const padY = (maxY - minY) * 0.15;

  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    width: Math.min(imageWidth, maxX + padX) - Math.max(0, minX - padX),
    height: Math.min(imageHeight, maxY + padY) - Math.max(0, minY - padY),
  };
}

// ============================================================
// Calculate palm coverage ratio (CHECK 1)
// ============================================================

export function getPalmCoverageRatio(
  landmarks: Array<{ x: number; y: number; z: number }>,
  imageWidth: number,
  imageHeight: number,
): number {
  const bbox = getBoundingBox(landmarks, imageWidth, imageHeight);
  const bboxArea = bbox.width * bbox.height;
  const imageArea = imageWidth * imageHeight;
  return bboxArea / imageArea;
}

// ============================================================
// Calculate palm tilt angle (CHECK 3)
// Uses wrist (0), index MCP (5), pinky MCP (17)
// ============================================================

export function getPalmTiltAngle(
  landmarks: Array<{ x: number; y: number; z: number }>,
): number {
  const wrist = landmarks[HAND_LANDMARKS.WRIST];
  const indexMcp = landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP];
  const pinkyMcp = landmarks[HAND_LANDMARKS.PINKY_MCP];

  if (!wrist || !indexMcp || !pinkyMcp) return 0;

  // Vector from wrist to midpoint between index and pinky MCPs
  const midX = (indexMcp.x + pinkyMcp.x) / 2;
  const midY = (indexMcp.y + pinkyMcp.y) / 2;
  const midZ = (indexMcp.z + pinkyMcp.z) / 2;

  // Z-component of wrist-to-mid vector indicates tilt
  // In MediaPipe, z is depth relative to the wrist
  const dx = midX - wrist.x;
  const dy = midY - wrist.y;
  const dz = midZ - wrist.z;

  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length === 0) return 0;

  // Angle between the palm plane and the camera plane
  const tiltRad = Math.acos(Math.abs(dz) / length);
  const tiltDeg = (tiltRad * 180) / Math.PI;

  return tiltDeg;
}

// ============================================================
// Determine expected handedness for a step
// MediaPipe uses mirror convention for front camera
// ============================================================

export function getExpectedMediaPipeHandedness(
  hand: 'LEFT' | 'RIGHT',
  cameraType: 'FRONT' | 'BACK',
): string {
  // For back camera: LEFT hand appears as "Left" in MediaPipe
  // For front camera: mirror flip — LEFT hand appears as "Right"
  if (cameraType === 'FRONT') {
    return hand === 'LEFT' ? 'Right' : 'Left';
  }
  return hand === 'LEFT' ? 'Left' : 'Right';
}
