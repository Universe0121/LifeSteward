import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import TimelineScreen from '../screens/TimelineScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import type { WeeklyReportRecord } from '../api';
import { colors } from '../theme';

export type TabParamList = { 首页: undefined; 聊天: undefined; 时间轴: undefined; 画像: undefined };
export type RootStackParamList = { 主导航: NavigatorScreenParams<TabParamList>; 周报详情: { report: WeeklyReportRecord } };

const tabs = createBottomTabNavigator<TabParamList>();
const stack = createNativeStackNavigator<RootStackParamList>();
const tab_icons = { 首页: 'home-outline', 聊天: 'message-text-outline', 时间轴: 'calendar-month-outline', 画像: 'account-circle-outline' } as const;

function MainTabs() {
  return <tabs.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 11, paddingBottom: 4 }, tabBarStyle: { height: 66, paddingTop: 6, borderTopColor: colors.border, backgroundColor: colors.paper }, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name={tab_icons[route.name] as keyof typeof MaterialCommunityIcons.glyphMap} size={size} /> })}>
    <tabs.Screen name="首页" component={HomeScreen} />
    <tabs.Screen name="聊天" component={ChatScreen} />
    <tabs.Screen name="时间轴" component={TimelineScreen} />
    <tabs.Screen name="画像" component={ProfileScreen} />
  </tabs.Navigator>;
}

export default function AppNavigator() {
  return <NavigationContainer><stack.Navigator><stack.Screen name="主导航" component={MainTabs} options={{ headerShown: false }} /><stack.Screen name="周报详情" component={WeeklyReportScreen} options={{ title: '周报详情', headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.paper }, headerShadowVisible: false }} /></stack.Navigator></NavigationContainer>;
}
