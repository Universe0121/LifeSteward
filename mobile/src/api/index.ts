import { mock_api_client } from './mockClient';
import {
  createApiClient,
  get_runtime_api_base_url,
  is_mock_api_mode,
  real_api_client,
} from './client';
export * from './client';
export * from './types';
export { build_mock_poster_svg } from './mockClient';

function active_client() {
  // Mock data is available only when EXPO_PUBLIC_API_MODE=mock. A runtime
  // address saved from the settings screen always uses the real HTTP client.
  return is_mock_api_mode()
    ? mock_api_client
    : createApiClient({ api_base_url: get_runtime_api_base_url() });
}

// Delegate per call so an updated tunnel address is used without rebuilding
// the APK or leaving a stale module-level client in memory.
export const api_client = {
  postChat: (...args: Parameters<typeof real_api_client.postChat>) => active_client().postChat(...args),
  getLifeEvents: (...args: Parameters<typeof real_api_client.getLifeEvents>) => active_client().getLifeEvents(...args),
  transcribeAudio: (...args: Parameters<typeof real_api_client.transcribeAudio>) => active_client().transcribeAudio(...args),
  listWeeklyReports: (...args: Parameters<typeof real_api_client.listWeeklyReports>) => active_client().listWeeklyReports(...args),
  generateWeeklyReport: (...args: Parameters<typeof real_api_client.generateWeeklyReport>) => active_client().generateWeeklyReport(...args),
  getWeeklyPosterUri: (...args: Parameters<typeof real_api_client.getWeeklyPosterUri>) => active_client().getWeeklyPosterUri(...args),
  getWeeklyPosterSvg: (...args: Parameters<typeof real_api_client.getWeeklyPosterSvg>) => active_client().getWeeklyPosterSvg(...args),
  getHealthReady: (...args: Parameters<typeof real_api_client.getHealthReady>) => active_client().getHealthReady(...args),
};
