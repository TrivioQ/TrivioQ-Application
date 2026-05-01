'use client';

import { useState, useTransition } from 'react';
import { updateUser } from '@/app/actions/user-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubscriptionTier } from '@trivioq/database';
import type { UserRow } from './columns';

function toTimeString(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function timeToDateTime(time: string): string {
  const now = new Date();
  const [h, m] = time.split(':').map(Number);
  now.setHours(h, m, 0, 0);
  return now.toISOString();
}

export function UserModal({ user, open, onOpenChange }: { user: UserRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>(user.subscriptionTier);
  const [activeWindowStart, setActiveWindowStart] = useState(toTimeString(user.activeWindowStart));
  const [activeWindowEnd, setActiveWindowEnd] = useState(toTimeString(user.activeWindowEnd));
  const [onDemandTokens, setOnDemandTokens] = useState(String(user.onDemandTokens));

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEmail(user.email);
      setUsername(user.username);
      setDisplayName(user.displayName ?? '');
      setDateOfBirth(user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
      setSubscriptionTier(user.subscriptionTier);
      setActiveWindowStart(toTimeString(user.activeWindowStart));
      setActiveWindowEnd(toTimeString(user.activeWindowEnd));
      setOnDemandTokens(String(user.onDemandTokens));
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateUser(user.id, {
        email,
        username,
        displayName: displayName || undefined,
        dateOfBirth: dateOfBirth || undefined,
        subscriptionTier,
        activeWindowStart: activeWindowStart ? timeToDateTime(activeWindowStart) : new Date().toISOString(),
        activeWindowEnd: activeWindowEnd ? timeToDateTime(activeWindowEnd) : new Date().toISOString(),
        onDemandTokens: parseInt(onDemandTokens, 10) || 0,
      });
      if (res.success) {
        onOpenChange(false);
      } else {
        alert(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" required value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input id="dateOfBirth" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Subscription Tier</Label>
            <Select value={subscriptionTier} onValueChange={(v) => setSubscriptionTier(v as SubscriptionTier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="PREMIUM">Premium</SelectItem>
                <SelectItem value="PLUS">Plus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activeWindowStart">Active Window Start</Label>
              <Input id="activeWindowStart" type="time" value={activeWindowStart} onChange={e => setActiveWindowStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activeWindowEnd">Active Window End</Label>
              <Input id="activeWindowEnd" type="time" value={activeWindowEnd} onChange={e => setActiveWindowEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="onDemandTokens">On-Demand Tokens</Label>
            <Input id="onDemandTokens" type="number" min="0" value={onDemandTokens} onChange={e => setOnDemandTokens(e.target.value)} />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
