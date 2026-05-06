import { Stack } from 'expo-router';
import { GameProvider } from '../src/game/state';
import { MovieDraftProvider } from '../src/game/draft';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <MovieDraftProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
        </MovieDraftProvider>
      </GameProvider>
    </SafeAreaProvider>
  );
}
