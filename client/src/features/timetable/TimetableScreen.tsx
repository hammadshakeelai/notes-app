import { Link } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addDays, formatDisplayDate, weekdayOf } from '@/domain/calendar';
import type { IsoDate } from '@/domain/calendar';
import { displayName, fileName, isExcepted, occurrencesBetween, sessionNumber } from '@/domain/timetable';
import type { RecordingLabel } from '@/domain/timetable';
import { useTimetable } from './useTimetable';

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const colors = {
  background: '#F7F8FC', paper: '#FFFFFF', ink: '#232748', muted: '#646D86',
  accent: '#6253CC', tint: '#EEEBFC', line: '#E4E7F0', green: '#34725A',
};

function localDate(): IsoDate {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function subscribeToDate(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

function serverDate(): null {
  return null;
}

export function TimetableScreen() {
  const { timetable, error } = useTimetable();
  const { width } = useWindowDimensions();
  const today = useSyncExternalStore(subscribeToDate, localDate, serverDate);
  // Static HTML and the first browser render must agree before viewport-specific content appears.
  const wide = today !== null && width >= 900;
  const [chosenDate, setSelectedDate] = useState<IsoDate | null>(null);
  const selectedDate = chosenDate ?? today;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const monday = selectedDate ? addDays(selectedDate, 1 - weekdayOf(selectedDate)) : null;
  const classes = selectedDate && selectedDate >= timetable.semesterStart
    ? occurrencesBetween(timetable.slots, selectedDate, selectedDate).filter(occ => !isExcepted(timetable, occ))
    : [];

  function select(date: IsoDate) {
    setSelectedDate(date);
    setExpandedId(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.page, wide && styles.widePage]}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.mark}><Text style={styles.markText}>n.</Text></View>
            <Text style={styles.brandText}>Notes</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><Link href="/library" style={styles.recorderLink}>Library</Link><Link href="/study" style={styles.recorderLink}>Study</Link><Link href="/settings" style={styles.recorderLink}>Settings</Link><Link href="/recorder" style={styles.recorderLink}>Open recorder →</Link></View>
        </View>

        <View style={[styles.workspace, wide && styles.workspaceWide]}>
          <View style={[styles.sidebar, wide && styles.sidebarWide]}>
            <Text style={styles.eyebrow}>YOUR STUDY SPACE</Text>
            <Text style={styles.heading}>A little more{wide ? '\n' : ' '}prepared.</Text>
            <Text style={styles.intro}>Your classes, in order. A home for everything you learn.</Text>
            <View style={styles.semester}>
              <Text style={styles.semesterTitle}>Semester V</Text>
              <Text style={styles.caption}>Group B · September 2026</Text>
              <View style={styles.stats}>
                <View><Text style={styles.statValue}>{timetable.subjects.length}</Text><Text style={styles.caption}>subjects</Text></View>
                <View><Text style={styles.statValue}>{timetable.slots.length}</Text><Text style={styles.caption}>classes a week</Text></View>
              </View>
            </View>
            {wide && <View style={styles.subjects}>
              <Text style={styles.eyebrow}>THIS SEMESTER</Text>
              {timetable.subjects.map(subject => <View key={subject.id} style={styles.subject}>
                <View style={styles.subjectBullet} /><Text style={styles.subjectName}>{subject.name}</Text>
              </View>)}
            </View>}
          </View>

          <View style={styles.main}>
            {error && <Text accessibilityRole="alert" style={styles.intro}>{error}</Text>}
            <Link href="/timetable-edit" style={styles.recorderLink}>Edit timetable & holidays →</Link>
            <View style={styles.sectionHeading}>
              <View><Text style={styles.eyebrow}>ONE CLASS AT A TIME</Text><Text style={styles.sectionTitle}>Your timetable</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Go to today" disabled={!today} onPress={() => today && select(today)} style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}>
                <Text style={styles.todayText}>Today</Text>
              </Pressable>
            </View>

            <View style={styles.calendar}>
              <View style={styles.weekHeading}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous week" disabled={!selectedDate} onPress={() => selectedDate && select(addDays(selectedDate, -7))} style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}><Text style={styles.arrow}>‹</Text></Pressable>
                <Text style={styles.weekLabel}>{monday ? `Week of ${formatDisplayDate(monday).slice(4)}` : 'Loading your calendar…'}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Next week" disabled={!selectedDate} onPress={() => selectedDate && select(addDays(selectedDate, 7))} style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}><Text style={styles.arrow}>›</Text></Pressable>
              </View>
              <View style={styles.days}>
                {monday && dayNames.map((day, index) => {
                  const date = addDays(monday, index);
                  const active = date === selectedDate;
                  const hasClasses = date >= timetable.semesterStart && timetable.slots.some(slot => slot.weekday === index + 1);
                  return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${formatDisplayDate(date)}${active ? ', selected' : ''}`} accessibilityState={{ selected: active }} onPress={() => select(date)} style={({ pressed }) => [styles.day, active && styles.activeDay, pressed && styles.pressed]}>
                    <Text style={[styles.dayName, active && styles.activeText]}>{day}</Text>
                    <Text style={[styles.dayNumber, active && styles.activeText]}>{Number(date.slice(-2))}</Text>
                    <View style={[styles.dayDot, hasClasses && styles.hasClassDot, active && hasClasses && styles.activeDot]} />
                  </Pressable>;
                })}
              </View>
            </View>

            <View style={styles.agendaHeading}>
              <Text style={styles.agendaDate}>{selectedDate ? formatDisplayDate(selectedDate) : 'Your schedule'}</Text>
              <Text style={styles.caption}>{classes.length} {classes.length === 1 ? 'class' : 'classes'}</Text>
            </View>
            <View style={styles.agenda}>
              {classes.map(({ slot, date }) => {
                const subject = timetable.subjects.find(item => item.id === slot.subjectId)!;
                const number = sessionNumber(timetable, { subjectId: slot.subjectId, stream: slot.stream, date, start: slot.start });
                const label: RecordingLabel = { kind: 'class', subjectName: subject.name, stream: slot.stream, number };
                const expanded = expandedId === slot.id;
                return <View key={slot.id} style={styles.classCard}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${subject.name}, ${slot.stream} ${number}, ${slot.start} to ${slot.end}. View recording name.`} aria-expanded={expanded} onPress={() => setExpandedId(expanded ? null : slot.id)} style={({ pressed }) => [styles.classRow, pressed && styles.pressed]}>
                    <View style={styles.timeColumn}><Text style={styles.startTime}>{slot.start}</Text><Text style={styles.endTime}>{slot.end}</Text></View>
                    <View style={styles.classInfo}><Text style={styles.stream}>{slot.stream === 'lab' ? 'LAB' : 'LECTURE'} {number}</Text><Text style={styles.classTitle}>{subject.name}</Text></View>
                    <Text style={styles.expandIcon}>{expanded ? '−' : '+'}</Text>
                  </Pressable>
                  {expanded && <View style={styles.recordingPreview}>
                    <Text style={styles.previewTitle}>A name for this class</Text>
                    <Text selectable style={styles.previewText}>{displayName(date, label)}</Text>
                    <Text style={styles.fileLabel}>File name</Text>
                    <Text selectable style={styles.fileName}>{fileName(date, label)}</Text>
                    <Link href={{ pathname: '/recorder', params: { title: displayName(date, label), subjectId: subject.id, stream: slot.stream, date, start: slot.start } }} style={styles.recorderLink}>Record this class →</Link>
                  </View>}
                </View>;
              })}
              {selectedDate && classes.length === 0 && <View style={styles.empty}>
                <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>—</Text></View>
                <Text style={styles.emptyTitle}>{selectedDate < timetable.semesterStart ? 'The semester is ahead.' : 'Room to catch up.'}</Text>
                <Text style={styles.emptyText}>{selectedDate < timetable.semesterStart ? 'Classes begin on 7 September. Browse forward to see your schedule.' : 'No classes on the timetable today. Pick another day to see what’s coming.'}</Text>
              </View>}
            </View>

            <View style={styles.note}>
              <Text style={styles.noteTitle}>First, a place for every lecture.</Text>
              <Text style={styles.noteBody}>Browse your built-in timetable and tap a class to see its recording name. Open the recorder on your Android phone when class begins.</Text>
            </View>
            <Text style={styles.footer}>Lecture and lab numbers are counted separately, from the start of your semester.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { paddingHorizontal: 20, paddingBottom: 40, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  widePage: { paddingHorizontal: 48 },
  header: { paddingVertical: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  markText: { fontSize: 26, fontWeight: '700', color: 'white', marginTop: -4 },
  brandText: { color: colors.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  badgeText: { fontSize: 12, color: colors.muted },
  recorderLink: { color: colors.accent, fontSize: 13, fontWeight: '600', paddingVertical: 12 },
  workspace: { gap: 28, paddingTop: 32 },
  workspaceWide: { flexDirection: 'row', gap: 64, paddingTop: 48 },
  sidebar: { gap: 12 }, sidebarWide: { width: 265, paddingTop: 5 },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  heading: { color: colors.ink, fontSize: 38, lineHeight: 43, letterSpacing: -1.7, fontWeight: '700' },
  intro: { fontSize: 15, lineHeight: 23, color: colors.muted, maxWidth: 380 },
  semester: { padding: 20, backgroundColor: colors.tint, borderRadius: 16, marginTop: 12 },
  semesterTitle: { fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: 5 },
  caption: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  stats: { flexDirection: 'row', gap: 36, marginTop: 20 },
  statValue: { color: colors.accent, fontSize: 27, fontWeight: '600', marginBottom: 2 },
  subjects: { marginTop: 24, gap: 18 },
  subject: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subjectBullet: { height: 5, width: 5, borderRadius: 2, backgroundColor: colors.accent, marginTop: 7 },
  subjectName: { color: colors.muted, fontSize: 13, lineHeight: 20, flex: 1 },
  main: { flex: 1, minWidth: 0 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 24 },
  sectionTitle: { color: colors.ink, fontSize: 27, fontWeight: '600', letterSpacing: -0.8, marginTop: 7 },
  todayButton: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 10, paddingHorizontal: 17, minHeight: 44, justifyContent: 'center' },
  todayText: { color: colors.ink, fontSize: 13, fontWeight: '500' },
  pressed: { opacity: 0.7 },
  calendar: { backgroundColor: colors.paper, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: colors.line },
  weekHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  arrowButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  arrow: { fontSize: 27, lineHeight: 30, color: colors.muted },
  weekLabel: { fontSize: 13, fontWeight: '500', color: colors.ink },
  days: { flexDirection: 'row', gap: 3 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 11, gap: 7 },
  activeDay: { backgroundColor: colors.accent },
  dayName: { fontSize: 11, color: colors.muted },
  dayNumber: { fontSize: 21, fontWeight: '500', color: colors.ink },
  activeText: { color: colors.paper },
  dayDot: { height: 4, width: 4, borderRadius: 2, backgroundColor: 'transparent' },
  hasClassDot: { backgroundColor: colors.accent }, activeDot: { backgroundColor: colors.paper },
  agendaHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 14, gap: 10 },
  agendaDate: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  agenda: { gap: 10 },
  classCard: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, overflow: 'hidden' },
  classRow: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  timeColumn: { borderRightWidth: 1, borderRightColor: colors.line, paddingRight: 16, gap: 7 },
  startTime: { fontSize: 14, fontFamily: mono, color: colors.ink },
  endTime: { fontSize: 11, fontFamily: mono, color: colors.muted },
  classInfo: { flex: 1, gap: 7 }, stream: { fontSize: 9, fontWeight: '700', color: colors.accent, letterSpacing: 1 },
  classTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 21 },
  expandIcon: { fontSize: 22, color: colors.muted },
  recordingPreview: { padding: 20, backgroundColor: '#F3F1FC', borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
  previewTitle: { fontSize: 12, fontWeight: '600', color: colors.accent },
  previewText: { fontSize: 14, color: colors.ink, lineHeight: 22 },
  fileLabel: { fontSize: 11, color: colors.muted, marginTop: 8 },
  fileName: { fontSize: 11, fontFamily: mono, color: colors.muted, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 38, paddingHorizontal: 28, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 16 },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyIconText: { fontSize: 26, color: colors.accent },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  note: { marginTop: 24, borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 16, gap: 6 },
  noteTitle: { fontSize: 13, fontWeight: '600', color: colors.ink },
  noteBody: { fontSize: 12, lineHeight: 20, color: colors.muted },
  footer: { fontSize: 11, lineHeight: 18, color: colors.muted, marginTop: 28 },
});
