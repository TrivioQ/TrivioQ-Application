'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2, History } from 'lucide-react';
import { searchUsersByUsername, getSubscriptionHistory } from '@/app/actions/user-actions';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

type UserSuggestion = {
  id: string;
  username: string;
  email: string;
  subscriptionTier: string;
};

type HistoryRow = {
  id: string;
  tier: string;
  source: string;
  startedAt: Date | string;
  expiresAt: Date | string | null;
  createdAt: Date | string;
};

type HistoryResult = {
  success: boolean;
  data: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(val: Date | string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TIER_STYLES: Record<string, string> = {
  PREMIUM: 'bg-amber-100 text-amber-800',
  PLUS:    'bg-purple-100 text-purple-800',
  FREE:    'bg-gray-100 text-gray-600',
};

const SOURCE_LABELS: Record<string, string> = {
  VAULT_ACTIVATION: 'Vault Activation',
  ADMIN_GRANT:      'Admin Grant',
  PURCHASE:         'Purchase',
  LEADERBOARD:      'Leaderboard',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SubscriptionHistoryExplorer() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [page, setPage] = useState(1);

  const [isSearching, startSearch] = useTransition();
  const [isLoading, startLoad] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const result = await searchUsersByUsername(val);
        setSuggestions(result.data ?? []);
      });
    }, 300);
  }

  function handleSelect(user: UserSuggestion) {
    setSelectedUser(user);
    setQuery(user.username);
    setShowDropdown(false);
    setSuggestions([]);
    loadHistory(user.id, 1);
  }

  function loadHistory(userId: string, targetPage: number) {
    startLoad(async () => {
      const result = await getSubscriptionHistory(userId, targetPage);
      setHistory(result as HistoryResult);
      setPage(targetPage);
    });
  }

  function handlePageChange(next: number) {
    if (!selectedUser) return;
    loadHistory(selectedUser.id, next);
  }

  return (
    <div className="space-y-6">
      {/* ── Search box ──────────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative w-full max-w-md">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder="Search by username…"
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-gray-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {showDropdown && (query.trim().length > 0) && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.length === 0 && !isSearching && (
              <p className="px-4 py-3 text-sm text-gray-500">No users found.</p>
            )}
            {suggestions.map((user) => (
              <button
                key={user.id}
                onMouseDown={() => handleSelect(user)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left gap-4"
              >
                <div>
                  <span className="font-medium text-gray-900">{user.username}</span>
                  <span className="ml-2 text-gray-400 text-xs">{user.email}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_STYLES[user.subscriptionTier] ?? 'bg-gray-100 text-gray-600'}`}>
                  {user.subscriptionTier}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── History table ────────────────────────────────────────────────── */}
      {!selectedUser && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <History className="h-10 w-10 opacity-40" />
          <p className="text-sm">Search for a user to view their subscription history.</p>
        </div>
      )}

      {selectedUser && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800">
              History for <span className="text-blue-600">@{selectedUser.username}</span>
            </h2>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>

          <div className={`rounded-lg border bg-white overflow-hidden transition-opacity duration-150 ${isLoading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Tier', 'Source', 'Started At', 'Expires At', 'Recorded At'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                      No subscription history found for this user.
                    </td>
                  </tr>
                )}
                {history?.data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${TIER_STYLES[row.tier] ?? 'bg-gray-100 text-gray-600'}`}>
                        {row.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{SOURCE_LABELS[row.source] ?? row.source}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(row.startedAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(row.expiresAt)}</td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {history && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {history.total > 0
                  ? `Showing ${(page - 1) * history.pageSize + 1}–${Math.min(page * history.pageSize, history.total)} of ${history.total}`
                  : '0 records'}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || isLoading}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-sm text-gray-600 font-medium">
                  {page} / {history.totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= history.totalPages || isLoading}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
