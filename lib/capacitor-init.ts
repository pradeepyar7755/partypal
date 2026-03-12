/**
 * PartyPal — Capacitor Native Bridge
 * Initializes native plugins when running inside the mobile app shell.
 * Safe to import on web — all calls are guarded by Capacitor.isNativePlatform().
 */
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/** Initialise native plugins (call once in root layout) */
export async function initNativeApp() {
    if (!isNative()) return;

    // ── Status Bar ──
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#0a0a1a' });
    }

    // ── Splash Screen ──
    const { SplashScreen } = await import('@capacitor/splash-screen');
    // Auto-hide after 2s is configured, but we can also manually hide
    setTimeout(() => SplashScreen.hide({ fadeOutDuration: 500 }), 2500);

    // ── Keyboard ──
    // Scroll the focused input into view when keyboard opens,
    // without using position:fixed which destroys scroll position.
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', () => {
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    });
    Keyboard.addListener('keyboardWillHide', () => {
        // No-op: avoid position:fixed which resets scroll
    });

    // ── App lifecycle ──
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
            window.history.back();
        } else {
            App.exitApp();
        }
    });

    // Deep link handling
    App.addListener('appUrlOpen', (event) => {
        const slug = event.url.split('partypal.social').pop();
        if (slug) {
            window.location.href = slug;
        }
    });

    console.log(`🎉 PartyPal native app initialized (${getPlatform()})`);
}

/** Request push notification permissions */
export async function requestPushPermissions() {
    if (!isNative()) return null;

    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive === 'granted') {
        await PushNotifications.register();
    }

    // Listen for registration token
    PushNotifications.addListener('registration', (token) => {
        console.log('Push token:', token.value);
        // TODO: Send token to your backend for push delivery
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action:', notification);
        // Navigate to relevant page based on notification data
        const data = notification.notification.data;
        if (data?.url) {
            window.location.href = data.url;
        }
    });

    return permission;
}

/** Trigger haptic feedback */
export async function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'medium') {
    if (!isNative()) return;
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: styleMap[type] });
}

/** Open external URL in in-app browser */
export async function openInAppBrowser(url: string) {
    if (!isNative()) {
        window.open(url, '_blank');
        return;
    }
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
}
