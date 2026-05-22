'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, Copy, Hand } from 'lucide-react';

export default function ConfirmationPage() {
  const [ref, setRef] = useState(null);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('palm_reference') : null;
    if (raw) setRef(JSON.parse(raw));
    // Clear session (keep reference)
    localStorage.removeItem('palm_session');
    localStorage.removeItem('palm_wizard_step');
  }, []);

  const copy = () => {
    if (ref?.referenceCode) {
      navigator.clipboard.writeText(ref.referenceCode);
      toast.success('Reference code copied!');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50 grid place-items-center px-4">
      <div className="max-w-lg w-full border border-emerald-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="pt-10 pb-8 px-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 grid place-items-center animate-bounce-subtle">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-5">
            Thank you! Your submission has been received.
          </h1>
          <p className="text-slate-600 text-sm mt-2">
            Your photos will be reviewed for the dataset. You can withdraw your data at any
            time by emailing the research team with your reference code.
          </p>

          {ref?.referenceCode && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="text-[11px] uppercase tracking-widest text-emerald-700 font-semibold">
                Your reference code
              </div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <code className="text-2xl font-mono font-bold tracking-widest text-emerald-900">
                  {ref.referenceCode}
                </code>
                <button
                  onClick={copy}
                  className="p-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                  title="Copy reference code"
                >
                  <Copy className="w-4 h-4 text-emerald-700" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Save this code — it&apos;s your only way to withdraw your data.
              </p>
              {ref.email && (
                <p className="text-xs text-slate-500 mt-1">
                  A confirmation will be sent to {ref.email}.
                </p>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <button className="inline-flex items-center gap-2 h-10 px-5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors text-slate-700">
                <Hand className="w-4 h-4" /> Back to home
              </button>
            </Link>
            <Link href="/participate/profile">
              <button className="inline-flex items-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors">
                Submit another →
              </button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
