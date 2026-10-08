import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CATEGORY_BUNDLES, MIN_CATEGORIES, categoriesInBundle, pickBalancedCategories } from '@trivioq/shared-types';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme/radius';
import type { CategoryOption } from '../api/queries';

/**
 * Multi-select category picker with search, topic bundles and a "pick for me"
 * shortcut, so reaching the 30-category minimum on a phone isn't a chore.
 */
export function CategoryPicker({ options, selected, onChange }: { options: CategoryOption[]; selected: string[]; onChange: (names: string[]) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((c) => c.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const bundles = useMemo(() => CATEGORY_BUNDLES.map((b) => ({ ...b, names: categoriesInBundle(b, options) })).filter((b) => b.names.length > 0), [options]);

  const toggle = (name: string) => {
    const next = new Set(selectedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(Array.from(next));
  };

  const toggleBundle = (names: string[]) => {
    const allIn = names.every((n) => selectedSet.has(n));
    const next = new Set(selectedSet);
    names.forEach((n) => (allIn ? next.delete(n) : next.add(n)));
    onChange(Array.from(next));
  };

  const allSelected = options.length > 0 && selected.length === options.length;
  const meetsMin = selected.length >= Math.min(MIN_CATEGORIES, options.length);

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, fontWeight: '700', color: meetsMin ? colors.success : colors.warning }}>
          {meetsMin ? '✓ ' : ''}
          {t('categories.selectedCount', { count: selected.length, min: MIN_CATEGORIES })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SmallButton label={`✨ ${t('categories.pickForMe')}`} onPress={() => onChange(pickBalancedCategories(options, MIN_CATEGORIES))} />
          <SmallButton label={allSelected ? t('categories.clearAll') : t('categories.selectAll')} onPress={() => onChange(allSelected ? [] : options.map((c) => c.name))} />
        </View>
      </View>

      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{t('categories.bundles')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {bundles.map((b) => {
          const allIn = b.names.every((n) => selectedSet.has(n));
          return (
            <TouchableOpacity
              key={b.id}
              accessibilityRole="button"
              accessibilityState={{ selected: allIn }}
              accessibilityLabel={`${t(`categories.bundle.${b.id}`)}, ${b.names.length}`}
              onPress={() => toggleBundle(b.names)}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: allIn ? colors.brand : colors.borderColor, backgroundColor: allIn ? colors.brandFaint : colors.bgSecondary, marginRight: 8 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: allIn ? colors.brand : colors.textPrimary }}>
                {b.emoji} {t(`categories.bundle.${b.id}`)} ({b.names.length})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderColor, borderRadius: radius.md, backgroundColor: colors.bgSecondary, paddingHorizontal: 10, marginBottom: 8 }}>
        <Feather name="search" size={16} color={colors.textSecondary} />
        <TextInput accessibilityLabel={t('categories.search')} value={query} onChangeText={setQuery} placeholder={t('categories.search')} placeholderTextColor={colors.textSecondary} style={{ flex: 1, padding: 10, color: colors.textPrimary, fontSize: 15 }} />
      </View>

      <ScrollView nestedScrollEnabled style={{ maxHeight: 320, borderWidth: 1, borderColor: colors.borderColor, borderRadius: radius.md }}>
        {filtered.map((c) => {
          const isOn = selectedSet.has(c.name);
          return (
            <TouchableOpacity key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: isOn }} accessibilityLabel={c.name} onPress={() => toggle(c.name)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.borderColor }}>
              <Feather name={isOn ? 'check-square' : 'square'} size={18} color={isOn ? colors.brand : colors.textSecondary} />
              <Text style={{ marginLeft: 10, color: colors.textPrimary, fontSize: 15 }}>{c.name}</Text>
            </TouchableOpacity>
          );
        })}
        {filtered.length === 0 && <Text style={{ padding: 16, textAlign: 'center', color: colors.textSecondary }}>{t('categories.noMatch')}</Text>}
      </ScrollView>
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.bgSecondary }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}
