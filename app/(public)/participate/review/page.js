'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { PHOTO_STEPS } from '@/lib/validation';

export default function ReviewPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('palm_session') : null;
    if (!raw) { router.replace('/participate/profile'); return; }
    const s = JSON.parse(raw);
    setSession(s);
    fetch('/api/photos/list', { headers: { Authorization: `Bearer ${s.sessionToken}` } })
      .then((r) => r.json())
      .then((d) => { setPhotos(d.photos || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/submissions/complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.sessionToken}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Submission failed');
      localStorage.setItem('palm_reference', JSON.stringify({
        referenceCode: j.referenceCode,
        submissionId: j.submissionId,
        email: session?.profile?.email || '',
      }));
      router.push('/participate/confirmation');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
      </main>
    );
  }

  const photosByKey = new Map(
    photos.map((p) => [`${p.hand}_${p.cameraType}_${p.backgroundNumber}`, p])
  );
  const total = PHOTO_STEPS.length;
  const completed = photos.length;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200/60 bg-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/participate/photos"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to wizard
          </Link>
          <div className="text-sm font-medium">Step 3 of 3 · Review</div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div className="h-full bg-indigo-600 transition-all" style={{ width: '100%' }} />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Review your photos
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          {completed} of {total} captured.
          {completed < total && (
            <span className="text-rose-600 font-medium ml-1">
              You still need {total - completed} more photo(s).
            </span>
          )}
        </p>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PHOTO_STEPS.map((s, i) => {
            const key = `${s.hand}_${s.cameraType}_${s.backgroundNumber}`;
            const photo = photosByKey.get(key);
            return (
              <div
                key={key}
                className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                  photo ? 'border-emerald-200' : 'border-rose-200'
                }`}
              >
                <div className="p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">#{i + 1}</div>
                  <div className="text-xs font-medium mt-0.5 text-slate-800">
                    {s.hand.toLowerCase()} · {s.cameraType.toLowerCase()} · BG{s.backgroundNumber}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    {photo ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {photo.validationPassed ? 'Validated' : 'Uploaded'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700">
                        <XCircle className="w-3.5 h-3.5" /> Missing
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      localStorage.setItem('palm_wizard_step', String(i));
                      router.push('/participate/photos');
                    }}
                    className="mt-2 w-full h-8 text-xs border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    {photo ? 'Replace' : 'Capture'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 space-y-3">
          <button
            onClick={submit}
            disabled={completed < total || submitting}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Submitting…' : `Submit my ${total} photos`}
          </button>
          {completed < total && (
            <p className="text-xs text-rose-600 text-center">
              You still need {total - completed} more photo(s) before submitting.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
