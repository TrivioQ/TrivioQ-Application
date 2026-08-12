'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AppSelect } from '@/components/ui/app-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';

type Protocol = 'openai' | 'anthropic' | 'gemini' | 'local_form';

interface AiProvider {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  protocol: Protocol;
  baseUrl: string | null;
  apiKeyMasked: string | null;
  apiKeySet: boolean;
  defaultHeaders: Record<string, string> | null;
  minCallIntervalMs: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const PROTOCOL_OPTIONS = [
  { value: 'openai', label: 'OpenAI-compatible' },
  { value: 'gemini', label: 'Google Gemini (native)' },
  { value: 'anthropic', label: 'Anthropic (stub)' },
  { value: 'local_form', label: 'Local (multipart form)' },
];

const emptyDraft = {
  name: '',
  displayName: '',
  description: '',
  protocol: 'openai' as Protocol,
  baseUrl: '',
  apiKey: '',
  defaultHeaders: '',
  minCallIntervalMs: 0,
  isActive: true,
};

export function AiProvidersManager() {
  const t = useTranslations('aiProviders');
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AiProvider | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const confirm = useConfirm();

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/ai-providers');
      const json = await res.json();
      if (json.success) setProviders(json.data);
    } catch {
      toast.error(t('fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProviders();
  }, [fetchProviders]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setDialogOpen(true);
  };

  const openEdit = (p: AiProvider) => {
    setEditing(p);
    setDraft({
      name: p.name,
      displayName: p.displayName,
      description: p.description ?? '',
      protocol: p.protocol,
      baseUrl: p.baseUrl ?? '',
      apiKey: '',
      defaultHeaders: p.defaultHeaders ? JSON.stringify(p.defaultHeaders, null, 2) : '',
      minCallIntervalMs: p.minCallIntervalMs,
      isActive: p.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!draft.name || !draft.displayName) {
      toast.error(t('requiredFields'));
      return;
    }

    let defaultHeadersParsed: Record<string, string> | null = null;
    if (draft.defaultHeaders.trim()) {
      try {
        defaultHeadersParsed = JSON.parse(draft.defaultHeaders);
      } catch {
        toast.error(t('invalidHeaders'));
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: draft.name,
        displayName: draft.displayName,
        description: draft.description || null,
        protocol: draft.protocol,
        baseUrl: draft.baseUrl || null,
        defaultHeaders: defaultHeadersParsed,
        minCallIntervalMs: Number(draft.minCallIntervalMs) || 0,
        isActive: draft.isActive,
      };
      if (draft.apiKey) body.apiKey = draft.apiKey;

      const url = editing ? `/api/v1/admin/ai-providers/${editing.id}` : '/api/v1/admin/ai-providers';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Save failed');
      }
      toast.success(editing ? t('updated') : t('created'));
      setDialogOpen(false);
      await fetchProviders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: AiProvider) => {
    const confirmed = await confirm({
      title: t('deleteTitle'),
      message: t('deleteDescription', { name: p.displayName }),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${p.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      toast.success(json.message || t('deleted'));
      await fetchProviders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('deleteFailed'));
    }
  };

  const handleTest = async (p: AiProvider) => {
    setTestingId(p.id);
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${p.id}/test`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
      } else {
        toast.error(json.message || t('testFailed'));
      }
    } catch {
      toast.error(t('testFailed'));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('addProvider')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-3 px-4">{t('colName')}</th>
              <th className="py-3 px-4">{t('colProtocol')}</th>
              <th className="py-3 px-4">{t('colBaseUrl')}</th>
              <th className="py-3 px-4">{t('colKey')}</th>
              <th className="py-3 px-4">{t('colMinInterval')}</th>
              <th className="py-3 px-4">{t('colActive')}</th>
              <th className="py-3 px-4 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </td>
              </tr>
            ) : providers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  {t('noProviders')}
                </td>
              </tr>
            ) : (
              providers.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-medium text-foreground">{p.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {p.protocol}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground font-mono break-all max-w-[200px]">
                    {p.baseUrl || '—'}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono">
                    {p.apiKeySet ? <span className="text-green-600 dark:text-green-400">{p.apiKeyMasked}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 px-4 text-xs">{p.minCallIntervalMs}ms</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium ${p.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {p.isActive ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleTest(p)} disabled={testingId === p.id} title={t('testConnection')}>
                        {testingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} title={t('edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => void handleDelete(p)} title={t('delete')}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('editProvider') : t('addProvider')}</DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('fieldName')}</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="google"
                  disabled={Boolean(editing)}
                />
                <p className="text-xs text-muted-foreground">{t('hintName')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('fieldDisplayName')}</Label>
                <Input
                  value={draft.displayName}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  placeholder="Google Gemini"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('fieldProtocol')}</Label>
              <AppSelect
                options={PROTOCOL_OPTIONS}
                value={draft.protocol}
                onValueChange={(v) => setDraft({ ...draft, protocol: v as Protocol })}
              />
              <p className="text-xs text-muted-foreground">{t('hintProtocol')}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('fieldBaseUrl')}</Label>
              <Input
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                placeholder="https://integrate.api.nvidia.com/v1"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('fieldApiKey')}</Label>
              <Input
                type="password"
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder={editing ? t('placeholderKeepKey') : t('placeholderEnterKey')}
              />
              <p className="text-xs text-muted-foreground">
                {editing && editing.apiKeySet ? t('hintKeyExists', { masked: editing.apiKeyMasked ?? '' }) : t('hintKeyNew')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('fieldHeaders')}</Label>
              <Textarea
                value={draft.defaultHeaders}
                onChange={(e) => setDraft({ ...draft, defaultHeaders: e.target.value })}
                placeholder='{ "X-Custom-Header": "value" }'
                className="font-mono text-xs"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('fieldMinInterval')}</Label>
                <Input
                  type="number"
                  value={draft.minCallIntervalMs}
                  onChange={(e) => setDraft({ ...draft, minCallIntervalMs: Number(e.target.value) })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">{t('hintMinInterval')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('fieldActive')}</Label>
                <div className="flex items-center h-9">
                  <Switch checked={draft.isActive} onCheckedChange={(c) => setDraft({ ...draft, isActive: c })} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('fieldDescription')}</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t('placeholderDescription')}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
