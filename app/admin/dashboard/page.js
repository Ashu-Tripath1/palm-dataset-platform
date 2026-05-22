'use client';

import { useEffect, useState } from 'react';
import { Users, Camera, CheckCircle2, Clock, XCircle, TrendingUp } from 'lucide-react';

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 grid place-items-center min-h-[300px]">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Failed to load dashboard data. Make sure MongoDB is running.
      </div>
    );
  }

  const stats = [
    { label: 'Total Participants', value: data.total, icon: Users, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Submitted', value: data.submitted, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'In Progress', value: data.inProgress, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Rejected', value: data.rejected, icon: XCircle, color: 'bg-rose-50 text-rose-600' },
    { label: 'Today', value: data.today, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
    { label: 'Total Photos', value: data.totalPhotos, icon: Camera, color: 'bg-blue-50 text-blue-600' },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of Palm Research Dataset Collection</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${color} grid place-items-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{(value || 0).toLocaleString()}</div>
            <div className="text-sm text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gender breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Gender Breakdown</h2>
          {(data.genderBreakdown || []).length === 0 ? (
            <p className="text-slate-400 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {data.genderBreakdown.map(({ gender, count }) => {
                const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                const labels = {
                  MALE: 'Male', FEMALE: 'Female', OTHER: 'Other',
                  PREFER_NOT_TO_SAY: 'Prefer not to say',
                };
                return (
                  <div key={gender}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{labels[gender] || gender}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Countries */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Top Countries</h2>
          {(data.topCountries || []).length === 0 ? (
            <p className="text-slate-400 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {data.topCountries.slice(0, 8).map(({ country, count }) => {
                const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                return (
                  <div key={country} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 truncate flex-1 mr-2">{country || 'Unknown'}</span>
                    <span className="text-slate-500 flex-shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Professions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Top Professions</h2>
          {(data.topProfessions || []).length === 0 ? (
            <p className="text-slate-400 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {data.topProfessions.slice(0, 8).map(({ profession, count }) => (
                <div key={profession} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate flex-1 mr-2">{profession || 'Unknown'}</span>
                  <span className="text-slate-500 flex-shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
