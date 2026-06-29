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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

export function CreateTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
        New Template
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Notification Template</DialogTitle>
          <DialogDescription>
            Create a reusable template with variable placeholders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input
              placeholder="e.g., subscription-expiring-7d"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          {/* Template Type */}
          <div className="space-y-2">
            <Label>Type</Label>
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
                <SelectItem value="TRIVIA_DROP">Trivia Drop</SelectItem>
                <SelectItem value="SYSTEM_ANNOUNCEMENT">
                  System Announcement
                </SelectItem>
                <SelectItem value="SUBSCRIPTION_REMINDER">
                  Subscription Reminder
                </SelectItem>
                <SelectItem value="OFFER_PROMOTION">Offer Promotion</SelectItem>
                <SelectItem value="CREDIT_ALERT">Credit Alert</SelectItem>
                <SelectItem value="ADMIN_MESSAGE">Admin Message</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Title (supports variables)</Label>
            <Input
              placeholder="e.g., Your subscription expires in {{daysRemaining}} days"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Message Body (supports variables)</Label>
            <Textarea
              placeholder="Enter the notification message"
              rows={4}
              value={formData.body}
              onChange={(e) =>
                setFormData({ ...formData, body: e.target.value })
              }
            />
          </div>

          {/* Email Subject */}
          <div className="space-y-2">
            <Label>Email Subject (optional, supports variables)</Label>
            <Input
              placeholder="e.g., Don't miss out! Expires in {{daysRemaining}} days"
              value={formData.emailSubject}
              onChange={(e) =>
                setFormData({ ...formData, emailSubject: e.target.value })
              }
            />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <Label>Variables</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., userName, expiryDate"
                value={variableInput}
                onChange={(e) => setVariableInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariable())}
              />
              <Button type="button" variant="outline" onClick={handleAddVariable}>
                Add
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
            <Label>Default Delivery Channels</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.channels.includes('PUSH_MOBILE')}
                  onCheckedChange={() => toggleChannel('PUSH_MOBILE')}
                />
                <span className="text-sm flex items-center gap-1">
                  📱 Mobile Push
                </span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.channels.includes('PUSH_WEB')}
                  onCheckedChange={() => toggleChannel('PUSH_WEB')}
                />
                <span className="text-sm flex items-center gap-1">
                  🔔 Web Push
                </span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.channels.includes('EMAIL')}
                  onCheckedChange={() => toggleChannel('EMAIL')}
                />
                <span className="text-sm flex items-center gap-1">
                  📧 Email
                </span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Template'}
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