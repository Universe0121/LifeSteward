import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useWorkspace } from '../state/WorkspaceContext';
import ChatScreen from '../screens/ChatScreen';
import CustomizeScreen from '../screens/CustomizeScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TimelineScreen from '../screens/TimelineScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import TodayPlanScreen from '../screens/TodayPlanScreen';
import SleepDetailScreen from '../screens/SleepDetailScreen';
import TaskManagementScreen from '../screens/TaskManagementScreen';
import type { WeeklyReportRecord } from '../api';

export type TabParamList = { 首页: undefined; 聊天: undefined; 日历: undefined; 画像: undefined; 定制: undefined };
export type RootStackParamList = {
  主导航: NavigatorScreenParams<TabParamList>;
  周报详情: { report: WeeklyReportRecord };
  今日计划: { plan_date?: string } | undefined;
  睡眠详情: undefined;
  任务管理: { edit_task_id?: string; task_date?: string } | undefined;
};
const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const icons = { 首页: 'home-outline', 聊天: 'message-text-outline', 日历: 'calendar-month-outline', 画像: 'account-circle-outline', 定制: 'tune-variant' } as const;

function MainTabs() {
  const { colors } = useWorkspace();
  return <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: '#AAAAAA', tabBarLabelStyle: { fontSize: 11, paddingBottom: 4 }, tabBarStyle: { height: 68, paddingTop: 7, borderTopColor: colors.line, backgroundColor: colors.paper }, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name={icons[route.name] as keyof typeof MaterialCommunityIcons.glyphMap} size={size} /> })}>
    <Tab.Screen name="首页" component={HomeScreen} /><Tab.Screen name="聊天" component={ChatScreen} /><Tab.Screen name="日历" component={TimelineScreen} /><Tab.Screen name="画像" component={ProfileScreen} /><Tab.Screen name="定制" component={CustomizeScreen} />
  </Tab.Navigator>;
}
export default function AppNavigator() {
  const { colors } = useWorkspace();
  const screen_options = { headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.paper }, headerShadowVisible: false } as const;
  return <NavigationContainer><Stack.Navigator>
    <Stack.Screen name="主导航" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="周报详情" component={WeeklyReportScreen} options={{ title: '周报详情', ...screen_options }} />
    <Stack.Screen name="今日计划" component={TodayPlanScreen} options={{ title: '今日计划', ...screen_options }} />
    <Stack.Screen name="睡眠详情" component={SleepDetailScreen} options={{ title: '睡眠时间', ...screen_options }} />
    <Stack.Screen name="任务管理" component={TaskManagementScreen} options={{ title: '今日任务', ...screen_options }} />
  </Stack.Navigator></NavigationContainer>;
}
