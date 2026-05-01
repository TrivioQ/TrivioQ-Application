'use client';

import { useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DayPicker } from 'react-day-picker';
import { format, startOfDay } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  periodType: z.enum(['WEEK', 'MONTH']),
  rewardType: z.enum(['POINTS', 'PREMIUM_DAYS']),
  startDate: z.date().refine((d) => d instanceof Date && !isNaN(d.getTime()), {
    message: 'Start date is required',
  }),
  payoutValues: z
    .array(z.object({ value: z.number().int().min(0, 'Must be ≥ 0') }))
    .min(1)
    .max(10),
});

type FormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeWeekEnd(monday: Date): Date {
  const y = monday.getFullYear();
  const m = monday.getMonth();
  const d = monday.getDate();
  return new Date(Date.UTC(y, m, d + 6, 23, 59, 59, 999));
}

function computeMonthEnd(firstOfMonth: Date): Date {
  const y = firstOfMonth.getFullYear();
  const mo = firstOfMonth.getMonth();
  return new Date(Date.UTC(y, mo + 1, 0, 23, 59, 59, 999));
}

// ── Inline DayPicker class names (shadcn-style) ───────────────────────────────

const pickerClassNames = {
  root: 'p-3',
  months: 'flex flex-col',
  month: 'space-y-4',
  month_caption: 'flex justify-center items-center h-7 relative overflow-visible',
  caption_label: 'text-sm font-medium',
  nav: 'flex items-center gap-1',
  button_previous:
    'absolute left-1 top-[10px] z-[1] h-7 w-7 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted',
  button_next:
    'absolute right-1 top-[10px] z-[1] h-7 w-7 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'text-muted-foreground w-9 text-center text-[0.8rem] font-normal',
  weeks: 'flex flex-col gap-y-1',
  week: 'flex w-full',
  day: 'h-9 w-9 text-center text-sm p-0 relative',
  day_button:
    'h-9 w-9 inline-flex items-center justify-center rounded-md text-sm font-normal hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  selected: 'bg-primary text-primary-foreground hover:!bg-primary hover:!text-primary-foreground rounded-md',
  today: 'bg-muted text-foreground',
  outside: 'opacity-40',
  disabled: 'opacity-30 cursor-not-allowed pointer-events-none',
  hidden: 'invisible',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BonusPlanInitialValues {
  id: string;
  title: string;
  periodType: 'WEEK' | 'MONTH';
  rewardType: 'POINTS' | 'PREMIUM_DAYS';
  startDate: Date;
  payoutValues: number[];
}

interface BonusPlanFormProps {
  initialValues?: BonusPlanInitialValues;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BonusPlanForm({ initialValues, onSuccess, onCancel }: BonusPlanFormProps) {
  const isEdit = !!initialValues;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: initialValues
      ? {
          title: initialValues.title,
          periodType: initialValues.periodType,
          rewardType: initialValues.rewardType,
          startDate: initialValues.startDate,
          payoutValues: initialValues.payoutValues.map((v) => ({ value: v })),
        }
      : {
          periodType: 'WEEK',
          rewardType: 'POINTS',
          payoutValues: [{ value: 0 }, { value: 0 }, { value: 0 }],
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'payoutValues' });

  const periodType = useWatch({ control, name: 'periodType' });
  const startDate = useWatch({ control, name: 'startDate' });

  const endDate =
    startDate && periodType === 'WEEK'
      ? computeWeekEnd(startDate)
      : startDate && periodType === 'MONTH'
      ? computeMonthEnd(startDate)
      : null;

  const onSubmit = async (data: FormValues) => {
    if (!endDate) return;

    setApiError(null);
    setIsSubmitting(true);

    try {
      const url = isEdit
        ? `/api/admin/bonus-plans/${initialValues!.id}`
        : '/api/admin/bonus-plans';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          periodType: data.periodType,
          rewardType: data.rewardType,
          startDate: data.startDate.toISOString(),
          endDate: endDate.toISOString(),
          payoutValues: data.payoutValues.map((p) => p.value),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setApiError(
          res.status === 409
            ? 'A bonus plan already exists for this period. Adjust the dates or remove the conflicting plan.'
            : body.error ?? 'Something went wrong. Please try again.',
        );
        return;
      }

      onSuccess?.();
    } catch {
      setApiError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Plan Title</Label>
        <Input id="title" placeholder="e.g. Week 24 Bonus" {...register('title')} />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Period Type */}
      <div className="space-y-1.5">
        <Label>Period Type</Label>
        <div className="flex gap-4">
          {(['WEEK', 'MONTH'] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={type}
                className="h-4 w-4"
                {...register('periodType')}
                onChange={() => {
                  setValue('periodType', type);
                  setValue('startDate', undefined as unknown as Date);
                }}
              />
              <span className="text-sm">{type === 'WEEK' ? 'Weekly' : 'Monthly'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reward Type */}
      <div className="space-y-1.5">
        <Label>Reward Type</Label>
        <div className="flex gap-4">
          {(['POINTS', 'PREMIUM_DAYS'] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value={type} className="h-4 w-4" {...register('rewardType')} />
              <span className="text-sm">{type === 'POINTS' ? 'Points' : 'Premium Days (Tokens)'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Start Date */}
      <div className="space-y-1.5">
        <Label>
          Start Date
          {periodType === 'WEEK' && (
            <span className="ml-1 text-xs text-muted-foreground">(Mondays only)</span>
          )}
          {periodType === 'MONTH' && (
            <span className="ml-1 text-xs text-muted-foreground">(First of the month only)</span>
          )}
        </Label>

        <Controller
          control={control}
          name="startDate"
          render={({ field }) => (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                type="button"
                className={cn(
                  'flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors',
                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !field.value && 'text-muted-foreground',
                )}
              >
                <span>
                  {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                </span>
                <CalendarIcon className="h-4 w-4 opacity-50" />
              </PopoverTrigger>

              <PopoverContent className="w-auto p-0" align="start">
                <DayPicker
                  mode="single"
                  selected={field.value}
                  onSelect={(date) => {
                    field.onChange(date ?? null);
                    setCalendarOpen(false);
                  }}
                  disabled={
                    periodType === 'WEEK'
                      ? (date: Date) => date.getDay() !== 1 || date < startOfDay(new Date())
                      : (date: Date) => date.getDate() !== 1 || date < startOfDay(new Date())
                  }
                  classNames={pickerClassNames}
                />
              </PopoverContent>
            </Popover>
          )}
        />
        {errors.startDate && (
          <p className="text-xs text-destructive">{errors.startDate.message}</p>
        )}
      </div>

      {/* Derived End Date (read-only) */}
      {endDate && (
        <div className="space-y-1.5">
          <Label>End Date (auto-calculated)</Label>
          <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm text-muted-foreground">
            {format(endDate, 'PPP')} at 23:59 UTC
          </div>
        </div>
      )}

      {/* Payout Values */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Payout Values</Label>
          <span className="text-xs text-muted-foreground">{fields.length} / 10 ranks</span>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                Rank {index + 1}
              </span>
              <Input
                type="number"
                min={0}
                {...register(`payoutValues.${index}.value`, { valueAsNumber: true })}
                className="h-8"
              />
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove rank ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {errors.payoutValues && (
          <p className="text-xs text-destructive">
            {errors.payoutValues.message ?? 'Invalid payout values'}
          </p>
        )}

        {fields.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ value: 0 })}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rank
          </Button>
        )}
      </div>

      {/* Overlap / API error */}
      {apiError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Bonus Plan')}
        </Button>
      </div>
    </form>
  );
}
