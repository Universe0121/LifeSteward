import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import LoginScreen from './screens/LoginScreen';
import { initialize_runtime_api_config } from './api/runtime';
import { AuthProvider, useAuth } from './state/AuthContext';
import { WorkspaceProvider } from './state/WorkspaceContext';

function AppContent() {
  const { ready, authenticated } = useAuth();
  if (!ready) return <LoadingScreen message="正在准备 LifeAgent..." />;
  if (!authenticated) return <LoginScreen />;
  return <WorkspaceProvider><AppNavigator /></WorkspaceProvider>;
}

function LoadingScreen({ message }: { message: string }) {
  return <View style={styles.loading}><ActivityIndicator color="#252525" /><Text style={styles.loading_text}>{message}</Text></View>;
}

function AppBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void initialize_runtime_api_config().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return ready ? <AppContent /> : <LoadingScreen message="正在加载连接配置..." />;
}

export default function App() {
  return <SafeAreaProvider><AuthProvider><AppBootstrap /></AuthProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F8F8F6' },
  loading_text: { color: '#979797', fontSize: 13 },
});
