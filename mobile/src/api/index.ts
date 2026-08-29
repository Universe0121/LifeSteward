import { mock_api_client } from './mockClient';
import { real_api_client } from './client';

export const api_client = process.env.EXPO_PUBLIC_API_MODE === 'mock' ? mock_api_client : real_api_client;

export * from './client';
export * from './types';
