import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { colors, spacing } from '../theme';

type WeeklyPosterCardProps = { poster_uri: string; title: string; onPress: () => void; is_mock?: boolean };

export default function WeeklyPosterCard({ poster_uri, title, onPress, is_mock = false }: WeeklyPosterCardProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`打开${title}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.preview}>
      {is_mock ? <Image accessibilityLabel="周报海报预览" resizeMode="cover" source={{ uri: poster_uri }} style={styles.image} /> : <SvgUri height="100%" uri={poster_uri} width="100%" />}
    </View>
    <View style={styles.copy}><View><Text style={styles.eyebrow}>WEEKLY REPORT</Text><Text style={styles.title}>{title}</Text></View><MaterialCommunityIcons color={colors.primary} name="arrow-top-right" size={22} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.75 },
  preview: { aspectRatio: 1, backgroundColor: colors.soft, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  copy: { padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.muted, fontSize: 10, letterSpacing: 0.8, marginBottom: 4 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
});
