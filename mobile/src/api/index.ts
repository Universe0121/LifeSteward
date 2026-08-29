import { mock_api_client } from './mockClient';
import { real_api_client } from './client';
export * from './client';
export * from './types';
// A fresh checkout renders the GitHub demo immediately; a configured base URL opts into real calls.
export const api_client = process.env.EXPO_PUBLIC_API_MODE === 'mock' || !process.env.EXPO_PUBLIC_API_BASE_URL ? mock_api_client : real_api_client;
