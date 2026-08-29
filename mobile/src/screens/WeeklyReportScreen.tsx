import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api_client } from '../api';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, '周报详情'>;
const is_mock = process.env.EXPO_PUBLIC_API_MODE === 'mock';

export default function WeeklyReportScreen({ route }: Props) {
  const { report } = route.params;
  const [sharing, setSharing] = useState(false);
  const [share_error, setShareError] = useState('');
  const data = report.report_data;
  const title = data.overview?.title ?? `${report.week_start} 至 ${report.week_end} 周报`;
  const summary = data.overview?.summary ?? data.summary ?? '这一周的生活，值得被好好看见。';
  const highlights = data.highlights ?? [];
  const suggestions = data.next_week_suggestions ?? data.suggestions ?? [];

  async function share_poster() {
    setSharing(true); setShareError('');
    try {
      const poster_uri = api_client.getWeeklyPosterUri(report.report_id);
      if (is_mock) { await Share.share({ message: `${title}\n${summary}` }); return; }
      if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
      const response = await fetch(poster_uri);
      if (!response.ok) throw new Error('poster request failed');
      const svg = await response.text();
      const cache_directory = FileSystem.cacheDirectory;
      if (!cache_directory) throw new Error('cache unavailable');
      const file_uri = `${cache_directory}lifeagent-weekly-report-${report.report_id}.svg`;
      await FileSystem.writeAsStringAsync(file_uri, svg, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(file_uri, { mimeType: 'image/svg+xml', dialogTitle: '分享 LifeAgent 周报海报' });
    } catch { setShareError('海报分享暂时失败，请稍后重试。'); }
    finally { setSharing(false); }
  }

  const total_events = typeof data.activity_analysis?.total_events === 'number' ? data.activity_analysis.total_events : typeof data.stats?.total_events === 'number' ? data.stats.total_events : 0;
  return <ScrollView contentContainerStyle={styles.content}><View style={styles.cover}><MaterialCommunityIcons color="#B8D8C2" name="chart-box-outline" size={34} /><Text style={styles.cover_kicker}>LIFEAGENT WEEKLY</Text><Text style={styles.cover_title}>{title}</Text><Text style={styles.cover_summary}>{summary}</Text></View><View style={styles.stats}><View><Text style={styles.stat_value}>{total_events}</Text><Text style={styles.stat_label}>本周记录</Text></View><View><Text style={styles.stat_value}>{highlights.length}</Text><Text style={styles.stat_label}>生活高光</Text></View><View><Text style={styles.stat_value}>{Math.round((data.completion?.completion_rate ?? 0) * 100)}%</Text><Text style={styles.stat_label}>完成度</Text></View></View><Text style={styles.section_title}>这一周发生了什么</Text>{highlights.length === 0 ? <View style={styles.empty}><Text style={styles.muted}>本周还没有高光记录。</Text></View> : highlights.map((item, index) => <View key={`${item.title}-${index}`} style={styles.highlight}><View style={styles.number}><Text style={styles.number_text}>{index + 1}</Text></View><View style={styles.highlight_copy}><Text style={styles.highlight_title}>{item.title ?? '生活片段'}</Text><Text style={styles.muted}>{item.summary ?? item.evidence?.join('；') ?? ''}</Text></View></View>)}<Text style={styles.section_title}>给下周的一点建议</Text>{suggestions.length === 0 ? <Text style={styles.muted}>继续记录，下一次回顾会更清晰。</Text> : suggestions.map((suggestion, index) => <View key={`${suggestion}-${index}`} style={styles.suggestion}><MaterialCommunityIcons color={colors.primary} name="arrow-right-bottom" size={19} /><Text style={styles.suggestion_text}>{suggestion}</Text></View>)}<Pressable accessibilityRole="button" accessibilityLabel="分享周报海报" disabled={sharing} onPress={() => void share_poster()} style={styles.share_button}>{sharing ? <ActivityIndicator color={colors.paper} /> : <MaterialCommunityIcons color={colors.paper} name="share-variant-outline" size={20} />}<Text style={styles.share_text}>分享海报</Text></Pressable>{share_error !== '' && <View style={styles.error_row}><Text style={styles.error}>{share_error}</Text><Pressable onPress={() => void share_poster()}><Text style={styles.retry}>重试</Text></Pressable></View>}<Text style={styles.disclaimer}>海报由后端以 image/svg+xml 提供，分享时仅写入设备临时目录。</Text></ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: 38, backgroundColor: colors.canvas },
  cover: { backgroundColor: colors.ink, borderRadius: 8, padding: spacing.xl, minHeight: 240, justifyContent: 'flex-end', gap: spacing.sm },
  cover_kicker: { color: '#A9C8B2', fontSize: 11, letterSpacing: 1.1, marginTop: spacing.lg },
  cover_title: { color: colors.paper, fontSize: 26, lineHeight: 33, fontWeight: '700' },
  cover_summary: { color: '#D4E4D9', lineHeight: 22, fontSize: 14 },
  stats: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.lg, padding: spacing.md, justifyContent: 'space-around' },
  stat_value: { color: colors.primary, fontSize: 23, fontWeight: '800', textAlign: 'center' },
  stat_label: { color: colors.muted, fontSize: 11, marginTop: 3, textAlign: 'center' },
  section_title: { color: colors.ink, fontSize: 19, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.md },
  empty: { paddingVertical: spacing.lg },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  highlight: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, backgroundColor: colors.paper, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  number: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.peach, justifyContent: 'center', alignItems: 'center' },
  number_text: { color: colors.peachInk, fontWeight: '800' },
  highlight_copy: { flex: 1, gap: spacing.xs },
  highlight_title: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  suggestion: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  suggestion_text: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 21 },
  share_button: { marginTop: spacing.lg, minHeight: 48, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  share_text: { color: colors.paper, fontWeight: '700', fontSize: 15 },
  error_row: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  error: { flex: 1, color: colors.danger, fontSize: 12 },
  retry: { color: colors.primary, fontWeight: '700' },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: spacing.md },
});
