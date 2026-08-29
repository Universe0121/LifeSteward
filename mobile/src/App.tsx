import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import { WorkspaceProvider } from './state/WorkspaceContext';

export default function App() {
  return <SafeAreaProvider><WorkspaceProvider><AppNavigator /></WorkspaceProvider></SafeAreaProvider>;
}
