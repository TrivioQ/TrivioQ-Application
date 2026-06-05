import React from 'react';
import Markdown from 'react-native-markdown-display';
import { StyleSheet, useColorScheme, Linking } from 'react-native';

interface MarkdownTextProps {
  children: string;
  /** Override text color (e.g. for option buttons) */
  color?: string;
  /** Scale factor for font sizes (default 1) */
  scale?: number;
}

/**
 * Renders a markdown string in React Native using react-native-markdown-display.
 * Supports GFM-compatible markdown: bold, italic, images, tables, code, and lists.
 * Math formulas (KaTeX) are not supported on RN — use descriptive text fallback.
 */
export function MarkdownText({ children, color, scale = 1 }: MarkdownTextProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const textColor = color ?? (isDark ? '#F8FAFC' : '#0F172A');
  const mutedColor = isDark ? '#94A3B8' : '#64748B';
  const codeBg = isDark ? '#1E293B' : '#F1F5F9';
  const borderColor = isDark ? '#334155' : '#CBD5E1';
  const linkColor = isDark ? '#818CF8' : '#4F46E5'; // indigo

  const fs = (base: number) => base * scale;

  const styles = StyleSheet.create({
    body: { color: textColor, fontSize: fs(16), lineHeight: fs(24) },
    paragraph: { marginBottom: 6, marginTop: 0 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    s: { textDecorationLine: 'line-through' },
    // Headings
    heading1: { fontSize: fs(22), fontWeight: '800', marginBottom: 8, color: textColor },
    heading2: { fontSize: fs(19), fontWeight: '700', marginBottom: 6, color: textColor },
    heading3: { fontSize: fs(17), fontWeight: '600', marginBottom: 4, color: textColor },
    // Code
    code_inline: { backgroundColor: codeBg, borderRadius: 4, paddingHorizontal: 4, fontFamily: 'Courier', fontSize: fs(13), color: textColor },
    fence: { backgroundColor: codeBg, borderRadius: 8, padding: 10, fontFamily: 'Courier', fontSize: fs(13), marginVertical: 6, color: textColor },
    code_block: { backgroundColor: codeBg, borderRadius: 8, padding: 10, fontFamily: 'Courier', fontSize: fs(13), marginVertical: 6, color: textColor },
    // Blockquote
    blockquote: { borderLeftWidth: 4, borderLeftColor: '#6366F1', paddingLeft: 10, marginVertical: 6, opacity: 0.8 },
    // Lists
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { flexDirection: 'row', marginBottom: 2 },
    bullet_list_icon: { marginRight: 6, color: textColor },
    ordered_list_icon: { marginRight: 6, color: textColor },
    // Tables
    table: { borderWidth: 1, borderColor, marginVertical: 6 },
    thead: { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' },
    th: { padding: 8, fontWeight: '700', borderRightWidth: 1, borderColor, color: textColor },
    td: { padding: 8, borderRightWidth: 1, borderColor, color: textColor },
    tr: { borderBottomWidth: 1, borderColor },
    // HR
    hr: { borderBottomWidth: 1, borderColor, marginVertical: 8 },
    // Images — constrained
    image: { maxWidth: '100%', height: 200, resizeMode: 'contain', borderRadius: 8, marginVertical: 6 },
    // Links
    link: { color: linkColor, textDecorationLine: 'underline' },
    // Muted text
    blockquote_text: { color: mutedColor },
  });

  return (
    <Markdown
      style={styles}
      onLinkPress={(url) => {
        Linking.openURL(url);
        return false;
      }}
    >
      {children}
    </Markdown>
  );
}
