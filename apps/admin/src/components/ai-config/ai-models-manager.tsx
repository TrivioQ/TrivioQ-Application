'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
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

interface ProviderRef {
  id: string;
  name: string;
  displayName: string;
  protocol: string;
}

interface AiModel {
  id: string;
  providerId: string;
  provider: ProviderRef | null;
  displayName: string;
  description: string | null;
  modelName: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  defaultTemperature: number;
  extraParams: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyDraft = {
  providerId: '',
  displayName: '',
  description: '',
  modelName: '',
  contextWindow: '',
  maxOutputTokens: '',
  supportsVision: true,
  supportsJsonMode: true,
  defaultTemperature: 0.2,
  extraParams: '',
  isActive: true,
};

export function AiModelsManager() {
  const t = useTranslations('aiModels');
  const [models, setModels] = useState<AiModel[]>([]);
  const [providers, setProviders] = useState<ProviderRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AiModel | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/ai-models');
      const json = await res.json();
      if (json.success) setModels(json.data);
    } catch {
      toast.error(t('fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/ai-providers');
      const json = await res.json();
      if (json.success) {
        setProviders(json.data.map((p: ProviderRef & { isActive: boolean }) => ({ id: p.id, name: p.name, displayName: p.displayName, protocol: p.protocol })));
      }
    } catch {
      // providers list is best-effort for the dropdown
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchModels();
    void fetchProviders();
  }, [fetchModels, fetchProviders]);

  const providerOptions = providers.map((p) => ({ value: p.id, label: `${p.displayName} (${p.protocol})` }));

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft, providerId: providers[0]?.id ?? '' });
    setDialogOpen(true);
  };

  const openEdit = (m: AiModel) => {
    setEditing(m);
    setDraft({
      providerId: m.providerId,
      displayName: m.displayName,
      description: m.description ?? '',
      modelName: m.modelName,
      contextWindow: m.contextWindow?.toString() ?? '',
      maxOutputTokens: m.maxOutputTokens?.toString() ?? '',
      supportsVision: m.supportsVision,
      supportsJsonMode: m.supportsJsonMode,
      defaultTemperature: m.defaultTemperature,
      extraParams: m.extraParams ? JSON.stringify(m.extraParams, null, 2) : '',
      isActive: m.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!draft.providerId || !draft.displayName || !draft.modelName) {
      toast.error(t('requiredFields'));
      return;
    }

    let extraParamsParsed: Record<string, unknown> | null = null;
    if (draft.extraParams.trim()) {
      try {
        extraParamsParsed = JSON.parse(draft.extraParams);
      } catch {
        toast.error(t('invalidExtraParams'));
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        providerId: draft.providerId,
        displayName: draft.displayName,
        description: draft.description || null,
        modelName: draft.modelName,
        contextWindow: draft.contextWindow ? Number(draft.contextWindow) : null,
        maxOutputTokens: draft.maxOutputTokens ? Number(draft.maxOutputTokens) : null,
        supportsVision: draft.supportsVision,
        supportsJsonMode: draft.supportsJsonMode,
        defaultTemperature: Number(draft.defaultTemperature),
        extraParams: extraParamsParsed,
        isActive: draft.isActive,
      };

      const url = editing ? `/api/v1/admin/ai-models/${editing.id}` : '/api/v1/admin/ai-models';
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
      await fetchModels();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: AiModel) => {
    const confirmed = await confirm({
      title: t('deleteTitle'),
      message: t('deleteDescription', { name: m.displayName }),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/admin/ai-models/${m.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      toast.success(json.message || t('deleted'));
      await fetchModels();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('deleteFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} disabled={providers.length === 0}>
          <Plus className="h-4 w-4" />
          {t('addModel')}
        </Button>
      </div>

      {providers.length === 0 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-400">
          {t('noProvidersWarning')}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-3 px-4">{t('colModel')}</th>
              <th className="py-3 px-4">{t('colProvider')}</th>
              <th className="py-3 px-4">{t('colModelName')}</th>
              <th className="py-3 px-4">{t('colCapabilities')}</th>
              <th className="py-3 px-4">{t('colActive')}</th>
              <th className="py-3 px-4 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </td>
              </tr>
            ) : models.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  {t('noModels')}
                </td>
              </tr>
            ) : (
              models.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-medium text-foreground">{m.displayName}</p>
                    {m.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>}
                  </td>
                  <td className="py-3 px-4">
                    {m.provider ? (
                      <div>
                        <p className="text-xs font-medium">{m.provider.displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.provider.protocol}</p>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono break-all max-w-[220px]">{m.modelName}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-xs ${m.supportsVision ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>{t('vision')}</span>
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-xs ${m.supportsJsonMode ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>{t('json')}</span>
                      {m.extraParams && <span className="inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{t('extraParams')}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium ${m.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {m.isActive ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(m)} title={t('edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => void handleDelete(m)} title={t('delete')}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('editModel') : t('addModel')}</DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>{t('fieldProvider')}</Label>
              <AppSelect
                options={providerOptions}
                value={draft.providerId}
                onValueChange={(v) => setDraft({ ...draft, providerId: String(v) })}
                placeholder={t('placeholderProvider')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('fieldDisplayName')}</Label>
                <Input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="Mistral Small 4" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('fieldModelName')}</Label>
                <Input value={draft.modelName} onChange={(e) => setDraft({ ...draft, modelName: e.target.value })} placeholder="mistralai/mistral-small-4-119b-2603" className="font-mono text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('fieldContextWindow')}</Label>
                <Input type="number" value={draft.contextWindow} onChange={(e) => setDraft({ ...draft, contextWindow: e.target.value })} placeholder="128000" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('fieldMaxOutput')}</Label>
                <Input type="number" value={draft.maxOutputTokens} onChange={(e) => setDraft({ ...draft, maxOutputTokens: e.target.value })} placeholder="4096" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('fieldDefaultTemp')}</Label>
              <Input type="number" step="0.1" value={draft.defaultTemperature} onChange={(e) => setDraft({ ...draft, defaultTemperature: Number(e.target.value) })} placeholder="0.2" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('fieldVision')}</Label>
                <div className="flex items-center h-9">
                  <Switch checked={draft.supportsVision} onCheckedChange={(c) => setDraft({ ...draft, supportsVision: c })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('fieldJson')}</Label>
                <div className="flex items-center h-9">
                  <Switch checked={draft.supportsJsonMode} onCheckedChange={(c) => setDraft({ ...draft, supportsJsonMode: c })} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('fieldExtraParams')}</Label>
              <Textarea
                value={draft.extraParams}
                onChange={(e) => setDraft({ ...draft, extraParams: e.target.value })}
                placeholder='{ "chat_template_kwargs": { "thinking": false } }'
                className="font-mono text-xs"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t('hintExtraParams')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('fieldActive')}</Label>
                <div className="flex items-center h-9">
                  <Switch checked={draft.isActive} onCheckedChange={(c) => setDraft({ ...draft, isActive: c })} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('fieldDescription')}</Label>
              <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={t('placeholderDescription')} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{t('cancel')}</Button>
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
