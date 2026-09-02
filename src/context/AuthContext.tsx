import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserProfile, NotificationPreferences } from '../types';
import { auth, db, googleAuthProvider, getFirebaseErrorMessage } from '../services/firebase/firebaseConfig';
import { ensureKnownBottlesSeeded } from '../services/firebase/seedBottles';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  signInWithPopup,
  sendPasswordResetEmail,
  deleteUser as fbDeleteUser,
  updateProfile as fbUpdateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { deleteUserAccountAndAllData, DeleteAccountParams } from '../services/firebase/accountDeletionService';

export interface DeleteAccountOptions extends DeleteAccountParams {}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isPairingModalOpen: boolean;
  setIsPairingModalOpen: (open: boolean) => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (options?: string | DeleteAccountOptions) => Promise<void>;
  updateUserProfile: (partial: Partial<UserProfile>) => Promise<void>;
  pairBottle: (bottleId: string) => Promise<void>;
  unpairBottle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  drinkReminders: false,
  drinkReminderStart: '08:00',
  drinkReminderEnd: '22:00',
  drinkReminderIntervalMinutes: 60,
  lowBatteryAlerts: false,
};

const VALID_INTERVALS = [15, 30, 60, 90, 120];

const isValidTime = (time?: string): boolean => {
  if (!time || typeof time !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim());
};

const normalizeNotificationSettings = (data?: Partial<UserProfile> | null): NotificationPreferences => {
  const raw = data?.notificationSettings || data?.notifications || DEFAULT_NOTIFICATIONS;

  const start = isValidTime(raw.drinkReminderStart) ? raw.drinkReminderStart.trim() : '08:00';
  const end = isValidTime(raw.drinkReminderEnd) ? raw.drinkReminderEnd.trim() : '22:00';
  const interval = VALID_INTERVALS.includes(Number(raw.drinkReminderIntervalMinutes))
    ? Number(raw.drinkReminderIntervalMinutes)
    : 60;

  return {
    drinkReminders: Boolean(raw.drinkReminders),
    drinkReminderStart: start,
    drinkReminderEnd: end,
    drinkReminderIntervalMinutes: interval,
    lowBatteryAlerts: Boolean(raw.lowBatteryAlerts),
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState<boolean>(false);

  // Initialize auth listener
  useEffect(() => {
    let isMounted = true;

    // Production seed service check (no-op in production)
    ensureKnownBottlesSeeded().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            if (isMounted) {
              const settings = normalizeNotificationSettings(data);
              const resolvedBottleId = data.bottleId || (data as any).assignedBottleId || null;
              setUser({
                ...data,
                bottleId: resolvedBottleId,
                assignedBottleId: resolvedBottleId,
                photoUrl: data.photoUrl || fbUser.photoURL || undefined,
                notificationSettings: settings,
                notifications: settings,
              });
            }
          } else {
            // New user registration via Google or direct OAuth without pre-created doc
            const newProfile: UserProfile = {
              uid: fbUser.uid,
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'AquaSense User',
              email: fbUser.email || '',
              photoUrl: fbUser.photoURL || undefined,
              bottleId: null, // First-time user triggers Bottle Pairing screen
              assignedBottleId: null,
              hydrationGoal: 2500, // Sensible default 2500 ml
              theme: 'dark',
              notificationSettings: DEFAULT_NOTIFICATIONS,
              notifications: DEFAULT_NOTIFICATIONS,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await setDoc(userDocRef, {
              ...newProfile,
              serverCreatedAt: serverTimestamp(),
              serverUpdatedAt: serverTimestamp(),
            });

            if (isMounted) {
              setUser(newProfile);
            }
          }
        } catch (err: any) {
          console.error('Error fetching Firestore user profile:', err);
          if (isMounted) {
            setUser({
              uid: fbUser.uid,
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'AquaSense User',
              email: fbUser.email || '',
              photoUrl: fbUser.photoURL || undefined,
              bottleId: null,
              hydrationGoal: 2500,
              theme: 'dark',
              notificationSettings: DEFAULT_NOTIFICATIONS,
              notifications: DEFAULT_NOTIFICATIONS,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } else {
        if (isMounted) {
          setUser(null);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Login with Email & Password
  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const fbUser = cred.user;
      setFirebaseUser(fbUser);

      // Load Firestore profile
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        const settings = normalizeNotificationSettings(data);
        const resolvedBottleId = (data as any).assignedBottleId || data.bottleId || null;
        setUser({
          ...data,
          assignedBottleId: resolvedBottleId,
          bottleId: resolvedBottleId,
          notificationSettings: settings,
          notifications: settings,
        });
      } else {
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          name: fbUser.displayName || email.split('@')[0],
          email: fbUser.email || email,
          photoUrl: fbUser.photoURL || undefined,
          bottleId: null,
          assignedBottleId: null,
          hydrationGoal: 2500,
          theme: 'dark',
          notificationSettings: DEFAULT_NOTIFICATIONS,
          notifications: DEFAULT_NOTIFICATIONS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, {
          ...newProfile,
          serverCreatedAt: serverTimestamp(),
          serverUpdatedAt: serverTimestamp(),
        });
        setUser(newProfile);
      }
    } catch (error: any) {
      console.error('Firebase login error:', error);
      throw new Error(getFirebaseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Register with Name, Email & Password
  const registerWithEmail = async (name: string, email: string, pass: string) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const fbUser = cred.user;

      await fbUpdateProfile(fbUser, { displayName: name.trim() });
      setFirebaseUser(fbUser);

      // Create users/{uid} Firestore document with clean slate
      const newProfile: UserProfile = {
        uid: fbUser.uid,
        name: name.trim(),
        email: fbUser.email || email.trim(),
        photoUrl: fbUser.photoURL || undefined,
        bottleId: null, // First-time user -> routes to Bottle Pairing
        assignedBottleId: null,
        hydrationGoal: 2500,
        theme: 'dark',
        notificationSettings: DEFAULT_NOTIFICATIONS,
        notifications: DEFAULT_NOTIFICATIONS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const userDocRef = doc(db, 'users', fbUser.uid);
      await setDoc(userDocRef, {
        ...newProfile,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      });

      setUser(newProfile);
    } catch (error: any) {
      console.error('Firebase registration error:', error);
      throw new Error(getFirebaseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In / Sign-Up
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const fbUser = cred.user;
      setFirebaseUser(fbUser);

      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        const settings = normalizeNotificationSettings(data);
        const resolvedBottleId = (data as any).assignedBottleId || data.bottleId || null;
        setUser({
          ...data,
          assignedBottleId: resolvedBottleId,
          bottleId: resolvedBottleId,
          photoUrl: fbUser.photoURL || data.photoUrl || undefined,
          notificationSettings: settings,
          notifications: settings,
        });
      } else {
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          name: fbUser.displayName || 'AquaSense User',
          email: fbUser.email || '',
          photoUrl: fbUser.photoURL || undefined,
          bottleId: null, // New user -> routes to Bottle Pairing
          assignedBottleId: null,
          hydrationGoal: 2500,
          theme: 'dark',
          notificationSettings: DEFAULT_NOTIFICATIONS,
          notifications: DEFAULT_NOTIFICATIONS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(userDocRef, {
          ...newProfile,
          serverCreatedAt: serverTimestamp(),
          serverUpdatedAt: serverTimestamp(),
        });

        setUser(newProfile);
      }
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        console.info('Google sign-in popup was closed or cancelled by user.');
        const customErr = new Error(getFirebaseErrorMessage(error));
        (customErr as any).code = code;
        throw customErr;
      }
      console.error('Firebase Google sign-in error:', error);
      const customErr = new Error(getFirebaseErrorMessage(error));
      (customErr as any).code = code;
      throw customErr;
    } finally {
      setLoading(false);
    }
  };

  // Send Password Reset Email
  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error: any) {
      console.error('Firebase password reset error:', error);
      throw new Error(getFirebaseErrorMessage(error));
    }
  };

  // Sign out
  const signOut = async () => {
    setLoading(true);
    try {
      await fbSignOut(auth);
    } catch (error: any) {
      console.error('Firebase sign out error:', error);
    } finally {
      setFirebaseUser(null);
      setUser(null);
      setIsPairingModalOpen(false);
      setLoading(false);
    }
  };

  // Delete account with robust full data wiping
  const deleteAccount = async (options?: string | DeleteAccountOptions) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No active user session found.');
    }

    setLoading(true);
    try {
      const result = await deleteUserAccountAndAllData(options);
      if (result.success) {
        setFirebaseUser(null);
        setUser(null);
        setIsPairingModalOpen(false);
      }
    } catch (error: any) {
      console.error('Account deletion error:', error);
      throw new Error(getFirebaseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Update user profile fields in Firestore
  const updateUserProfile = async (partial: Partial<UserProfile>) => {
    if (!user || !auth.currentUser) {
      throw new Error('You must be signed in to update your profile.');
    }

    const previousUser = user;
    const updated: UserProfile = {
      ...user,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    // Optimistic local state update
    setUser(updated);

    try {
      const userRef = doc(db, 'users', user.uid);

      // Clean payload to ensure no undefined values reach Firestore
      const cleanData: Record<string, any> = {
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp(),
      };

      for (const [key, value] of Object.entries(partial)) {
        if (value !== undefined) {
          if (key === 'notificationSettings' && typeof value === 'object' && value !== null) {
            const cleanSettings: Record<string, any> = {};
            for (const [sKey, sVal] of Object.entries(value)) {
              if (sVal !== undefined) {
                cleanSettings[sKey] = sVal;
              }
            }
            cleanData[key] = cleanSettings;
          } else {
            cleanData[key] = value;
          }
        }
      }

      await updateDoc(userRef, cleanData);
    } catch (err: any) {
      console.error('Error updating user profile in Firestore:', err);
      // Rollback on failure
      setUser(previousUser);
      throw new Error(getFirebaseErrorMessage(err));
    }
  };

  // Pair bottle with strict physical hardware validation & single-user ownership locking
  const pairBottle = async (bottleId: string) => {
    if (!user || !auth.currentUser) throw new Error('You must be signed in to pair a bottle.');
    const cleaned = bottleId.trim().toUpperCase();
    const currentUid = auth.currentUser.uid;

    const bottleRef = doc(db, 'bottles', cleaned);
    const userRef = doc(db, 'users', currentUid);

    try {
      await runTransaction(db, async (transaction) => {
        const bottleSnap = await transaction.get(bottleRef);

        // Condition 1 (Invalid Device): If the document bottles/{BOTTLE_ID} DOES NOT exist in Firestore
        if (!bottleSnap.exists()) {
          throw new Error('Invalid Bottle ID. Please enter a valid identifier printed on your AquaSense X device.');
        }

        const bottleData = bottleSnap.data();
        const existingOwnerUid = bottleData.ownerUid ? String(bottleData.ownerUid).trim() : null;

        // Condition 2 (Already Claimed): If the document exists AND ownerUid is non-null AND ownerUid !== currentUserId
        if (existingOwnerUid && existingOwnerUid !== currentUid) {
          throw new Error('This bottle is already linked to another account. Contact support if this is an error.');
        }

        // Condition 3 (Success / Ownership Claim): If document exists AND (ownerUid is null/empty OR ownerUid === currentUserId)
        // Check if user previously had another bottle registered and release previous ownership
        const userSnap = await transaction.get(userRef);
        const prevBottleId = userSnap.exists()
          ? (userSnap.data()?.assignedBottleId || userSnap.data()?.bottleId)
          : (user?.assignedBottleId || user?.bottleId);

        if (prevBottleId && prevBottleId !== cleaned) {
          const prevBottleRef = doc(db, 'bottles', prevBottleId);
          const prevBottleSnap = await transaction.get(prevBottleRef);
          if (prevBottleSnap.exists() && prevBottleSnap.data()?.ownerUid === currentUid) {
            transaction.update(prevBottleRef, {
              ownerUid: null,
              serverUpdatedAt: serverTimestamp(),
            });
          }
        }

        // Atomically update bottles/{BOTTLE_ID} with ownerUid: currentUserId
        transaction.update(bottleRef, {
          ownerUid: currentUid,
          serverUpdatedAt: serverTimestamp(),
        });

        // Atomically update users/{currentUserId} with assignedBottleId: BOTTLE_ID
        transaction.update(userRef, {
          assignedBottleId: cleaned,
          bottleId: cleaned,
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });
      });

      // Update local React state after transaction succeeds
      setUser((prev) =>
        prev
          ? {
              ...prev,
              assignedBottleId: cleaned,
              bottleId: cleaned,
              updatedAt: new Date().toISOString(),
            }
          : null
      );

      setIsPairingModalOpen(false);
    } catch (err: any) {
      console.error('Error pairing bottle:', err);
      if (
        err.message === 'Invalid Bottle ID. Please enter a valid identifier printed on your AquaSense X device.' ||
        err.message === 'This bottle is already linked to another account. Contact support if this is an error.'
      ) {
        throw err;
      }
      if (
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions')
      ) {
        throw new Error('This bottle is already linked to another account. Contact support if this is an error.');
      }
      throw new Error(err.message || 'Invalid Bottle ID. Please enter a valid identifier printed on your AquaSense X device.');
    }
  };

  // Unpair / Change bottle
  const unpairBottle = async () => {
    if (!auth.currentUser) throw new Error('You must be signed in to change a bottle.');
    const currentUid = auth.currentUser.uid;
    const userDocRef = doc(db, 'users', currentUid);

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userDocRef);
        const currentBottleId = userSnap.exists()
          ? (userSnap.data()?.bottleId || userSnap.data()?.assignedBottleId)
          : (user?.bottleId || user?.assignedBottleId);

        if (currentBottleId) {
          const bottleRef = doc(db, 'bottles', currentBottleId);
          const bottleSnap = await transaction.get(bottleRef);

          if (bottleSnap.exists()) {
            const bData = bottleSnap.data();
            if (bData.ownerUid === currentUid) {
              transaction.update(bottleRef, {
                ownerUid: null,
                lastUpdated: new Date().toISOString(),
                serverUpdatedAt: serverTimestamp(),
              });
            }
          }
        }

        if (userSnap.exists()) {
          transaction.update(userDocRef, {
            bottleId: null,
            assignedBottleId: null,
            updatedAt: new Date().toISOString(),
            serverUpdatedAt: serverTimestamp(),
          });
        }
      });

      setUser((prev) =>
        prev
          ? {
              ...prev,
              bottleId: null,
              assignedBottleId: null,
              updatedAt: new Date().toISOString(),
            }
          : null
      );

      setIsPairingModalOpen(true);
    } catch (err: any) {
      console.error('Error during unpair bottle transaction:', err);
      throw new Error(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isPairingModalOpen,
        setIsPairingModalOpen,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        sendPasswordReset,
        signOut,
        deleteAccount,
        updateUserProfile,
        pairBottle,
        unpairBottle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
