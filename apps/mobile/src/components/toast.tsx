import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

type ToastOptions = {
  message: string;
  type?: ToastType;
  duration?: number;
};

type ToastFn = (options: ToastOptions) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ToastOptions>({ message: '' });
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((opts: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setOptions(opts);
    setVisible(true);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setVisible(false));
    }, opts.duration ?? 3000);
  }, [opacity]);

  const bg = options.type === 'error' ? '#ef4444' : options.type === 'success' ? '#22c55e' : '#6366f1';

  return (
    <ToastContext.Provider value={show}>
      {children}
      {visible && (
        <Animated.View style={[styles.container, { opacity, backgroundColor: bg }]}>
          <Text style={styles.text}>{options.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
