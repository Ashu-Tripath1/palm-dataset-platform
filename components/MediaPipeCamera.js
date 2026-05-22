'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera as CameraIcon,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  SwitchCamera,
} from 'lucide-react';

/**
 * MediaPipeCamera
 * Props:
 *  - expectedHand: 'LEFT' | 'RIGHT'
 *  - cameraType: 'FRONT' | 'BACK'  (initial facingMode)
 *  - onCaptured(blob, validationChecks, dims) => void
 */
export default function MediaPipeCamera({ expectedHand, cameraType, onCaptured }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const sampleCanvasRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  // Use a ref so detectLoop always reads the latest facing value
  // without needing to be recreated (avoids stale-closure on camera flip)
  const facingRef = useRef(cameraType === 'FRONT' ? 'user' : 'environment');

  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Loading palm detector…');
  const [error, setError] = useState(null);
  const [facing, setFacing] = useState(cameraType === 'FRONT' ? 'user' : 'environment');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewChecks, setPreviewChecks] = useState(null);
  const [capturing, setCapturing] = useState(false);

  // Live metrics
  const [metrics, setMetrics] = useState({
    handCount: 0,
    palmSizePct: 0,
    palmAngleDeg: 90,
    handedness: null,
    brightness: 0,
    sharpness: 0,
    landmarks: null,
    bbox: null,
  });

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const sample = sampleCanvasRef.current;
    const detector = detectorRef.current;
    if (!video || !overlay || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const W = video.videoWidth;
    const H = video.videoHeight;
    overlay.width = W;
    overlay.height = H;
    sample.width = 160;
    sample.height = 90;

    const result = detector.detectForVideo(video, performance.now());

    // Compute brightness & sharpness on a small sample
    const sctx = sample.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(video, 0, 0, sample.width, sample.height);
    const imgData = sctx.getImageData(0, 0, sample.width, sample.height);
    const { brightness, laplacianVar } = computeBrightnessSharpness(imgData);

    // Process landmarks
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    let palmSizePct = 0;
    let palmAngleDeg = 90;
    let handedness = null;
    let bbox = null;
    let landmarks = null;

    const handCount = result?.landmarks?.length || 0;

    if (handCount >= 1) {
      let bestIdx = 0;
      let bestArea = 0;
      for (let i = 0; i < result.landmarks.length; i++) {
        const lm = result.landmarks[i];
        const xs = lm.map((p) => p.x);
        const ys = lm.map((p) => p.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        const a = w * h;
        if (a > bestArea) { bestArea = a; bestIdx = i; }
      }
      landmarks = result.landmarks[bestIdx];
      const xs = landmarks.map((p) => p.x);
      const ys = landmarks.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = (maxX - minX) * W;
      const bh = (maxY - minY) * H;
      bbox = { x: minX * W, y: minY * H, w: bw, h: bh };
      palmSizePct = ((bw * bh) / (W * H)) * 100;

      // Palm angle
      const wl = result.worldLandmarks?.[bestIdx];
      if (wl) {
        const a = wl[0], b = wl[5], c = wl[17];
        const v1 = [b.x - a.x, b.y - a.y, b.z - a.z];
        const v2 = [c.x - a.x, c.y - a.y, c.z - a.z];
        const n = [
          v1[1] * v2[2] - v1[2] * v2[1],
          v1[2] * v2[0] - v1[0] * v2[2],
          v1[0] * v2[1] - v1[1] * v2[0],
        ];
        const mag = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
        const cosTheta = Math.abs(n[2]) / mag;
        palmAngleDeg = Math.round((Math.acos(Math.min(1, Math.max(-1, cosTheta))) * 180) / Math.PI);
      }

      // Use raw handedness from MediaPipe without any mirror flipping
      const rawHand = result.handedness?.[bestIdx]?.[0]?.categoryName || null;
      let detected = rawHand;
      handedness = detected?.toUpperCase();

      // Draw bbox & skeleton
      const expectedOk = !handedness || handedness === expectedHand;
      ctx.strokeStyle = expectedOk && palmSizePct >= 50 && palmAngleDeg <= 30 ? '#10b981' : '#f59e0b';
      ctx.lineWidth = 4;
      ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
      const connections = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [5,9],[9,10],[10,11],[11,12],
        [9,13],[13,14],[14,15],[15,16],
        [13,17],[17,18],[18,19],[19,20],
        [0,17],
      ];
      ctx.strokeStyle = 'rgba(99,102,241,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [a, b] of connections) {
        const pa = landmarks[a], pb = landmarks[b];
        ctx.moveTo(pa.x * W, pa.y * H);
        ctx.lineTo(pb.x * W, pb.y * H);
      }
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      for (const p of landmarks) {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    setMetrics({
      handCount,
      palmSizePct: Math.round(palmSizePct),
      palmAngleDeg,
      handedness,
      brightness: Math.round(brightness),
      sharpness: Math.round(laplacianVar),
      landmarks,
      bbox,
    });

    rafRef.current = requestAnimationFrame(detectLoop);
  // Remove `facing` from deps — we read facingRef.current inside instead,
  // so detectLoop never needs to be recreated when the camera flips.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedHand]);

  const startCamera = useCallback(async (facingMode) => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      cancelAnimationFrame(rafRef.current);
      detectLoop();
    } catch (e) {
      setError('Camera access denied. Use "Upload from gallery" instead.');
    }
  }, [stopCamera, detectLoop]);

  // Initialize MediaPipe HandLandmarker
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingMsg('Loading palm detection model…');
        const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );
        const detector = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        if (!active) { detector.close(); return; }
        detectorRef.current = detector;
        setLoadingMsg('Requesting camera permission…');
        await startCamera(facing);
        if (!active) return;
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError(e.message || 'Failed to load detector');
        setLoading(false);
      }
    })();
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      stopCamera();
      if (detectorRef.current) {
        try { detectorRef.current.close(); } catch {}
        detectorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flipCamera = async () => {
    const newFacing = facing === 'user' ? 'environment' : 'user';
    // Update ref FIRST so detectLoop immediately uses the correct side
    // before React re-renders from setFacing
    facingRef.current = newFacing;
    setFacing(newFacing);
    await startCamera(newFacing);
  };

  const checks = evaluateChecks(metrics, expectedHand);
  const allOk = Object.values(checks).every((v) => v.ok);

  const capture = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (facingRef.current === 'user') {
        // Front camera: mirror horizontally so the saved image matches
        // the mirrored preview and corrected handedness
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
      );
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      const finalChecks = evaluateChecks(metrics, expectedHand);
      setPreviewChecks({
        ...Object.fromEntries(Object.entries(finalChecks).map(([k, v]) => [k, v.ok])),
        _metrics: {
          palmSizePct: metrics.palmSizePct,
          palmAngleDeg: metrics.palmAngleDeg,
          handedness: metrics.handedness,
          brightness: metrics.brightness,
          sharpness: metrics.sharpness,
        },
      });
      cancelAnimationFrame(rafRef.current);
    } finally {
      setCapturing(false);
    }
  };

  const usePhoto = async () => {
    if (!previewUrl || !previewChecks) return;
    const blob = await fetch(previewUrl).then((r) => r.blob());
    const checksOnly = { ...previewChecks };
    delete checksOnly._metrics;
    onCaptured(blob, checksOnly, {
      width: videoRef.current?.videoWidth || 0,
      height: videoRef.current?.videoHeight || 0,
    });
    URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewChecks(null);
    detectLoop();
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewChecks(null);
    detectLoop();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = async () => {
        const c = document.createElement('canvas');
        const maxW = 1600;
        const scale = Math.min(1, maxW / img.width);
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
        onCaptured(blob, {
          handCount: true, palmSize: true, palmAngle: true,
          handedness: true, brightness: true, sharpness: true,
          uploaded: true,
        }, { width: c.width, height: c.height });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  if (error) {
    return (
      <div className="p-6 rounded-lg border border-amber-200 bg-amber-50 text-sm">
        <div className="flex items-center gap-2 text-amber-800 font-medium">
          <AlertTriangle className="w-4 h-4" /> Camera unavailable
        </div>
        <p className="mt-2 text-amber-900">{error}</p>
        <div className="mt-3">
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-md bg-slate-900 text-white px-4 py-2 text-sm">
            <Upload className="w-4 h-4" /> Upload from gallery
            <input type="file" accept="image/jpeg,image/png" hidden onChange={handleFileUpload} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-[3/4] sm:aspect-video">
        {loading && (
          <div className="absolute inset-0 grid place-items-center text-white text-sm bg-black/80 z-30">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {loadingMsg}
            </div>
          </div>
        )}
        <div className={previewUrl ? 'hidden' : 'block'}>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            <canvas
              ref={overlayRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            <canvas ref={sampleCanvasRef} className="hidden" />
            {/* HUD bottom */}
            <div className="absolute left-3 right-3 bottom-3 z-20">
              <div className="rounded-lg bg-black/60 backdrop-blur text-white text-xs p-2.5 grid grid-cols-3 gap-2">
                <Metric label="Hands" value={metrics.handCount} ok={checks.handCount.ok} />
                <Metric label="Coverage" value={`${metrics.palmSizePct}%`} ok={checks.palmSize.ok} />
                <Metric label="Angle" value={`${metrics.palmAngleDeg}°`} ok={checks.palmAngle.ok} />
                <Metric label="Hand" value={metrics.handedness || '—'} ok={checks.handedness.ok} />
                <Metric label="Bright" value={metrics.brightness} ok={checks.brightness.ok} />
                <Metric label="Sharp" value={metrics.sharpness} ok={checks.sharpness.ok} />
              </div>
            </div>
            {/* Top HUD */}
            <div className="absolute top-3 left-3 right-3 flex justify-between z-20">
              <div className="rounded-full bg-black/60 text-white text-xs px-3 py-1">
                {cameraType === 'FRONT' ? 'Front camera' : 'Back camera'} · {expectedHand} palm
              </div>
              <button
                onClick={flipCamera}
                className="rounded-full bg-black/60 text-white p-2 hover:bg-black/80 transition-colors"
                title="Flip camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </div>
        </div>
        {previewUrl && (
          <img src={previewUrl} alt="capture preview" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      {/* Checks list */}
      {!previewUrl && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(checks).map(([k, v]) => (
            <CheckPill key={k} ok={v.ok} label={v.label} />
          ))}
        </div>
      )}

      {previewUrl && previewChecks && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(previewChecks)
            .filter(([k]) => !k.startsWith('_'))
            .map(([k, ok]) => (
              <CheckPill key={k} ok={!!ok} label={CHECK_LABELS[k] || k} />
            ))}
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        {!previewUrl ? (
          <>
            <button
              onClick={capture}
              disabled={!allOk || capturing}
              className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <CameraIcon className="w-4 h-4" />
              {allOk ? 'Capture Photo' : 'Adjust to match all checks'}
            </button>
            <label className="inline-flex items-center justify-center gap-2 cursor-pointer rounded-lg border border-slate-300 px-4 h-12 text-sm hover:bg-slate-50 transition-colors">
              <Upload className="w-4 h-4" /> Upload from gallery
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={handleFileUpload}
              />
            </label>
          </>
        ) : (
          <>
            <button
              onClick={usePhoto}
              className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Use this photo
            </button>
            <button
              onClick={retake}
              className="flex-1 h-12 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Retake
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const CHECK_LABELS = {
  handCount: 'Single hand',
  palmSize: 'Fills frame',
  palmAngle: 'Palm flat',
  handedness: 'Correct hand',
  brightness: 'Good light',
  sharpness: 'Sharp focus',
  uploaded: 'From gallery',
};

function evaluateChecks(m, expectedHand) {
  return {
    handCount: { ok: m.handCount === 1, label: CHECK_LABELS.handCount },
    palmSize: { ok: m.palmSizePct >= 50, label: CHECK_LABELS.palmSize },
    palmAngle: { ok: m.palmAngleDeg <= 30, label: CHECK_LABELS.palmAngle },
    handedness: {
      ok: m.handedness ? m.handedness === expectedHand : false,
      label: CHECK_LABELS.handedness,
    },
    brightness: { ok: m.brightness >= 60 && m.brightness <= 240, label: CHECK_LABELS.brightness },
    sharpness: { ok: m.sharpness >= 60, label: CHECK_LABELS.sharpness },
  };
}

function Metric({ label, value, ok }) {
  return (
    <div
      className={`rounded-md px-2 py-1.5 ${ok ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}
    >
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function CheckPill({ ok, label }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 ${
        ok ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-700'
      }`}
    >
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}

// Compute mean brightness and Laplacian-variance approximation on small ImageData
function computeBrightnessSharpness(imgData) {
  const { data, width, height } = imgData;
  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = y;
    sum += y;
  }
  const mean = sum / (width * height);
  let lapSum = 0, lapSq = 0, n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      lapSum += v;
      lapSq += v * v;
      n++;
    }
  }
  const lapMean = lapSum / n;
  const variance = lapSq / n - lapMean * lapMean;
  return { brightness: mean, laplacianVar: variance };
}
