'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, Filter } from 'lucide-react';

export default function ExportPage() {
  const [filters, setFilters] = useState({ status: '', gender: '', dateFrom: '', dateTo: '' });
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.gender) params.set('gender', filters.gender);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const res = await fetch(`/api/admin/export?${params}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `palm-dataset-export-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Export Dataset</h1>
        <p className="text-slate-500 text-sm mt-1">
          Download a ZIP containing all photos and a CSV metadata file.
        </p>
      </div>

      <div className="max-w-lg bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="w-4 h-4 text-indigo-600" />
          <h2 className="font-semibold text-slate-800">Filter by (optional)</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
            <select
              value={filters.gender}
              onChange={(e) => setFilters((p) => ({ ...p, gender: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500 mb-4">
            The ZIP will contain:
            <ul className="mt-1 space-y-0.5 ml-4 list-disc">
              <li><code>metadata.csv</code> — participant info and photo counts</li>
              <li><code>photos_manifest.csv</code> — photo metadata and file paths</li>
              <li><code>images/</code> — all palm photos organized by participant ID</li>
            </ul>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {exporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating ZIP…</>
            ) : (
              <><Download className="w-4 h-4" /> Download ZIP Export</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
