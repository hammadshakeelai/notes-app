import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

import { parseRecorderSnapshot } from '../../src/features/recorder/contract';
import type { RecorderSnapshot } from '../../src/features/recorder/contract';

type Command = 'snapshot' | 'list' | 'start' | 'pause' | 'resume' | 'stop' | 'bookmark' | 'recover';
interface NativeRecorder { commandAsync(command: Command, args: string): Promise<string> }
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeRecorder>('NotesRecorder') : null;

export const recorderAvailable = native !== null;

export async function recorderCommand(command: Command, args: Record<string, unknown> = {}): Promise<RecorderSnapshot> {
  if (!native) throw new Error('Recording needs the Android development build.');
  return parseRecorderSnapshot(await native.commandAsync(command, JSON.stringify(args)));
}

/** Permissions are requested only after the user presses Start recording. */
export async function requestRecorderPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native) return false;
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (Number(Platform.Version) >= 33) permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}
