import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppServices } from '@/components/AppServices';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <AppServices />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F8FC' } }} />
    </>
  );
}
