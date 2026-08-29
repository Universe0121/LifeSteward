import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { api_client, build_mock_poster_svg, is_mock_api_mode } from '../api';
import { useWorkspace } from '../state/WorkspaceContext';

type Props = {
  report_id: number;
  poster_url?: string;
  width: number;
  height: number;
};

export default function WeeklyPosterPreview({ report_id, poster_url, width, height }: Props) {
  const { colors } = useWorkspace();
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry_token, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    if (is_mock_api_mode()) {
      setSvg(build_mock_poster_svg(report_id));
      setLoading(false);
      setError(false);
      return () => {
        active = false;
      };
    }
    setSvg(null);
    setLoading(true);
    setError(false);
    api_client.getWeeklyPosterSvg(report_id, poster_url)
      .then((value) => {
        if (active) setSvg(value);
      })
      .catch(() => {
        if (active) {
          setSvg(null);
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [poster_url, report_id, retry_token]);

  if (loading) {
    return <View style={[styles.fallback, { width, height, backgroundColor: colors.blue }]}><ActivityIndicator color={colors.ink} /></View>;
  }

  if (svg) {
    // SvgXml keeps the server's SVG as vector content on Android and iOS.
    return <View style={[styles.preview, { width, height, backgroundColor: colors.blue }]}><SvgXml xml={svg} width="100%" height="100%" /></View>;
  }

  return <View style={[styles.fallback, { width, height, backgroundColor: colors.blue }]}>
    <MaterialCommunityIcons color={colors.ink} name="chart-box-outline" size={30} />
    <Text style={[styles.fallback_text, { color: colors.ink }]}>{error ? '海报暂不可用' : 'WEEKLY'}</Text>
    {error && <Pressable accessibilityRole="button" accessibilityLabel="重试加载海报" onPress={() => setRetryToken((value) => value + 1)} style={styles.retry}>
      <MaterialCommunityIcons color={colors.ink} name="refresh" size={15} />
      <Text style={[styles.retry_text, { color: colors.ink }]}>重试</Text>
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  preview: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  fallback_text: {
    fontSize: 10,
    fontWeight: '800',
  },
  retry: {
    minHeight: 30,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  retry_text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
