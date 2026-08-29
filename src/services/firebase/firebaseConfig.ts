import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore with configured database ID
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Google Auth Provider configured for popups
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

// Lazy & safe Firebase Cloud Messaging initialization guarded by isSupported()
let messagingInstance: Messaging | null = null;
let messagingChecked = false;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (messagingChecked) return messagingInstance;

  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
    }
  } catch (err) {
    console.warn('Firebase Messaging isSupported() check:', err);
    messagingInstance = null;
  } finally {
    messagingChecked = true;
  }

  return messagingInstance;
}

/**
 * Retrieve the Firebase Web Push VAPID Public Key from environment or applet config
 */
export function getVapidPublicKey(): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_VAPID_KEY) {
    return String(import.meta.env.VITE_FIREBASE_VAPID_KEY).trim();
  }
  if ((firebaseConfig as any).vapidKey) {
    return String((firebaseConfig as any).vapidKey).trim();
  }
  return undefined;
}

/**
 * Human-friendly error translation for Firebase Authentication and Firestore errors
 */
export function getFirebaseErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = error.code || '';
  const message = error.message || '';

  switch (code) {
    case 'auth/requires-recent-login':
      return 'Account deletion is a sensitive operation that requires recent authentication. Please confirm your credentials or sign in again to verify.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return 'Invalid credentials or account not found. If you are a new user, please click "Sign Up" below to create your account.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters with letters and numbers.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact AquaSense support.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser or iframe security settings. You can allow popups or use "Wipe Data & Sign Out" below.';
    case 'auth/cancelled-popup-request':
      return 'Previous authentication request was cancelled.';
    case 'auth/too-many-requests':
      return 'Access temporarily restricted due to multiple failed attempts. Please try again shortly.';
    case 'auth/network-request-failed':
      return 'Unable to connect to AquaSense Cloud. Please check your internet connection.';
    case 'permission-denied':
      return 'Permission denied by security rules. You do not have access to this resource.';
    case 'not-found':
      return 'The requested resource was not found on AquaSense Cloud.';
    case 'unavailable':
      return 'AquaSense Cloud service is temporarily unavailable. Please retry in a moment.';
    default:
      if (message.includes('requires-recent-login')) {
        return 'Account deletion is a sensitive operation that requires recent authentication. Please verify your credentials to continue.';
      }
      if (message.includes('network') || message.includes('offline')) {
        return 'Network connection issue. Please check your internet connection.';
      }
      return message && !message.includes('Firebase:') ? message : 'Unable to complete operation. Please try again.';
  }
}

export { app };
