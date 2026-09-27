import { Link } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const palette = { ink: '#232748', muted: '#646D86', accent: '#6253CC', line: '#E4E7F0', tint: '#EEEBFC', paper: '#FFFFFF', background: '#F7F8FC' };
export function Workspace({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}>
    <View style={ui.nav}><Link href="/" style={ui.brand}>n. Notes</Link><Link href="/library" style={ui.link}>Library</Link><Link href="/study" style={ui.link}>Study</Link><Link href="/settings" style={ui.link}>Settings</Link></View>
    <Text style={ui.eyebrow}>YOUR STUDY SPACE</Text><Text style={ui.heading}>{title}</Text>{subtitle && <Text style={ui.body}>{subtitle}</Text>}{children}
  </ScrollView></SafeAreaView>;
}
export function Button({ children, onPress, disabled, secondary = false }: PropsWithChildren<{ onPress: () => void; disabled?: boolean; secondary?: boolean }>) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.button, secondary && ui.secondary, (disabled || pressed) && { opacity: 0.5 }]}><Text style={[ui.buttonText, secondary && { color: palette.accent }]}>{children}</Text></Pressable>;
}
export function Field({ label, value, onChangeText, multiline, secureTextEntry, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; secureTextEntry?: boolean; placeholder?: string }) {
  return <View style={{ gap: 7 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} secureTextEntry={secureTextEntry} placeholder={placeholder} placeholderTextColor={palette.muted} autoCapitalize="none" style={[ui.input, multiline && { minHeight: 160, textAlignVertical: 'top' }]} /></View>;
}
export function Message({ children, error = false }: PropsWithChildren<{ error?: boolean }>) { return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[ui.message, error && { color: '#8B283B', backgroundColor: '#FFF0F2' }]}>{children}</Text>; }
export const ui = StyleSheet.create({
  page: { maxWidth: 1060, width: '100%', alignSelf: 'center', padding: 24, paddingBottom: 70, gap: 18 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap', paddingVertical: 12, marginBottom: 22 },
  brand: { fontSize: 22, fontWeight: '700', color: palette.ink, marginRight: 'auto' },
  link: { color: palette.accent, fontSize: 14, paddingVertical: 10 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: palette.muted },
  heading: { fontSize: 36, fontWeight: '700', letterSpacing: -1.2, color: palette.ink },
  title: { fontSize: 20, fontWeight: '600', color: palette.ink },
  body: { color: palette.muted, fontSize: 15, lineHeight: 24 },
  label: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: palette.paper, padding: 22, borderWidth: 1, borderColor: palette.line, borderRadius: 18, gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#D5D9E6', borderRadius: 10, padding: 14, minHeight: 48, fontSize: 15, color: palette.ink, backgroundColor: palette.paper },
  button: { paddingHorizontal: 18, paddingVertical: 13, minHeight: 48, borderRadius: 10, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: palette.tint },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  message: { padding: 16, borderRadius: 10, color: '#34725A', backgroundColor: '#EAF6EF', fontSize: 14, lineHeight: 22 },
});
