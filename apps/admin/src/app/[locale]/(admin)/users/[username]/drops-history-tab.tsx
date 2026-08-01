'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getUserDrops, overrideUserDropResponse } from '@/app/actions/drop-override-actions';

interface DropsHistoryTabProps {
  userId: string;
}

export function DropsHistoryTab({ userId }: DropsHistoryTabProps) {
  const t = useTranslations('users.dropsHistory');
  const [drops, setDrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDrop, setSelectedDrop] = useState<any | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideChoiceId, setOverrideChoiceId] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDrops = async (p: number) => {
    setLoading(true);
    const result = await getUserDrops(userId, p, 20);
    if (result.success && result.data) {
      setDrops(result.data.drops);
      setTotalPages(result.data.totalPages);
      setPage(p);
    } else {
      toast.error(t('fetchError'));
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDrops(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleEditClick = (drop: any) => {
    setSelectedDrop(drop);
    setOverrideChoiceId(drop.selectedChoiceId || '');
    setOverrideReason('');
    setIsOverrideModalOpen(true);
  };

  const handleOverrideSubmit = async () => {
    if (!selectedDrop) return;
    if (!overrideChoiceId) {
      toast.error(t('selectChoiceError'));
      return;
    }
    if (!overrideReason.trim()) {
      toast.error(t('reasonRequiredError', { defaultValue: 'Reason is required' }));
      return;
    }

    setIsSubmitting(true);
    const result = await overrideUserDropResponse(selectedDrop.id, overrideChoiceId, overrideReason.trim());
    setIsSubmitting(false);

    if (result.success) {
      toast.success(t('overrideSuccess'));
      setIsOverrideModalOpen(false);
      fetchDrops(page); // Refresh current page
    } else {
      toast.error(result.error || t('overrideError'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('question')}</TableHead>
                <TableHead>{t('difficulty')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('points')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : drops.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                    {t('noDropsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                drops.map((drop) => (
                  <TableRow key={drop.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(drop.scheduledDropTime).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" title={drop.question.questionText}>
                      {drop.question.questionText}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{drop.question.difficultyLevel}</Badge>
                    </TableCell>
                    <TableCell>
                      {!drop.isAnswered ? (
                        <Badge variant="secondary">{t('unanswered')}</Badge>
                      ) : drop.wasCorrect ? (
                        <Badge className="bg-green-500 hover:bg-green-600">{t('correct')}</Badge>
                      ) : (
                        <Badge variant="destructive">{t('incorrect')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{drop.pointsAwarded}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditClick(drop)}>
                        {t('edit')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        {totalPages > 0 && (
          <div className="flex items-center justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDrops(page - 1)}
              disabled={page === 1 || loading}
            >
              {t('previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('pageOf', { current: page, total: Math.max(1, totalPages) })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDrops(page + 1)}
              disabled={page === totalPages || loading || totalPages === 0}
            >
              {t('next')}
            </Button>
          </div>
        )}

        {/* Override Modal */}
        <Dialog open={isOverrideModalOpen} onOpenChange={setIsOverrideModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{t('overrideModalTitle')}</DialogTitle>
              <DialogDescription>
                {t('overrideModalDescription')}
              </DialogDescription>
            </DialogHeader>
            
            {selectedDrop && (
              <div className="space-y-4 py-4">
                <div className="bg-muted p-4 rounded-md">
                  <p className="font-medium">{selectedDrop.question.questionText}</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">{t('selectOverrideAnswer')}</h4>
                  <RadioGroup value={overrideChoiceId} onValueChange={setOverrideChoiceId}>
                    {selectedDrop.question.choices.map((choice: any) => (
                      <div key={choice.id} className={`flex items-center space-x-2 border p-3 rounded-md ${choice.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}>
                        <RadioGroupItem value={choice.id} id={choice.id} />
                        <Label htmlFor={choice.id} className="flex-1 cursor-pointer">
                          {choice.text} {choice.isCorrect && <span className="text-green-600 font-bold ml-2">({t('actualCorrectAnswer')})</span>}
                          {choice.id === selectedDrop.selectedChoiceId && <span className="text-blue-600 ml-2">({t('userSelection')})</span>}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2 mt-4">
                  <Label htmlFor="override-reason">{t('reasonLabel', { defaultValue: 'Reason for Override' })} <span className="text-destructive">*</span></Label>
                  <Textarea 
                    id="override-reason" 
                    value={overrideReason} 
                    onChange={(e) => setOverrideReason(e.target.value)} 
                    placeholder={t('reasonPlaceholder', { defaultValue: 'Enter the reason for this change' })} 
                    rows={3} 
                  />
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOverrideModalOpen(false)} disabled={isSubmitting}>
                {t('cancel')}
              </Button>
              <Button onClick={handleOverrideSubmit} disabled={isSubmitting || !overrideChoiceId}>
                {isSubmitting ? t('saving') : t('saveOverride')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
