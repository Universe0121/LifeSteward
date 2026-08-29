import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigationProp } from '@react-navigation/native';
import { api_client, type WeeklyReportRecord } from '../api';
import WeeklyPosterCard from '../components/WeeklyPosterCard';
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { colors, spacing } from '../theme';

const is_mock = process.env.EXPO_PUBLIC_API_MODE === 'mock';
type Props = BottomTabScreenProps<TabParamList, '首页'>;

export default function HomeScreen({ navigation }: Props) {
  const root_navigation = navigation.getParent<NavigationProp<RootStackParamList>>();
  const [reports, setReports] = useState<WeeklyReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error_message, setErrorMessage] = useState('');

  const load_reports = useCallback(async () => {
    setLoading(true); setErrorMessage('');
    try { const response = await api_client.listWeeklyReports(10001, 3); setReports(response.items); }
    catch { setErrorMessage('周报暂时无法加载，其他页面仍可正常使用。'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load_reports(); }, [load_reports]);
  const first_report = reports[0];
  const first_report_title = first_report?.report_data.overview?.title ?? '本周生活周报';
  const first_report_uri = first_report ? api_client.getWeeklyPosterUri(first_report.report_id) : '';

  return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load_reports} tintColor={colors.primary} />}>
    <View style={styles.hero}><Text style={styles.kicker}>LIFEAGENT · 今日工作台</Text><Text style={styles.greeting}>嗨，今天也照顾好自己的节奏。</Text><Text style={styles.hero_copy}>把生活交给记录，把下一步留给自己。</Text><Pressable accessibilityRole="button" accessibilityLabel="开始聊天" onPress={() => navigation.navigate('聊天')} style={styles.chat_cta}><MaterialCommunityIcons color={colors.paper} name="message-text-outline" size={20} /><Text style={styles.chat_cta_text}>和 LifeAgent 聊聊今天</Text><MaterialCommunityIcons color={colors.paper} name="arrow-right" size={20} /></Pressable></View>
    <View style={styles.section_heading}><View><Text style={styles.eyebrow}>最近回顾</Text><Text style={styles.section_title}>我的周报</Text></View><MaterialCommunityIcons color={colors.primary} name="chart-timeline-variant" size={28} /></View>
    {loading && <Text style={styles.muted}>正在加载周报...</Text>}
    {!loading && error_message !== '' && <View style={styles.state}><Text style={styles.error}>{error_message}</Text><Pressable onPress={load_reports}><Text style={styles.link}>重新加载</Text></Pressable></View>}
    {!loading && !error_message && first_report && <WeeklyPosterCard is_mock={is_mock} onPress={() => root_navigation?.navigate('周报详情', { report: first_report })} poster_uri={first_report_uri} title={first_report_title} />}
    {!loading && !error_message && !first_report && <View style={styles.empty}><MaterialCommunityIcons color={colors.muted} name="notebook-outline" size={28} /><Text style={styles.empty_title}>暂无周报</Text><Text style={styles.muted}>先记录几件生活小事，周报会慢慢长出来。</Text></View>}
    <View style={styles.section_heading}><View><Text style={styles.eyebrow}>保持一点进度</Text><Text style={styles.section_title}>快捷入口</Text></View></View>
    <View style={styles.quick_grid}><Pressable onPress={() => navigation.navigate('聊天')} style={styles.quick_card}><MaterialCommunityIcons color={colors.primary} name="pencil-outline" size={24} /><Text style={styles.quick_title}>记录此刻</Text><Text style={styles.muted}>写下今天发生的事</Text></Pressable><Pressable onPress={() => navigation.navigate('时间轴')} style={[styles.quick_card, styles.sky_card]}><MaterialCommunityIcons color={colors.skyInk} name="calendar-check-outline" size={24} /><Text style={styles.quick_title}>查看时间轴</Text><Text style={styles.muted}>回到最近的生活轨迹</Text></Pressable></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 36, backgroundColor: colors.canvas, flexGrow: 1 },
  hero: { backgroundColor: colors.ink, borderRadius: 8, padding: spacing.xl, marginBottom: spacing.xl },
  kicker: { color: '#A9C8B2', fontSize: 11, letterSpacing: 1.2, marginBottom: spacing.md },
  greeting: { color: colors.paper, fontSize: 27, lineHeight: 34, fontWeight: '700', marginBottom: spacing.sm },
  hero_copy: { color: '#D4E4D9', fontSize: 14, lineHeight: 22, marginBottom: spacing.lg },
  chat_cta: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chat_cta_text: { color: colors.paper, flex: 1, fontWeight: '700' },
  section_heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  eyebrow: { color: colors.muted, fontSize: 11, letterSpacing: 0.6, marginBottom: 4 },
  section_title: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  state: { backgroundColor: colors.paper, padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  error: { flex: 1, color: colors.danger, fontSize: 13 },
  link: { color: colors.primary, fontWeight: '700' },
  empty: { backgroundColor: colors.paper, borderRadius: 8, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  empty_title: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  quick_grid: { flexDirection: 'row', gap: spacing.md },
  quick_card: { flex: 1, backgroundColor: colors.peach, padding: spacing.md, borderRadius: 8, gap: spacing.xs },
  sky_card: { backgroundColor: colors.sky },
  quick_title: { color: colors.ink, fontWeight: '700', marginTop: spacing.xs },
});
