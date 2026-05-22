'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import {
  useMediaPipe,
  getBoundingBox,
  getPalmCoverageRatio,
  getPalmTiltAngle,
  getExpectedMediaPipeHandedness,
} from './MediaPipeProvider';

import { ValidationOverlay } from './ValidationOverlay';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, Upload, Loader2, AlertCircle } from 'lucide-react';


// ============================================================
// Types
// ============================================================

export interface LiveValidationState {
  handDetected: boolean;
  handCount: number;
  palmCoverage: number;       // 0–1
  palmTiltAngle: number;      // degrees
  brightness: number;         // 0–255 estimated
  isSharp: boolean;           // estimated from camera
  handedness: string | null;  // 'Left' or 'Right'
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  // Per-check pass/fail
  checks: {
    palmSize: boolean;
    handCount: boolean;
    palmAngle: boolean;
    handedness: boolean;
  };
  allChecksPass: boolean;
}

export interface CameraError {
  type: 'PERMISSION_DENIED' | 'NOT_SUPPORTED' | 'MEDIAPIPE_ERROR' | 'CAPTURE_ERROR';
  message: string;
}

interface CameraCaptureProps {
  expectedHand: 'LEFT' | 'RIGHT';
  cameraType: 'FRONT' | 'BACK';
  onCapture: (imageDataUrl: string, thumbnailDataUrl: string) => void;
  onGalleryUpload: (file: File) => void;
}

// ============================================================
// Main Camera Capture Component
// ============================================================

const PROCESSING_FPS = 15;
const FRAME_INTERVAL_MS = 1000 / PROCESSING_FPS;

export function CameraCapture({
  expectedHand,
  cameraType,
  onCapture,
  onGalleryUpload,
}: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const animFrameRef = useRef<number>(0);

  const { hands, isReady: mediaPipeReady, loadState } = useMediaPipe();

  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [liveValidation, setLiveValidation] = useState<LiveValidationState | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const facingMode = cameraType === 'FRONT' ? 'user' : 'environment';

  // ─── Compute brightness from canvas pixels ───────────────

  const computeBrightness = useCallback((
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): number => {
    // Sample every 4th pixel for performance
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 16) {
      sum += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      count++;
    }
    return count > 0 ? sum / count : 128;
  }, []);

  // ─── Process frame with MediaPipe ────────────────────────

  const processFrame = useCallback(async () => {
    if (processingRef.current) return;
    if (!mediaPipeReady || !hands) return;

    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== 4) return;

    const now = performance.now();
    if (now - lastFrameTimeRef.current < FRAME_INTERVAL_MS) return;
    lastFrameTimeRef.current = now;

    processingRef.current = true;
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, w, h);
      const brightness = computeBrightness(ctx, w, h);

      // Send to MediaPipe
      const handsInstance = hands as {
        onResults: (cb: (results: unknown) => void) => void;
        send: (opts: { image: HTMLVideoElement }) => Promise<void>;
      };

      await new Promise<void>((resolve) => {
        handsInstance.onResults((results: unknown) => {
          const r = results as {
            multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
            multiHandedness?: Array<{ label: string; score: number }>;
          };

          const handLandmarks = r.multiHandLandmarks ?? [];
          const handednessResults = r.multiHandedness ?? [];
          const handCount = handLandmarks.length;

          if (handCount === 0) {
            setLiveValidation({
              handDetected: false,
              handCount: 0,
              palmCoverage: 0,
              palmTiltAngle: 0,
              brightness,
              isSharp: true,
              handedness: null,
              boundingBox: null,
              checks: {
                palmSize: false,
                handCount: false,
                palmAngle: false,
                handedness: false,
              },
              allChecksPass: false,
            });
            resolve();
            return;
          }

          // Use the first detected hand
          const landmarks = handLandmarks[0];
          const detectedHandedness = handednessResults[0]?.label ?? null;

          // CHECK 1: Palm coverage
          const palmCoverage = getPalmCoverageRatio(landmarks, w, h);
          const palmSizeOk = palmCoverage >= 0.50;

          // CHECK 2: Only one hand
          const handCountOk = handCount === 1;

          // CHECK 3: Tilt angle
          const tiltAngle = getPalmTiltAngle(landmarks);
          const tiltOk = tiltAngle <= 30;

          // CHECK 4: Correct handedness (with front camera mirror correction)
          const expectedHandedness = getExpectedMediaPipeHandedness(
            expectedHand,
            cameraType,
          );
          const handednessOk = detectedHandedness === expectedHandedness;

          // Bounding box for overlay
          const bbox = getBoundingBox(landmarks, w, h);

          const checks = {
            palmSize: palmSizeOk,
            handCount: handCountOk,
            palmAngle: tiltOk,
            handedness: handednessOk,
          };

          const allChecksPass =
            palmSizeOk && handCountOk && tiltOk && handednessOk;

          setLiveValidation({
            handDetected: true,
            handCount,
            palmCoverage,
            palmTiltAngle: tiltAngle,
            brightness,
            isSharp: true,
            handedness: detectedHandedness,
            boundingBox: bbox,
            checks,
            allChecksPass,
          });

          resolve();
        });

        handsInstance.send({ image: video }).catch(() => resolve());
      });
    } finally {
      processingRef.current = false;
    }
  }, [mediaPipeReady, hands, expectedHand, cameraType, computeBrightness]);

  // ─── Animation loop ──────────────────────────────────────

  useEffect(() => {
    if (capturedImage) return; // Stop processing after capture

    const loop = () => {
      processFrame();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [processFrame, capturedImage]);

  // ─── Capture photo ──────────────────────────────────────

  const capturePhoto = useCallback(async () => {
    if (!webcamRef.current) return;
    setIsCapturing(true);

    try {
      // Capture high quality screenshot
      const screenshot = webcamRef.current.getScreenshot({
        width: 1280,
        height: 960,
      });

      if (!screenshot) throw new Error('Failed to capture screenshot');

      // Create thumbnail (400px wide)
      const img = new Image();
      img.src = screenshot;
      await new Promise<void>((resolve) => (img.onload = () => resolve()));

      const thumbCanvas = document.createElement('canvas');
      const ratio = img.height / img.width;
      thumbCanvas.width = 400;
      thumbCanvas.height = 400 * ratio;
      const thumbCtx = thumbCanvas.getContext('2d')!;
      thumbCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
      const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

      setCapturedImage(screenshot);
      onCapture(screenshot, thumbnail);
    } catch {
      setCameraError({
        type: 'CAPTURE_ERROR',
        message: 'Failed to capture photo. Please try again.',
      });
    } finally {
      setIsCapturing(false);
    }
  }, [onCapture]);

  // ─── Handle camera permission errors ────────────────────

  const handleCameraError = useCallback((error: string | DOMException) => {
    const msg = typeof error === 'string' ? error : error.message;

    if (msg.includes('Permission') || msg.includes('NotAllowed')) {
      setCameraPermission('denied');
      setCameraError({
        type: 'PERMISSION_DENIED',
        message:
          'Camera access was denied. Please allow camera access in your browser settings and refresh.',
      });
    } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
      setCameraError({
        type: 'NOT_SUPPORTED',
        message:
          'No camera found. Please use the "Upload from gallery" option below.',
      });
    } else {
      setCameraError({
        type: 'NOT_SUPPORTED',
        message: `Camera error: ${msg}. Please try uploading from gallery.`,
      });
    }
  }, []);

  // ─── Gallery upload ──────────────────────────────────────

  const handleGalleryFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? '10') * 1024 * 1024;
    if (file.size > maxBytes) {
      setCameraError({
        type: 'CAPTURE_ERROR',
        message: `File is too large (max ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB}MB). Please take a new photo with your camera app.`,
      });
      return;
    }

    onGalleryUpload(file);
  }, [onGalleryUpload]);

  // ─── Render: Camera permission denied ───────────────────

  if (cameraError?.type === 'PERMISSION_DENIED' || cameraError?.type === 'NOT_SUPPORTED') {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{cameraError.message}</AlertDescription>
        </Alert>

        <div className="rounded-lg border-2 border-dashed border-slate-600 p-8 text-center">
          <Upload className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-300 mb-4">Upload a photo from your gallery</p>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="border-violet-500 text-violet-400 hover:bg-violet-500/10"
          >
            <Upload className="h-4 w-4 mr-2" />
            Choose Photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleGalleryFile}
          />
        </div>
      </div>
    );
  }

  // ─── Render: MediaPipe loading ───────────────────────────

  const mediaPipeLoading = loadState === 'loading';
  const mediaPipeFailed = loadState === 'error';

  // ─── Main render ─────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Camera viewfinder */}
      <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-[4/3]">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.95}
          videoConstraints={{
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 960 },
          }}
          onUserMediaError={handleCameraError}
          onUserMedia={() => setCameraPermission('granted')}
          className="w-full h-full object-cover"
          mirrored={cameraType === 'FRONT'} // Mirror selfie camera for natural UX
        />

        {/* Hidden canvas for frame processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live validation overlay */}
        {!capturedImage && liveValidation && cameraPermission === 'granted' && (
          <ValidationOverlay
            liveValidation={liveValidation}
            imageWidth={webcamRef.current?.video?.videoWidth ?? 640}
            imageHeight={webcamRef.current?.video?.videoHeight ?? 480}
          />
        )}

        {/* MediaPipe loading indicator */}
        {mediaPipeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center text-white">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading hand detection...</p>
            </div>
          </div>
        )}

        {/* MediaPipe failed — degraded mode */}
        {mediaPipeFailed && (
          <div className="absolute top-2 left-2 right-2">
            <Alert className="bg-amber-900/90 border-amber-500">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-200 text-xs">
                Hand detection unavailable. Please ensure your palm fills the frame and is well-lit.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Status bar — brightness + sharpness indicators */}
      {liveValidation && cameraPermission === 'granted' && !capturedImage && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-800/60 rounded-lg p-3 flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  liveValidation.brightness < 60
                    ? '#ef4444'
                    : liveValidation.brightness > 240
                    ? '#f97316'
                    : '#22c55e',
              }}
            />
            <div className="flex-1">
              <p className="text-slate-400 text-xs">Brightness</p>
              <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${(liveValidation.brightness / 255) * 100}%`,
                    backgroundColor:
                      liveValidation.brightness < 60
                        ? '#ef4444'
                        : liveValidation.brightness > 240
                        ? '#f97316'
                        : '#22c55e',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
              liveValidation.palmCoverage >= 0.5 ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <div>
              <p className="text-slate-400 text-xs">Palm Coverage</p>
              <p className="text-white font-medium">
                {Math.round(liveValidation.palmCoverage * 100)}%
                {liveValidation.palmCoverage >= 0.5 ? ' ✓' : ' (need ≥50%)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Capture button */}
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          onClick={capturePhoto}
          disabled={
            isCapturing ||
            !liveValidation?.allChecksPass ||
            cameraPermission !== 'granted'
          }
          className={`w-full h-14 text-lg font-semibold transition-all ${
            liveValidation?.allChecksPass
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/25'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isCapturing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Capturing...
            </>
          ) : liveValidation?.allChecksPass ? (
            <>
              <Camera className="h-5 w-5 mr-2" />
              Capture Photo
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              Align Your Palm to Capture
            </>
          )}
        </Button>

        {/* Gallery fallback */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-slate-400 hover:text-violet-400 text-sm text-center transition-colors flex items-center justify-center gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload from gallery instead
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleGalleryFile}
        />
      </div>
    </div>
  );
}
