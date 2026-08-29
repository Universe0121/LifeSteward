import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import profile_data from '../mocks/user_profile.json';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';

const labels: Record<string, string> = {
  learning_style: '学习方式',
  sleep_habit: '作息习惯',
  tone: '交流偏好',
  lang: '语言',
};
const values: Record<string, string> = {
  short_task: '短任务、逐步完成',
  late_sleep: '偏晚入睡',
  friendly: '朋友式交流',
  'zh-CN': '简体中文',
};
const details: Record<string, string> = {
  learning_style: '更适合把大目标拆成短任务，完成一个小步骤后再继续下一步。',
  sleep_habit: '目前记录显示入睡时间偏晚。可以先固定起床时间，再逐步提前睡前准备。',
  tone: '你偏好朋友式、温和直接的交流方式。',
  lang: '当前使用简体中文。',
};
const icons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  learning_style: 'lightbulb-outline',
  sleep_habit: 'moon-waning-crescent',
  tone: 'heart-outline',
  lang: 'translate',
};

function display_value(value: unknown): string {
  if (typeof value === 'string') return values[value] ?? value;
  if (value === null || value === undefined || value === '') return '暂未记录';
  return typeof value === 'object' ? '暂未记录' : String(value);
}

export default function ProfileScreen() {
  const { colors } = useWorkspace();
  const { display_name } = useAuth();
  const [expanded_key, setExpandedKey] = useState<string | null>(null);
  const preference_items = Object.entries(profile_data.user_preferences).map(([key, value]) => [key, value] as const);
  const profile_items = [
    ...Object.entries(profile_data).filter(([key]) => key !== 'user_preferences').map(([key, value]) => [key, value] as const),
    ...preference_items,
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]}>
      <View style={styles.heading}>
        <View><Text style={[styles.eyebrow, { color: colors.muted }]}>了解自己，调整节奏</Text><Text style={[styles.title, { color: colors.ink }]}>个人画像</Text></View>
      </View>
      <View style={[styles.hero, { backgroundColor: colors.ink }]}>
        <View style={styles.avatar}><Text style={[styles.avatar_text, { color: colors.ink }]}>{(display_name || '朋友').slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.hero_copy}><Text style={[styles.hero_title, { color: colors.paper }]}>{display_name || '朋友'}</Text><Text style={[styles.muted, { color: colors.muted }]}>你的生活正在被温柔地记录</Text></View>
      </View>
      <View style={styles.section_heading}><Text style={[styles.section_title, { color: colors.ink }]}>习惯与偏好</Text><Text style={[styles.eyebrow, { color: colors.muted }]}>user_profile</Text></View>
      <View style={[styles.list, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        {profile_items.map(([key, value], index) => <Pressable accessibilityRole="button" accessibilityLabel={`查看${labels[key] ?? key}详情`} key={key} onPress={() => setExpandedKey(expanded_key === key ? null : key)} style={[styles.row, index < profile_items.length - 1 && { borderBottomColor: colors.line, borderBottomWidth: 1 }]}>
          <View style={[styles.row_icon, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.blue_strong} name={icons[key] ?? 'information-outline'} size={18} /></View>
          <Text style={[styles.label, { color: colors.muted }]}>{labels[key] ?? key}</Text>
          <Text style={[styles.value, { color: colors.ink }]} numberOfLines={2}>{display_value(value)}</Text>
          <MaterialCommunityIcons color={colors.muted} name={expanded_key === key ? 'chevron-up' : 'chevron-down'} size={18} />
          {expanded_key === key && <Text style={[styles.detail, { color: colors.muted }]}>{details[key] ?? '暂时没有更多分析。'}</Text>}
        </Pressable>)}
      </View>
      <View style={[styles.tip, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.blue_strong} name="star-four-points" size={23} /><View style={styles.tip_copy}><Text style={[styles.tip_title, { color: colors.ink }]}>画像会随着你的生活更新</Text><Text style={[styles.muted, { color: colors.muted }]}>每一次记录，都会帮助 LifeAgent 更懂你。</Text></View></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 34 },
  heading: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  hero: { marginHorizontal: 24, marginBottom: 26, padding: 22, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatar_text: { fontSize: 25, fontWeight: '800' },
  hero_copy: { flex: 1, minWidth: 0 },
  hero_title: { fontSize: 22, fontWeight: '700', marginBottom: 5 },
  muted: { fontSize: 13, lineHeight: 20 },
  section_heading: { paddingHorizontal: 24, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  section_title: { fontSize: 21, fontWeight: '700' },
  list: { marginHorizontal: 24, paddingHorizontal: 14, borderWidth: 1, borderRadius: 18 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingVertical: 8 },
  row_icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, minWidth: 0, fontSize: 13 },
  value: { maxWidth: 150, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  detail: { width: '100%', paddingLeft: 40, paddingRight: 8, paddingBottom: 7, fontSize: 12, lineHeight: 19 },
  tip: { marginHorizontal: 24, marginTop: 22, padding: 16, borderRadius: 18, flexDirection: 'row', gap: 12, alignItems: 'center' },
  tip_copy: { flex: 1, minWidth: 0, gap: 4 },
  tip_title: { fontSize: 13, fontWeight: '700' },
});
