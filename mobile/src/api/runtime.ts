import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clear_runtime_api_base_url,
  get_runtime_api_base_url,
  normalize_api_base_url,
  set_runtime_api_base_url,
} from './client';

export const runtime_api_storage_key = 'lifeagent_runtime_api_base_url_v1';

export async function initialize_runtime_api_config(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(runtime_api_storage_key);
    const normalized = saved ? normalize_api_base_url(saved) : '';
    if (normalized) {
      set_runtime_api_base_url(normalized);
      return normalized;
    }
  } catch {
    // The build-time address remains available when device storage is down.
  }
  return get_runtime_api_base_url();
}

export async function persist_runtime_api_base_url(value: string): Promise<boolean> {
  const normalized = normalize_api_base_url(value);
  if (!normalized) return false;
  await AsyncStorage.setItem(runtime_api_storage_key, normalized);
  return set_runtime_api_base_url(normalized);
}

export async function clear_persisted_runtime_api_base_url(): Promise<void> {
  await AsyncStorage.removeItem(runtime_api_storage_key);
  clear_runtime_api_base_url();
}
