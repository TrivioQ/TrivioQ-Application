'use client';

import { useEffect, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Sparkles } from 'lucide-react';

import { useTranslations } from 'next-intl';

interface Template {
  id: string;
  name: string;
  title: string;
  body: string;
  variables: string[];
}

export function CreateNotificationDialog() {
  const [open, setOpen] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('notifications.createModal');

  useEffect(() => {
    if (open) {
      fetch('/api/admin/notifications/templates')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTemplates(data);
          }
        })
        .catch((err) => console.error('Failed to fetch templates:', err));
    }
  }, [open]);

  const [formData, setFormData] = useState({
    type: 'SYSTEM_ANNOUNCEMENT',
    audience: 'ALL_USERS',
    title: '',
    body: '',
    channels: [] as string[],
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          channels: formData.channels.length > 0 ? formData.channels : ['PUSH_MOBILE'],
        }),
      });
      if (!response.ok) throw new Error('Failed to create');
      setOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error creating notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = async (templateId: string | null) => {
    if (!templateId) return;
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        title: template.title,
        body: template.body,
      });
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
          {/* Template Toggle */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="use-template"
              checked={useTemplate}
              onChange={(e) => setUseTemplate(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="use-template" className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              {t('useTemplate')}
            </label>
          </div>

          {useTemplate && (
            <div className="space-y-2">
              <Label>{t('templateLabel')}</Label>
              <Select onValueChange={handleTemplateSelect} value={selectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectTemplatePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="welcome">{t('templateOptions.welcome')}</SelectItem>
                  <SelectItem value="subscription-expiring-7d">
                    {t('templateOptions.subscriptionExpiring7d')}
                  </SelectItem>
                  <SelectItem value="subscription-expiring-1d">
                    {t('templateOptions.subscriptionExpiring1d')}
                  </SelectItem>
                  <SelectItem value="credits-added">{t('templateOptions.creditsAdded')}</SelectItem>
                  <SelectItem value="offer-promotion">{t('templateOptions.offerPromotion')}</SelectItem>
                  <SelectItem value="leaderboard-winner">{t('templateOptions.leaderboardWinner')}</SelectItem>
                  <SelectItem value="admin-message">{t('templateOptions.adminMessage')}</SelectItem>
                  <SelectItem value="new-feature-announcement">
                    {t('templateOptions.newFeatureAnnouncement')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notification Type */}
          <div className="space-y-2">
            <Label>{t('typeLabel')}</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => {
                if (value !== null) {
                  setFormData({ ...formData, type: value });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRIVIA_DROP">{t('types.triviaDrop')}</SelectItem>
                <SelectItem value="SYSTEM_ANNOUNCEMENT">
                  {t('types.systemAnnouncement')}
                </SelectItem>
                <SelectItem value="SUBSCRIPTION_REMINDER">
                  {t('types.subscriptionReminder')}
                </SelectItem>
                <SelectItem value="OFFER_PROMOTION">{t('types.offerPromotion')}</SelectItem>
                <SelectItem value="CREDIT_ALERT">{t('types.creditAlert')}</SelectItem>
                <SelectItem value="ADMIN_MESSAGE">{t('types.adminMessage')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <Label>{t('audienceLabel')}</Label>
            <Select
              value={formData.audience}
              onValueChange={(value) => {
                if (value !== null) {
                  setFormData({ ...formData, audience: value });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_USERS">{t('audiences.allUsers')}</SelectItem>
                <SelectItem value="USER_SEGMENT">{t('audiences.userSegment')}</SelectItem>
                <SelectItem value="SPECIFIC_USERS">{t('audiences.specificUsers')}</SelectItem>
              </SelectContent>
            </Select>
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
            <Label>{t('messageLabel')}</Label>
            <Textarea
              placeholder={t('messagePlaceholder')}
              rows={4}
              value={formData.body}
              onChange={(e) =>
                setFormData({ ...formData, body: e.target.value })
              }
            />
          </div>

          {/* Channels */}
          <div className="space-y-2">
            <Label>{t('deliveryChannels')}</Label>
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