import { mock_api_client } from './mockClient';
import { is_mock_api_mode, real_api_client } from './client';
export * from './client';
export * from './types';
export { build_mock_poster_svg } from './mockClient';

// A fresh checkout renders the GitHub demo immediately; a configured base URL opts into real calls.
export const api_client = is_mock_api_mode() ? mock_api_client : real_api_client;
