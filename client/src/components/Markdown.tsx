import { Text, View } from 'react-native';
import { ui } from './Workspace';

/** Text-only rendering: imported Markdown cannot execute HTML or script. */
export function Markdown({ text }: { text: string }) {
  return <View style={{ gap: 8 }}>{text.split('\n').map((line, i) => <Text selectable key={i} style={/^#{1,3} /.test(line) ? ui.title : ui.body}>{line.replace(/^#{1,6} /, '').replace(/^[-*] /, '• ') || ' '}</Text>)}</View>;
}
