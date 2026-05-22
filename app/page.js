'use client';

import Link from 'next/link';
import { Hand, Camera, Shield, Clock, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Top nav */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 grid place-items-center text-white shadow-sm">
              <Hand className="w-5 h-5" />
            </div>
            <div className="font-semibold tracking-tight">Palm Research Study</div>
          </div>
          <Link href="/admin/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            For Researchers
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-12 pb-10 md:pt-20 md:pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Active research project · IRB-style protocol
        </div>
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-900 max-w-3xl mx-auto">
          Help train AI to study the link between{' '}
          <span className="text-indigo-600">palms</span> and{' '}
          <span className="text-purple-600">profession</span>.
        </h1>
        <p className="mt-5 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
          We&apos;re collecting a high-quality, validated dataset of palm photographs from human
          participants worldwide. Your contribution helps build a more inclusive medical-AI research resource.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/participate/profile">
            <button className="inline-flex items-center h-12 px-7 text-base bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm">
              Participate Now <ChevronRight className="ml-1 h-4 w-4" />
            </button>
          </Link>
          <Link
            href="#how"
            className="text-sm text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline transition-colors"
          >
            How it works →
          </Link>
        </div>
      </section>

      {/* Stats / What you'll need */}
      <section id="how" className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <Camera className="w-7 h-7 text-indigo-600" />
            <div className="mt-3 font-medium text-slate-900">12 photos</div>
            <div className="text-sm text-slate-600 mt-1">
              6 of your right palm and 6 of your left palm, across 3 backgrounds, using your
              phone&apos;s front and back camera.
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <Clock className="w-7 h-7 text-purple-600" />
            <div className="mt-3 font-medium text-slate-900">~5 minutes</div>
            <div className="text-sm text-slate-600 mt-1">
              Live, real-time validation guides you to a good shot the first time. No retake fatigue.
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <Shield className="w-7 h-7 text-emerald-600" />
            <div className="mt-3 font-medium text-slate-900">Privacy-first</div>
            <div className="text-sm text-slate-600 mt-1">
              EXIF location data is stripped automatically before upload. You can withdraw at any time.
            </div>
          </div>
        </div>
      </section>

      {/* Good vs bad photos */}
      <section className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          What makes a good photo?
        </h2>
        <p className="text-slate-600 mt-1 text-sm">
          Our on-device AI checks all of this for you in real time.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 p-6">
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <CheckCircle2 className="w-5 h-5" /> Accepted
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>• Palm fills at least 50% of the frame</li>
              <li>• Palm is flat and parallel to the camera</li>
              <li>• Bright, even lighting (not direct sunlight)</li>
              <li>• Sharp focus — no motion blur</li>
              <li>• Only one hand visible</li>
              <li>• Skin is visible (no gloves)</li>
            </ul>
          </div>
          <div className="rounded-xl border border-rose-200/70 bg-rose-50/30 p-6">
            <div className="flex items-center gap-2 text-rose-700 font-medium">
              <XCircle className="w-5 h-5" /> Rejected
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>• Hand too far from camera</li>
              <li>• Palm angled — not parallel</li>
              <li>• Back of hand instead of palm</li>
              <li>• Dark, overexposed, or blurry</li>
              <li>• Photographed someone else&apos;s hand</li>
              <li>• Mirrored or downloaded images</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Steps section */}
      <section className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Fill your profile', desc: 'Enter basic info: age, gender, profession, country. Takes 30 seconds.' },
            { step: '02', title: 'Capture 12 photos', desc: 'Our on-device AI guides you step-by-step through both hands, front and back cameras, 3 backgrounds each.' },
            { step: '03', title: 'Submit & get your code', desc: 'Review all photos, submit, and receive a reference code you can use to withdraw your data.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm grid place-items-center">
                {step}
              </div>
              <div>
                <div className="font-medium text-slate-900">{title}</div>
                <div className="text-sm text-slate-600 mt-1">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20 text-center">
        <Link href="/participate/profile">
          <button className="inline-flex items-center h-12 px-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            Start — it takes 5 minutes
          </button>
        </Link>
      </section>

      <footer className="border-t border-slate-200/60 py-8 text-center text-xs text-slate-500">
        Palm Research Study · Dataset Collection Platform · v2.0
      </footer>
    </main>
  );
}
