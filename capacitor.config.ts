import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.schmittodyssee.app',
  appName: 'Schmitt Odyssée',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      androidPermissions: {
        camera: 'required',
        photos: 'optional'
      }
    },
    Geolocation: {
      androidPermissions: {
        location: 'required',
        backgroundLocation: 'optional'
      }
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    App: {
      handleUrlTypes: ['schmittodyssee']
    }
  }
};

export default config;
