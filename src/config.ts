// Configuration settings for the Asset Editor

interface AppConfig {
  apiBaseUrl: string;
  appTitle: string;
  version: string;
  defaultTheme: 'light' | 'dark';
  useMockData: boolean;
}

export const config: AppConfig = {
  // API Configuration  
  apiBaseUrl: '/api',
  
  // Application Settings
  appTitle: 'Asset Editor',
  version: '1.0.0',
  
  // UI Settings
  defaultTheme: 'light',
  
  // Mock Data Settings
  useMockData: true, // Set to false when connecting to real backend
}







