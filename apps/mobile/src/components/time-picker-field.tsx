import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme/radius';

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Native time picker bound to a local "HH:MM" string. */
export function TimePickerField({ label, value, onChange }: { label: string; value: string; onChange: (hhmm: string) => void }) {
  const { colors, colorScheme } = useTheme();
  const [open, setOpen] = useState(false);
  const display = toDate(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    // Android shows a modal dialog that closes itself; iOS renders inline.
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 5 }}>{label}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}: ${display}`} accessibilityHint="Opens a time picker" onPress={() => setOpen((o) => !o)} style={{ borderWidth: 1, borderColor: open ? colors.brand : colors.borderColor, borderRadius: radius.md, padding: 12, backgroundColor: colors.bgSecondary }}>
        <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>{display}</Text>
      </TouchableOpacity>
      {open && <DateTimePicker value={toDate(value)} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} themeVariant={colorScheme === 'dark' ? 'dark' : 'light'} onChange={handleChange} />}
    </View>
  );
}
