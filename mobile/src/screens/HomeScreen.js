import { useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://chessorganizerspro.com';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function HomeScreen() {
  const webRef = useRef(null);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Register for push notifications
    async function register() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      const token = tokenData.data;
      console.log('Push token:', token);
    }
    register();

    // Listen for notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      console.log('Notification:', n);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data;
      if (data?.tournamentId) {
        webRef.current?.injectJavaScript(`
          window.location.href = '/tournament/${data.tournamentId}';
          true;
        `);
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  // Handle deep links from push / URL scheme
  useEffect(() => {
    const handler = ({ url }) => {
      if (url) {
        const path = url.replace(/^chessorg:\/\//, '').replace(/^https?:\/\/[^\/]+/, '');
        webRef.current?.injectJavaScript(`
          window.location.href = '${path}';
          true;
        `);
      }
    };
    const sub = Linking.addEventListener('url', handler);
    return () => sub?.remove();
  }, []);

  const INJECTED_JS = `
    // Bridge: notify app when page title changes (for push token registration)
    document.addEventListener('DOMContentLoaded', () => {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded', path: window.location.pathname }));
    });

    // Intercept fetch for offline detection
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const res = await originalFetch(...args);
        return res;
      } catch (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'offline' }));
        throw err;
      }
    };
    true;
  `;

  return (
    <WebView
      ref={webRef}
      source={{ uri: API_URL }}
      style={{ flex: 1, backgroundColor: '#0f172a' }}
      originWhitelist={['*']}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={true}
      allowsBackForwardNavigationGestures={true}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      injectedJavaScript={INJECTED_JS}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'offline') {
            Alert.alert('Sin conexión', 'Verificando conexión a internet...');
          }
        } catch {}
      }}
      onError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.warn('WebView error: ', nativeEvent);
      }}
    />
  );
}
