'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { ArrowLeft, Hand, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { PHOTO_STEPS } from '@/lib/validation';

const MediaPipeCamera = dynamic(() => import('@/components/MediaPipeCamera'), { ssr: false });

export default function PhotosWizardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [photos, setPhotos] = useState({});
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load session + restore progress
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('palm_session') : null;
    if (!raw) { router.replace('/participate/profile'); return; }
    const s = JSON.parse(raw);
    setSession(s);
    fetch('/api/photos/list', { headers: { Authorization: `Bearer ${s.sessionToken}` } })
      .then((r) => r.json())
      .then((d) => {
        const map = {};
        for (const p of d.photos || []) {
          const key = stepKey({ hand: p.hand, cameraType: p.cameraType, backgroundNumber: p.backgroundNumber });
          map[key] = { photoId: p.id, ok: p.validationPassed };
        }
        setPhotos(map);
        const restoredStep = parseInt(localStorage.getItem('palm_wizard_step') || '0', 10);
        setStepIdx(Math.min(restoredStep, 11));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!loading) localStorage.setItem('palm_wizard_step', String(stepIdx));
  }, [stepIdx, loading]);

  const step = PHOTO_STEPS[stepIdx];
  const total = PHOTO_STEPS.length;
  const completedCount = Object.keys(photos).length;

  const onCaptured = useCallback(async (blob, checks, dims) => {
    if (!session) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', blob, `photo_${Date.now()}.jpg`);
      fd.append('hand', step.hand);
      fd.append('cameraType', step.cameraType);
      fd.append('backgroundNumber', String(step.backgroundNumber));
      fd.append('validationChecks', JSON.stringify(checks));
      fd.append('imageWidth', String(dims.width));
      fd.append('imageHeight', String(dims.height));
      const res = await fetch('/api/photos/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.sessionToken}` },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Upload failed');
      const key = stepKey(step);
      setPhotos((prev) => ({ ...prev, [key]: { photoId: j.photoId, ok: j.validationPassed } }));
      toast.success(`Photo ${stepIdx + 1}/${total} saved ✓`);
      if (stepIdx < total - 1) setStepIdx(stepIdx + 1);
      else router.push('/participate/review');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }, [session, step, stepIdx, total, router]);

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </main>
    );
  }

  const progressPct = (completedCount / total) * 100;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200/60 bg-white sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/participate/profile"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Hand className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium">
              Photo {stepIdx + 1} of {total}
            </span>
          </div>
          <Link
            href="/participate/review"
            className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
          >
            Review <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {/* Progress bar */}
        <div className="container mx-auto px-4 pb-3">
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1 text-right">
            {completedCount}/{total} captured
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-2xl">
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wider text-indigo-600 font-semibold">
            {step.hand} palm · {step.cameraType.toLowerCase()} camera · background {step.backgroundNumber}
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mt-1">
            {instructionFor(step)}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Hold your <span className="font-medium">{step.hand.toLowerCase()}</span> palm facing the
            camera. Match all 6 checks below before capturing.
          </p>
        </div>

        <MediaPipeCamera
          key={`${step.hand}_${step.cameraType}_${step.backgroundNumber}`}
          expectedHand={step.hand}
          cameraType={step.cameraType}
          onCaptured={onCaptured}
        />

        {uploading && (
          <div className="mt-3 text-sm text-slate-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
          </div>
        )}

        {/* Thumbnail strip */}
        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">
            Captured ({completedCount}/{total})
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {PHOTO_STEPS.map((s, i) => {
              const k = stepKey(s);
              const done = !!photos[k];
              const isCurrent = i === stepIdx;
              return (
                <button
                  key={k}
                  onClick={() => setStepIdx(i)}
                  className={`aspect-square rounded-md border text-[10px] grid place-items-center transition-all ${
                    isCurrent
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                      : done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-400'
                  }`}
                  title={`${s.hand} · ${s.cameraType} · BG${s.backgroundNumber}`}
                >
                  {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {completedCount === total && (
          <div className="mt-6">
            <button
              onClick={() => router.push('/participate/review')}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              All 12 captured — Review &amp; submit →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function stepKey(s) {
  return `${s.hand}_${s.cameraType}_${s.backgroundNumber}`;
}

function instructionFor(step) {
  if (step.cameraType === 'BACK') return `Use your main (back) camera — ${step.hand.toLowerCase()} palm`;
  return `Switch to selfie (front) camera — ${step.hand.toLowerCase()} palm`;
}
