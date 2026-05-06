// Cross-platform alert/confirm helper — React Native Alert.alert does not render on web.
// This wraps window.alert/confirm on web and Alert.alert on native.
import { Alert, Platform } from 'react-native';

export function uiAlert(title: string, message?: string, buttons?: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }[]) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    // If buttons include a destructive/primary non-cancel action, use confirm; else plain alert
    if (buttons && buttons.length > 1) {
      const ok = buttons.find(b => b.style !== 'cancel');
      const cancel = buttons.find(b => b.style === 'cancel');
      // eslint-disable-next-line no-alert
      const res = typeof window !== 'undefined' && window.confirm ? window.confirm(text) : true;
      if (res) ok?.onPress?.();
      else cancel?.onPress?.();
      return;
    }
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.alert) window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  Alert.alert(title, message, buttons);
}
