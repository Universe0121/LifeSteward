import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import LoginScreen from './screens/LoginScreen';
import { AuthProvider, useAuth } from './state/AuthContext';
import { WorkspaceProvider } from './state/WorkspaceContext';

function AppContent() {
  const { ready, authenticated } = useAuth();
  if (!ready) return null;
  if (!authenticated) return <LoginScreen />;
  return <WorkspaceProvider><AppNavigator /></WorkspaceProvider>;
}

export default function App() {
  return <SafeAreaProvider><AuthProvider><AppContent /></AuthProvider></SafeAreaProvider>;
}
