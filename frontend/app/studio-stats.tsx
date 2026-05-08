import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';

// Backward-compat shim: redirect to unified studio detail page for the player.
export default function StudioStatsRedirect() {
  const router = useRouter();
  const { state } = useGame();
  useEffect(() => {
    if (state) router.replace(`/studio/${state.player.id}`);
  }, [state, router]);
  return <View style={{ flex: 1, backgroundColor: T.bg }} />;
}
