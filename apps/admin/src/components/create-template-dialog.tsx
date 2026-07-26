'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppSelect } from '@/components/ui/app-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

import { useTranslations } from 'next-intl';

export function CreateTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('notifications.createTemplateModal');

  const [formData, setFormData] = useState({
    name: '',
    type: 'SYSTEM_ANNOUNCEMENT',
    title: '',
    body: '',
    emailSubject: '',
    channels: [] as string[],
    variables: [] as string[],
  });

  const [variableInput, setVariableInput] = useState('');

  const handleAddVariable = () => {
    if (variableInput.trim() && !formData.variables.includes(variableInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        variables: [...prev.variables, variableInput.trim()],
      }));
      setVariableInput('');
    }
  };

  const handleRemoveVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      variables: prev.variables.filter((v) => v !== variable),
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/notifications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to create');
      setOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error creating template:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleChannel = (channel: string) => {
    setFormData((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4 mr-2" />
        {t('trigger')}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label>{t('nameLabel')}</Label>
            <Input
              placeholder={t('namePlaceholder')}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          {/* Template Type */}
          <div className="space-y-2">
            <Label>{t('typeLabel')}</Label>
            <AppSelect
              value={formData.type}
              onValueChange={(value) => {
                if (value !== null) {
                  setFormData({ ...formData, type: value as string });
                }
              }}
              options={[
                { value: 'TRIVIA_DROP', label: t('types.triviaDrop') },
                { value: 'SYSTEM_ANNOUNCEMENT', label: t('types.systemAnnouncement') },
                { value: 'SUBSCRIPTION_REMINDER', label: t('types.subscriptionReminder') },
                { value: 'OFFER_PROMOTION', label: t('types.offerPromotion') },
                { value: 'CREDIT_ALERT', label: t('types.creditAlert') },
                { value: 'ADMIN_MESSAGE', label: t('types.adminMessage') },
              ]}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>{t('titleLabel')}</Label>
            <Input
              placeholder={t('titlePlaceholder')}
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>{t('messageBodyLabel')}</Label>
            <Textarea
              placeholder={t('messageBodyPlaceholder')}
              rows={4}
              value={formData.body}
              onChange={(e) =>
                setFormData({ ...formData, body: e.target.value })
              }
            />
          </div>

          {/* Email Subject */}
          <div className="space-y-2">
            <Label>{t('emailSubjectLabel')}</Label>
            <Input
              placeholder={t('emailSubjectPlaceholder')}
              value={formData.emailSubject}
              onChange={(e) =>
                setFormData({ ...formData, emailSubject: e.target.value })
              }
            />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <Label>{t('variablesLabel')}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('variablesPlaceholder')}
                value={variableInput}
                onChange={(e) => setVariableInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariable())}
              />
              <Button type="button" variant="outline" onClick={handleAddVariable}>
                {t('addVariable')}
              </Button>
            </div>
            {formData.variables.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.variables.map((v) => (
                  <Badge
                    key={v}
                    className="bg-purple-100 text-purple-800 cursor-pointer hover:bg-purple-200"
                    onClick={() => handleRemoveVariable(v)}
                  >
                    {`{{${v}}}`} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Channels */}
          <div className="space-y-2">
            <Label>{t('defaultDeliveryChannels')}</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.channels.includes('PUSH_MOBILE')}
                  onCheckedChange={() => toggleChannel('PUSH_MOBILE')}
                />
                <span className="text-sm flex items-center gap-1">
                  📱 {t('mobilePush')}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.channels.includes('PUSH_WEB')}
                  onCheckedChange={() => toggleChannel('PUSH_WEB')}
                />
                <span className="text-sm flex items-center gap-1">
                  🔔 {t('webPush')}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.channels.includes('EMAIL')}
                  onCheckedChange={() => toggleChannel('EMAIL')}
                />
                <span className="text-sm flex items-center gap-1">
                  📧 {t('email')}
                </span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t('creating') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Badge({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`} onClick={onClick}>
      {children}
    </span>
  );
}