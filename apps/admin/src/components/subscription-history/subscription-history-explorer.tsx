'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, History } from 'lucide-react';
import { searchUsersByUsername, getSubscriptionHistory } from '@/app/actions/user-actions';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

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
  PREMIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  PLUS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  FREE: 'bg-muted text-muted-foreground',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SubscriptionHistoryExplorer() {
  const t = useTranslations('subscriptionHistory');

  const sourceLabels: Record<string, string> = {
    VAULT_ACTIVATION: t('sources.vaultActivation'),
    ADMIN_GRANT: t('sources.adminGrant'),
    PURCHASE: t('sources.purchase'),
    LEADERBOARD: t('sources.leaderboard'),
  };

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [page, setPage] = useState(1);

  const [isSearching, setIsSearching] = useState(false);
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

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const result = await searchUsersByUsername(val);
      setSuggestions(result.data ?? []);
      setIsSearching(false);
    }, 400);
  }, []);

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

  const columnHeaders = [t('columns.tier'), t('columns.source'), t('columns.startedAt'), t('columns.expiresAt'), t('columns.recordedAt')];

  return (
    <div className="space-y-6">
      {/* ── Search box ──────────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative w-full max-w-md">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />}
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors placeholder:text-muted-foreground"
          />
        </div>

        {showDropdown && query.trim().length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {suggestions.length === 0 && !isSearching && <p className="px-4 py-3 text-sm text-muted-foreground">{t('noUsersFound')}</p>}
            {suggestions.map((user) => (
              <button key={user.id} onMouseDown={() => handleSelect(user)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left gap-4">
                <div>
                  <span className="font-medium text-foreground">{user.username}</span>
                  <span className="ml-2 text-muted-foreground text-xs">{user.email}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_STYLES[user.subscriptionTier] ?? 'bg-muted text-muted-foreground'}`}>{user.subscriptionTier}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── History table ────────────────────────────────────────────────── */}
      {!selectedUser && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <History className="h-10 w-10 opacity-40" />
          <p className="text-sm">{t('searchPrompt')}</p>
        </div>
      )}

      {selectedUser && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {t('historyFor')} <span className="text-brand-interactive">@{selectedUser.username}</span>
            </h2>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className={`rounded-lg border border-border bg-background overflow-hidden transition-opacity duration-150 ${isLoading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {columnHeaders.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                      {t('noHistory')}
                    </td>
                  </tr>
                )}
                {history?.data.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${TIER_STYLES[row.tier] ?? 'bg-muted text-muted-foreground'}`}>{row.tier}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">{sourceLabels[row.source] ?? row.source}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.startedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.expiresAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {history && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{history.total > 0 ? t('showing', { from: (page - 1) * history.pageSize + 1, to: Math.min(page * history.pageSize, history.total), total: history.total }) : t('noRecords')}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => handlePageChange(1)} disabled={page <= 1 || isLoading}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || isLoading}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground font-medium px-2">
                  {history.total === 0 ? 0 : page} / {history.total === 0 ? 0 : history.totalPages}
                </span>
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => handlePageChange(page + 1)} disabled={page >= history.totalPages || isLoading}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => handlePageChange(history.totalPages)} disabled={page >= history.totalPages || isLoading}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
