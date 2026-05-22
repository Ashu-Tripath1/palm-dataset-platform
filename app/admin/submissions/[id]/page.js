'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, User, Camera } from 'lucide-react';

export default function SubmissionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/submissions/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { toast.error('Failed to load'); setLoading(false); });
  }, [id]);

  const updateStatus = async (status) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Status updated');
      setData((prev) => ({ ...prev, participant: { ...prev.participant, status } }));
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return (
      <div className="p-8 grid place-items-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">Submission not found.</div>
    );
  }

  const { participant: p, photos } = data;

  const genderLabel = {
    MALE: 'Male', FEMALE: 'Female', OTHER: 'Other', PREFER_NOT_TO_SAY: 'Prefer not to say'
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/submissions"
          className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Submission{' '}
            <code className="text-base bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              {id.slice(0, 8).toUpperCase()}
            </code>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Participant info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-indigo-600" />
              <h2 className="font-semibold text-slate-800">Participant Info</h2>
            </div>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: 'Age', value: p.age },
                { label: 'Gender', value: genderLabel[p.gender] || p.gender },
                { label: 'Profession', value: p.profession },
                { label: 'Country', value: p.country },
                { label: 'Email', value: p.email || '—' },
                { label: 'Consent', value: p.consentGiven ? '✓ Yes' : '✗ No' },
                { label: 'Created', value: new Date(p.createdAt).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-slate-500 flex-shrink-0">{label}</dt>
                  <dd className="text-slate-800 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Status control */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-3">Status</h2>
            <div className="space-y-2">
              {[
                { value: 'SUBMITTED', label: 'Submitted', className: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                { value: 'IN_PROGRESS', label: 'In Progress', className: 'border-amber-300 bg-amber-50 text-amber-700' },
                { value: 'REJECTED', label: 'Rejected', className: 'border-rose-300 bg-rose-50 text-rose-700' },
              ].map(({ value, label, className }) => (
                <button
                  key={value}
                  onClick={() => updateStatus(value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    p.status === value ? className : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  {p.status === value && '● '}{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Photos grid */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-4 h-4 text-indigo-600" />
              <h2 className="font-semibold text-slate-800">Photos ({photos.length}/12)</h2>
            </div>
            {photos.length === 0 ? (
              <p className="text-slate-400 text-sm">No photos uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`rounded-lg border overflow-hidden ${
                      photo.validationPassed ? 'border-emerald-200' : 'border-rose-200'
                    }`}
                  >
                    {/* Photo preview */}
                    <div className="aspect-square bg-slate-100 relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/admin/photo/${photo.id}`}
                        alt={`${photo.hand} ${photo.cameraType} BG${photo.backgroundNumber}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div className="p-2 text-[10px] text-slate-600">
                      <div className="font-medium">
                        {photo.hand.toLowerCase()} · {photo.cameraType.toLowerCase()} · BG{photo.backgroundNumber}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {photo.validationPassed ? (
                          <span className="flex items-center gap-0.5 text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" /> Validated
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-rose-600">
                            <XCircle className="w-3 h-3" /> Not validated
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {(photo.fileSizeBytes / 1024).toFixed(0)}KB · {photo.imageWidth}×{photo.imageHeight}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
