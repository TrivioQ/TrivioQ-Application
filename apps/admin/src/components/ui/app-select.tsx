'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface AppSelectOption {
  value: string;
  label: string;
}

export interface AppSelectProps extends React.ComponentProps<typeof Select> {
  options: AppSelectOption[];
  placeholder?: string;
  className?: string;
}

export function AppSelect({
  options,
  placeholder,
  className,
  value,
  ...props
}: AppSelectProps) {
  const selectedLabel = React.useMemo(() => {
    return options.find((opt) => opt.value === value)?.label;
  }, [value, options]);

  return (
    <Select value={value} {...props}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} label={option.label}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
