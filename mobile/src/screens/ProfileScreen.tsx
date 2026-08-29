import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

const profile_items = [['learning_style', '学习方式', '短任务、逐步完成'], ['sleep_habit', '作息习惯', '偏晚入睡'], ['tone', '交流偏好', '朋友式交流']] as const;

export default function ProfileScreen() {
  return <ScrollView contentContainerStyle={styles.content}><View style={styles.heading}><View><Text style={styles.eyebrow}>了解自己，调整节奏</Text><Text style={styles.title}>个人画像</Text></View><View style={styles.avatar}><Text style={styles.avatar_text}>你</Text></View></View><View style={styles.profile_hero}><View style={styles.large_avatar}><Text style={styles.large_avatar_text}>L</Text></View><View style={styles.hero_copy}><Text style={styles.hero_title}>LifeAgent 用户</Text><Text style={styles.muted}>你的生活正在被温柔地记录</Text></View></View><View style={styles.section_heading}><Text style={styles.section_title}>习惯与偏好</Text><Text style={styles.eyebrow}>USER_PROFILE</Text></View><View style={styles.profile_list}>{profile_items.map(([key, label, value]) => <View key={key} style={styles.profile_row}><MaterialCommunityIcons color={colors.primary} name={key === 'sleep_habit' ? 'moon-waning-crescent' : key === 'tone' ? 'heart-outline' : 'lightbulb-outline'} size={21} /><Text style={styles.profile_label}>{label}</Text><Text style={styles.profile_value}>{value}</Text></View>)}</View><View style={styles.note}><MaterialCommunityIcons color={colors.peachInk} name="star-four-points" size={24} /><View style={styles.note_copy}><Text style={styles.note_title}>画像会随着你的生活更新</Text><Text style={styles.muted}>每一次记录，都会帮助 LifeAgent 更懂你。</Text></View></View><Text style={styles.disclaimer}>当前后端尚未提供独立画像查询接口，页面保留已有画像字段展示；后续接入正式接口时无需改导航结构。</Text></ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: 36, backgroundColor: colors.canvas },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  eyebrow: { color: colors.muted, fontSize: 11, letterSpacing: 0.7, marginBottom: 4 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '700' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, justifyContent: 'center', alignItems: 'center' },
  avatar_text: { color: colors.paper, fontWeight: '700' },
  profile_hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink, borderRadius: 8, padding: spacing.lg, marginBottom: spacing.xl, gap: spacing.md },
  large_avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#DCEFE2', justifyContent: 'center', alignItems: 'center' },
  large_avatar_text: { color: colors.primaryDark, fontSize: 26, fontWeight: '800' },
  hero_copy: { flex: 1, gap: spacing.xs },
  hero_title: { color: colors.paper, fontSize: 19, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  section_heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  section_title: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  profile_list: { backgroundColor: colors.paper, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  profile_row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  profile_label: { color: colors.muted, fontSize: 13, flex: 1 },
  profile_value: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  note: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.peach, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  note_copy: { flex: 1, gap: spacing.xs },
  note_title: { color: colors.ink, fontWeight: '700' },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: spacing.lg },
});
