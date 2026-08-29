/**
 * AquaSense X Notification Service
 * Platform-agnostic notification coordinator with Web Notification and Firebase Cloud Messaging (FCM) implementation.
 * Prepared for Web, iOS, and Android delivery channels.
 */

import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, getFirebaseMessaging, getVapidPublicKey } from '../firebase/firebaseConfig';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export type NotificationCategory =
  | 'drinkReminders'
  | 'lowBatteryAlerts';

export interface NotificationPayload {
  category: NotificationCategory;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

export interface FCMTokenRecord {
  token: string;
  platform: 'web' | 'ios' | 'android';
  userAgent: string;
  createdAt: string;
  updatedAt: string;
}

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private unsubscribeForeground: (() => void) | null = null;

  /**
   * Check if standard Web Notifications are supported.
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Check if Firebase Cloud Messaging is supported in this browser.
   */
  public async isFCMSupported(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }
    const messaging = await getFirebaseMessaging();
    return messaging !== null;
  }

  /**
   * Get the current browser notification permission status.
   */
  public getPermissionStatus(): NotificationPermissionState {
    if (!this.isSupported()) {
      return 'unsupported';
    }
    return Notification.permission as NotificationPermissionState;
  }

  /**
   * Request browser notification permission explicitly after user action.
   */
  public async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) {
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      return permission as NotificationPermissionState;
    } catch (error) {
      console.warn('Error requesting notification permission:', error);
      return this.getPermissionStatus();
    }
  }

  /**
   * Register the Firebase Messaging Service Worker.
   */
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    if (this.swRegistration) {
      return this.swRegistration;
    }

    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      this.swRegistration = reg;
      return reg;
    } catch (error) {
      console.warn('Failed to register firebase-messaging-sw.js:', error);
      return null;
    }
  }

  /**
   * Request an FCM Web Push registration token and persist to Firestore under users/{uid}/fcmTokens/{tokenId}.
   */
  public async requestFCMToken(uid?: string): Promise<{ token: string | null; error?: string }> {
    const fcmSupported = await this.isFCMSupported();
    if (!fcmSupported) {
      return {
        token: null,
        error: 'Firebase Cloud Messaging is not supported in this browser environment.',
      };
    }

    const vapidKey = getVapidPublicKey();
    if (!vapidKey) {
      const configError =
        'FCM VAPID Public Key is not configured. Please set VITE_FIREBASE_VAPID_KEY in your environment or firebase-applet-config.json.';
      console.warn(`[AquaSense FCM] ${configError}`);
      return {
        token: null,
        error: configError,
      };
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return {
        token: null,
        error: 'Firebase Messaging client failed to initialize.',
      };
    }

    try {
      const swReg = await this.registerServiceWorker();
      if (!swReg) {
        return {
          token: null,
          error: 'Service worker registration failed.',
        };
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swReg,
      });

      if (token && uid) {
        await this.saveTokenToFirestore(uid, token);
      }

      return { token };
    } catch (err: any) {
      console.error('Error obtaining FCM token:', err);
      return {
        token: null,
        error: err?.message || 'Failed to retrieve FCM push token.',
      };
    }
  }

  /**
   * Deterministically generate a safe Firestore document ID for a token.
   */
  private generateTokenDocId(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const suffix = Math.abs(hash).toString(36);
    const prefix = token.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '');
    return `web_${prefix}_${suffix}`;
  }

  /**
   * Save an active FCM device token to users/{uid}/fcmTokens/{tokenId}.
   */
  public async saveTokenToFirestore(uid: string, token: string): Promise<void> {
    if (!uid || !token) return;

    try {
      const tokenId = this.generateTokenDocId(token);
      const tokenRef = doc(db, 'users', uid, 'fcmTokens', tokenId);

      const record: FCMTokenRecord = {
        token,
        platform: 'web',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(
        tokenRef,
        {
          ...record,
          serverCreatedAt: serverTimestamp(),
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to save FCM token to Firestore:', err);
    }
  }

  /**
   * Set up a foreground FCM push message listener.
   */
  public async listenForegroundMessages(
    onPayload?: (payload: MessagePayload) => void
  ): Promise<(() => void) | null> {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    // Clean up any existing listener
    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
      this.unsubscribeForeground = null;
    }

    try {
      const unsubscribe = onMessage(messaging, (payload) => {
        if (onPayload) {
          onPayload(payload);
        }

        // Show local browser notification in foreground if permitted
        const title = payload.notification?.title || (payload.data?.title as string) || 'AquaSense X Alert';
        const body = payload.notification?.body || (payload.data?.body as string) || '';

        if (title && body) {
          this.sendLocalNotification(title, {
            body,
            icon: payload.notification?.icon || (payload.data?.icon as string) || '/favicon.ico',
            tag: (payload.data?.tag as string) || (payload.data?.category as string) || 'aquasense-alert',
            data: payload.data,
          });
        }
      });

      this.unsubscribeForeground = unsubscribe;
      return unsubscribe;
    } catch (err) {
      console.warn('Failed to attach foreground FCM listener:', err);
      return null;
    }
  }

  /**
   * Send a local notification if supported and permission is granted.
   */
  public sendLocalNotification(
    title: string,
    options?: NotificationOptions
  ): { success: boolean; error?: string } {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Browser notifications are not supported on this device/browser.',
      };
    }

    if (Notification.permission !== 'granted') {
      return {
        success: false,
        error: `Notification permission is ${Notification.permission}. Enable notifications in browser settings.`,
      };
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notification.onclick = () => {
        if (typeof window !== 'undefined') {
          window.focus();
        }
        notification.close();
      };

      return { success: true };
    } catch (err: any) {
      console.error('Failed to trigger native Notification:', err);
      return {
        success: false,
        error: err?.message || 'Failed to display notification.',
      };
    }
  }

  /**
   * Send a test push notification to the current user's registered device.
   * Attempts FCM remote dispatch via server API if a token is available,
   * falling back cleanly to local notification display.
   */
  public async sendTestPushNotification(
    uid?: string
  ): Promise<{ success: boolean; deliveredVia: 'fcm' | 'local'; message?: string; error?: string }> {
    if (this.getPermissionStatus() !== 'granted') {
      return {
        success: false,
        deliveredVia: 'local',
        error: 'Notification permission is required to send notifications.',
      };
    }

    const currentAuthUser = auth.currentUser;
    const effectiveUid = uid || currentAuthUser?.uid;

    // Attempt FCM token retrieval
    let token: string | null = null;
    if (effectiveUid) {
      const fcmResult = await this.requestFCMToken(effectiveUid);
      token = fcmResult.token;
    }

    if (currentAuthUser) {
      try {
        const idToken = await currentAuthUser.getIdToken();
        const response = await fetch('/api/notifications/test-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          return {
            success: true,
            deliveredVia: 'fcm',
            message: 'FCM push notification sent successfully!',
          };
        } else if (data.code === 'MISSING_SERVICE_ACCOUNT') {
          // Clean local fallback when server lacks service account credentials
          this.sendLocalNotification('AquaSense X', {
            body: 'Push notifications are working.',
            icon: '/favicon.ico',
          });
          return {
            success: true,
            deliveredVia: 'local',
            message: 'Token registered. (Server requires FIREBASE_SERVICE_ACCOUNT for remote push).',
          };
        } else if (!data.success && data.error) {
          return {
            success: false,
            deliveredVia: 'local',
            error: data.error,
          };
        }
      } catch (serverErr) {
        console.warn('Server test push request error:', serverErr);
      }
    }

    // Local fallback
    const localResult = this.sendLocalNotification('AquaSense X', {
      body: 'Push notifications are working.',
      icon: '/favicon.ico',
    });

    return {
      success: localResult.success,
      deliveredVia: 'local',
      error: localResult.error,
    };
  }

  /**
   * Dispatch categorized alert based on user preferences.
   * Ready for future push integrations (FCM, APNs, Web Push).
   */
  public async dispatchAlert(
    payload: NotificationPayload,
    isCategoryEnabled: boolean
  ): Promise<{ delivered: boolean; reason?: string }> {
    if (!isCategoryEnabled) {
      return { delivered: false, reason: 'Category disabled by user preference.' };
    }

    const result = this.sendLocalNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      tag: payload.tag || payload.category,
      data: payload.data,
    });

    return {
      delivered: result.success,
      reason: result.error,
    };
  }
}

export const notificationService = new NotificationService();
