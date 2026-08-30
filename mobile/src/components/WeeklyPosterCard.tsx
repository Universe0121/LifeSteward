import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WeeklyReportRecord } from '../api';
import { useWorkspace } from '../state/WorkspaceContext';
import { spacing } from '../theme';
import WeeklyPosterPreview from './WeeklyPosterPreview';

export default function WeeklyPosterCard({ report, on_press }: { report: WeeklyReportRecord; on_press: () => void }) {
  const { colors } = useWorkspace();
  const summary = report.report_data.overview?.summary ?? report.report_data.summary ?? '这一周的生活，值得被好好看见。';
  return (
    <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
      <View style={styles.poster}>
        <WeeklyPosterPreview
          height={116}
          poster_url={report.poster_url}
          report_id={report.report_id}
          width={92}
        />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="查看周报详情" onPress={on_press} style={styles.copy}>
        <Text style={[styles.kicker, { color: colors.muted }]}>LIFEAGENT WEEKLY</Text>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>{report.report_data.overview?.title ?? '本周生活周报'}</Text>
        <Text numberOfLines={2} style={[styles.summary, { color: colors.muted }]}>{summary}</Text>
        <View style={styles.link_row}>
          <Text style={[styles.link, { color: colors.ink }]}>查看详情</Text>
          <MaterialCommunityIcons color={colors.ink} name="arrow-right" size={16} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 18,
  },
  poster: {
    width: 92,
    height: 116,
    borderRadius: 12,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
    justifyContent: 'center',
    gap: 5,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  summary: {
    fontSize: 12,
    lineHeight: 18,
  },
  link_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
  },
});
