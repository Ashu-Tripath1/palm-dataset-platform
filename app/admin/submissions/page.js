'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search, Filter, ChevronLeft, ChevronRight, CheckCircle2,
  Clock, XCircle, AlertCircle, Eye, Trash2
} from 'lucide-react';

const STATUS_CONFIG = {
  SUBMITTED: { label: 'Submitted', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock, className: 'bg-amber-100 text-amber-700' },
  REJECTED: { label: 'Rejected', icon: XCircle, className: 'bg-rose-100 text-rose-700' },
};

export default function AdminSubmissionsPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', gender: '', search: '' });
  const [deleting, setDeleting] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filters.status) params.set('status', filters.status);
    if (filters.gender) params.set('gender', filters.gender);
    if (filters.search) params.set('search', filters.search);
    try {
      const res = await fetch(`/api/admin/submissions?${params}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this submission and all photos? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Submission deleted');
      fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      toast.success('Status updated');
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Submissions</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data ? `${data.total.toLocaleString()} total participants` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, profession, country…"
            value={filters.search}
            onChange={(e) => { setFilters((p) => ({ ...p, search: e.target.value })); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => { setFilters((p) => ({ ...p, status: e.target.value })); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={filters.gender}
          onChange={(e) => { setFilters((p) => ({ ...p, gender: e.target.value })); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">All genders</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
          <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 grid place-items-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data?.items?.length ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No submissions found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Age/Gender</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Profession</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Country</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Photos</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item) => {
                    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.IN_PROGRESS;
                    const StatusIcon = status.icon;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {item.id.slice(0, 8).toUpperCase()}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.age} / {item.gender?.charAt(0)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-32 truncate">{item.profession}</td>
                        <td className="px-4 py-3 text-slate-700">{item.country}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${item.photoCount >= 12 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {item.photoCount}/12
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${status.className}`}
                          >
                            <option value="SUBMITTED">Submitted</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => router.push(`/admin/submissions/${item.id}`)}
                              className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 transition-colors"
                              title="View detail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deleting === item.id}
                              className="p-1.5 rounded hover:bg-rose-50 text-rose-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={data.page <= 1}
                    className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={data.page >= data.totalPages}
                    className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
