import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'social.partypal.app',
    appName: 'PartyPal',
    webDir: 'out',

    // Load the live website in the app
    server: {
        url: 'https://partypal.social',
        cleartext: false,
    },

    ios: {
        contentInset: 'automatic',
        backgroundColor: '#0a0a1a',
        preferredContentMode: 'mobile',
        scheme: 'PartyPal',
    },

    android: {
        backgroundColor: '#0a0a1a',
        allowMixedContent: false,
        captureInput: true,
        webContentsDebuggingEnabled: false,
    },

    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#0a0a1a',
            showSpinner: false,
            launchFadeOutDuration: 500,
            splashFullScreen: true,
            splashImmersive: true,
        },
        StatusBar: {
            style: 'LIGHT',
            backgroundColor: '#0a0a1a',
        },
        Keyboard: {
            resizeOnFullScreen: true,
        },
        PushNotifications: {
            presentationOptions: ['badge', 'sound', 'alert'],
        },
        GoogleAuth: {
            scopes: ['email', 'profile'],
            // iOS client ID from Firebase Console → Project settings → Your apps → iOS app
            iosClientId: '502123555355-v6oudp93bbsh3o9eib5nc0p8todekms7.apps.googleusercontent.com',
            forceCodeForRefreshToken: true,
        },
    },
};

export default config;
