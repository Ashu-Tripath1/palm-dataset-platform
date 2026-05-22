'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Hand, Loader2 } from 'lucide-react';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Bosnia','Brazil','Bulgaria',
  'Cambodia','Canada','Chile','China','Colombia','Croatia','Cyprus','Czech Republic','Denmark',
  'Ecuador','Egypt','Estonia','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece',
  'Guatemala','Honduras','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Japan','Jordan','Kazakhstan','Kenya','Kuwait','Latvia','Lebanon','Lithuania','Luxembourg',
  'Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan',
  'Panama','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia',
  'Senegal','Serbia','Singapore','Slovakia','South Africa','South Korea','Spain','Sri Lanka',
  'Sweden','Switzerland','Taiwan','Thailand','Tunisia','Turkey','UAE','Uganda','Ukraine',
  'United Kingdom','United States','Uruguay','Uzbekistan','Venezuela','Vietnam','Other'
];

const PROFESSIONS = [
  'Software Engineer','Doctor','Nurse','Teacher','Student','Farmer','Mechanic',
  'Construction Worker','Carpenter','Chef','Driver','Electrician','Plumber','Accountant',
  'Lawyer','Artist','Designer','Researcher','Scientist','Pharmacist','Hairdresser','Tailor',
  'Cleaner','Security Guard','Office Worker','Sales Associate','Manager','Engineer (other)',
  'Retired','Other',
];

export default function ProfilePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    age: '',
    gender: 'MALE',
    profession: '',
    country: '',
    email: '',
    consentGiven: false,
  });

  const validate = () => {
    const errs = {};
    const age = parseInt(form.age, 10);
    if (!form.age || isNaN(age) || age < 18 || age > 120) errs.age = 'Age must be between 18 and 120';
    if (!form.gender) errs.gender = 'Please select a gender';
    if (!form.profession || form.profession.length < 2) errs.profession = 'Please specify your profession';
    if (!form.country) errs.country = 'Please select your country';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.consentGiven) errs.consentGiven = 'Consent is required to participate';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: parseInt(form.age, 10),
          gender: form.gender,
          profession: form.profession,
          country: form.country,
          email: form.email || null,
          consentGiven: form.consentGiven,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to register');
      localStorage.setItem('palm_session', JSON.stringify({
        participantId: j.participantId,
        sessionToken: j.sessionToken,
        profile: form,
      }));
      localStorage.removeItem('palm_wizard_step');
      toast.success("Profile saved — let's start the photos!");
      router.push('/participate/photos');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (e) => {
    const val = e.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200/60 bg-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Hand className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium">Step 1 of 3 · Profile</span>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div className="h-full bg-indigo-600 transition-all" style={{ width: '33%' }} />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-xl">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h1 className="text-xl font-semibold text-slate-900">Tell us about you</h1>
            <p className="text-sm text-slate-500 mt-1">
              This metadata is used in aggregate for research. Required fields are marked.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Age */}
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-slate-700 mb-1">
                Age <span className="text-rose-500">*</span>
              </label>
              <input
                id="age"
                type="number"
                min={18}
                max={120}
                value={form.age}
                onChange={set('age')}
                placeholder="e.g. 28"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.age && <p className="text-xs text-rose-500 mt-1">{errors.age}</p>}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Gender <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['MALE', 'Male'],
                  ['FEMALE', 'Female'],
                  ['OTHER', 'Other'],
                  ['PREFER_NOT_TO_SAY', 'Prefer not to say'],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors text-sm ${
                      form.gender === value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gender"
                      value={value}
                      checked={form.gender === value}
                      onChange={() => set('gender')(value)}
                      className="accent-indigo-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {errors.gender && <p className="text-xs text-rose-500 mt-1">{errors.gender}</p>}
            </div>

            {/* Profession */}
            <div>
              <label htmlFor="profession" className="block text-sm font-medium text-slate-700 mb-1">
                Profession <span className="text-rose-500">*</span>
              </label>
              <input
                id="profession"
                list="profession-list"
                placeholder="e.g. Software Engineer"
                value={form.profession}
                onChange={set('profession')}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <datalist id="profession-list">
                {PROFESSIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
              {errors.profession && <p className="text-xs text-rose-500 mt-1">{errors.profession}</p>}
            </div>

            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-slate-700 mb-1">
                Country <span className="text-rose-500">*</span>
              </label>
              <select
                id="country"
                value={form.country}
                onChange={set('country')}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                <option value="">Select your country</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.country && <p className="text-xs text-rose-500 mt-1">{errors.country}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-slate-400 text-xs font-normal">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Optional — used only to send you your submission reference.
              </p>
              {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email}</p>}
            </div>

            {/* Consent */}
            <div className="rounded-md border border-slate-200 bg-white p-3 flex items-start gap-3">
              <input
                id="consent"
                type="checkbox"
                checked={form.consentGiven}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, consentGiven: e.target.checked }));
                  if (errors.consentGiven) setErrors((prev) => ({ ...prev, consentGiven: undefined }));
                }}
                className="mt-0.5 accent-indigo-600 w-4 h-4 flex-shrink-0"
              />
              <label htmlFor="consent" className="text-sm text-slate-700 leading-relaxed">
                I agree to the terms of this study. My photos will be used for AI research. I confirm
                the hand is my own and I am 18+. I understand I can request data withdrawal at any
                time using my reference code.
              </label>
            </div>
            {errors.consentGiven && (
              <p className="text-xs text-rose-500 -mt-3">{errors.consentGiven}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Saving…' : 'Start Photo Submission'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
