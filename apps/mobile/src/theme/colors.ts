export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  brand: string;
  success: string;
  error: string;
  warning: string;
  glassBg: string;
  glassBorder: string;
}

export const lightColors: ThemeColors = {
  bgPrimary: '#F8FAFC', // slate-50
  bgSecondary: '#FFFFFF', // white
  textPrimary: '#0F172A', // slate-900
  textSecondary: '#64748B', // slate-500
  borderColor: '#E2E8F0', // slate-200
  brand: '#14B8A6', // teal-500 — matches web
  success: '#22c55e', // green-500
  error: '#ef4444', // red-500
  warning: '#f59e0b', // amber-500
  glassBg: 'rgba(255, 255, 255, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.5)',
};

export const darkColors: ThemeColors = {
  bgPrimary: '#020617', // slate-950
  bgSecondary: '#0F172A', // slate-900
  textPrimary: '#F8FAFC', // slate-50
  textSecondary: '#94A3B8', // slate-400
  borderColor: '#1E293B', // slate-800
  brand: '#14B8A6',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  glassBg: 'rgba(15, 23, 42, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
};
