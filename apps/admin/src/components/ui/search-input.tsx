'use client';

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  /** Current value driven by the URL / parent state. Synced into local state on change. */
  initialValue?: string;
  onDebouncedChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}

export function SearchInput({ initialValue = '', onDebouncedChange, placeholder = 'Search…', delay = 350, className }: SearchInputProps) {
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);

  // Sync when the URL-driven value changes externally (clear filters, browser back, etc.)
  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue);
    setValue(initialValue);
  }

  const handleChange = (raw: string) => {
    setValue(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onDebouncedChange(raw), delay);
  };

  return (
    <div className={cn('flex items-center border border-border rounded-md overflow-hidden bg-background px-2 transition-all focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50', className)}>
      <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
      <Input value={value} onChange={(e) => handleChange(e.target.value)} placeholder={placeholder} className="border-0 bg-transparent dark:bg-transparent focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none h-10" />
    </div>
  );
}
