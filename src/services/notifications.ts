/**
 * AquaSense X Push Notifications & FCM Service
 * Handles notification permission requests, service worker registration,
 * FCM device token retrieval (using VAPID key), and persistence to Firestore users/{uid}/fcmTokens.
 */

import { getMessaging, getToken, onMessage, isSupported, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, auth, getVapidPublicKey } from './firebase/firebaseConfig';
import { notificationService } from './notifications/notificationService';

export interface FCMTokenSaveResult {
  token: string | null;
  error?: string;
}

/**
 * Request notification permission from the browser.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[AquaSense Notifications] Web Notifications are not supported in this environment.');
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.warn('[AquaSense Notifications] Error requesting permission:', error);
    return Notification.permission;
  }
}

/**
 * Register the public/firebase-messaging-sw.js Service Worker.
 */
export async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.warn('[AquaSense Notifications] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Retrieve the FCM Web Push Token using the VAPID key and optionally persist to Firestore.
 */
export async function getFCMToken(uid?: string): Promise<FCMTokenSaveResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { token: null, error: 'Service workers are not supported.' };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return { token: null, error: 'Firebase Cloud Messaging is not supported in this browser.' };
  }

  const vapidKey = getVapidPublicKey() || import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return { token: null, error: 'VITE_FIREBASE_VAPID_KEY is not defined in environment variables.' };
  }

  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return { token: null, error: 'Notification permission was not granted.' };
    }

    const swReg = await registerMessagingServiceWorker();
    if (!swReg) {
      return { token: null, error: 'Could not register service worker.' };
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    const targetUid = uid || auth.currentUser?.uid;
    if (token && targetUid) {
      await saveFCMTokenToFirestore(targetUid, token);
    }

    return { token };
  } catch (err: any) {
    console.error('[AquaSense Notifications] Error obtaining FCM token:', err);
    return { token: null, error: err?.message || 'Failed to retrieve FCM token' };
  }
}

/**
 * Save an FCM device token under users/{uid}/fcmTokens/{tokenHash}.
 */
export async function saveFCMTokenToFirestore(uid: string, token: string): Promise<void> {
  if (!uid || !token) return;

  try {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const tokenDocId = `web_${token.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '')}_${Math.abs(hash).toString(36)}`;
    const tokenRef = doc(db, 'users', uid, 'fcmTokens', tokenDocId);

    await setDoc(
      tokenRef,
      {
        token,
        platform: 'web',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser',
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('[AquaSense Notifications] Error persisting FCM token to Firestore:', error);
  }
}

/**
 * Initialize all push notification requirements and attach foreground listener.
 */
export async function initializePushNotifications(
  uid?: string,
  onForegroundMessage?: (payload: MessagePayload) => void
): Promise<string | null> {
  const result = await getFCMToken(uid);
  if (result.token) {
    try {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        if (onForegroundMessage) {
          onForegroundMessage(payload);
        }
        if (payload.notification?.title) {
          notificationService.sendLocalNotification(payload.notification.title, {
            body: payload.notification.body,
            icon: payload.notification.icon || '/favicon.ico',
          });
        }
      });
    } catch (e) {
      console.warn('[AquaSense Notifications] Could not attach onMessage handler:', e);
    }
  }
  return result.token;
}

export { notificationService };
export default notificationService;
