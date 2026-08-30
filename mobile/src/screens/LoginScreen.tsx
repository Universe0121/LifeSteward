import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { light_colors } from '../theme';
import { useAuth } from '../state/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const result = await login(name, password);
    if (result) setError(result);
    setSubmitting(false);
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: light_colors.canvas }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, { backgroundColor: light_colors.ink }]}>
            <View style={styles.logo}><Text style={styles.logo_text}>L</Text></View>
            <Text style={[styles.kicker, { color: light_colors.muted }]}>LIFEAGENT</Text>
            <Text style={[styles.hero_title, { color: light_colors.paper }]}>把生活交给自己照看</Text>
            <Text style={[styles.hero_copy, { color: light_colors.muted }]}>记录、回顾，再找到下一步。</Text>
          </View>
          <View style={styles.form}>
            <Text style={[styles.title, { color: light_colors.ink }]}>欢迎回来</Text>
            <Text style={[styles.description, { color: light_colors.muted }]}>第一次使用也可以直接创建本机账号。</Text>
            <Text style={[styles.label, { color: light_colors.muted }]}>用户名</Text>
            <View style={[styles.input_wrap, { backgroundColor: light_colors.paper, borderColor: light_colors.line }]}>
              <MaterialCommunityIcons color={light_colors.muted} name="account-outline" size={20} />
              <TextInput accessibilityLabel="用户名" autoCapitalize="none" value={name} onChangeText={setName} placeholder="输入你的名字" placeholderTextColor={light_colors.muted} style={[styles.input, { color: light_colors.ink }]} returnKeyType="next" />
            </View>
            <Text style={[styles.label, { color: light_colors.muted }]}>密码</Text>
            <View style={[styles.input_wrap, { backgroundColor: light_colors.paper, borderColor: light_colors.line }]}>
              <MaterialCommunityIcons color={light_colors.muted} name="lock-outline" size={20} />
              <TextInput accessibilityLabel="密码" autoCapitalize="none" secureTextEntry value={password} onChangeText={setPassword} placeholder="输入密码" placeholderTextColor={light_colors.muted} style={[styles.input, { color: light_colors.ink }]} onSubmitEditing={() => void submit()} returnKeyType="go" />
            </View>
            {error !== '' && <Text accessibilityLiveRegion="polite" style={[styles.error, { color: light_colors.danger }]}>{error}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="登录并进入 LifeAgent" disabled={submitting} onPress={() => void submit()} style={[styles.submit, { backgroundColor: light_colors.ink }, submitting && styles.disabled]}>
              <Text style={[styles.submit_text, { color: light_colors.paper }]}>{submitting ? '正在进入...' : '进入 LifeAgent'}</Text>
              <MaterialCommunityIcons color={light_colors.paper} name="arrow-right" size={20} />
            </Pressable>
            <Text style={[styles.note, { color: light_colors.muted }]}>密码只用于本次本机登录，不会保存到设备。</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1 },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  hero: { padding: 26, borderRadius: 28, marginBottom: 26 },
  logo: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginBottom: 22 },
  logo_text: { color: light_colors.ink, fontSize: 24, fontWeight: '800' },
  kicker: { fontSize: 11, letterSpacing: 1.2, marginBottom: 10 },
  hero_title: { fontSize: 28, lineHeight: 36, fontWeight: '700', marginBottom: 8 },
  hero_copy: { fontSize: 14, lineHeight: 21 },
  form: { paddingHorizontal: 2 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 20, marginBottom: 18 },
  label: { fontSize: 12, marginTop: 12, marginBottom: 7 },
  input_wrap: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  input: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 11 },
  error: { fontSize: 12, lineHeight: 18, marginTop: 12 },
  submit: { minHeight: 54, borderRadius: 16, marginTop: 22, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' },
  submit_text: { fontSize: 14, fontWeight: '700' },
  note: { textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 13 },
  disabled: { opacity: 0.55 },
});
