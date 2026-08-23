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
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

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
  deleteAccount: () => Promise<void>;
  updateUserProfile: (partial: Partial<UserProfile>) => Promise<void>;
  pairBottle: (bottleId: string) => Promise<void>;
  unpairBottle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  drinkReminders: true,
  waterQualityAlerts: true,
  nearbyCommunitySourceAlerts: true,
  lowBatteryAlerts: true,
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState<boolean>(false);

  // Initialize bottle registry & auth listener
  useEffect(() => {
    let isMounted = true;

    // Seed default bottles if not present in Firestore
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
              setUser({
                ...data,
                // Ensure photoUrl from Google Auth is captured if not present in doc
                photoUrl: data.photoUrl || fbUser.photoURL || undefined,
                notificationSettings: data.notificationSettings || data.notifications || DEFAULT_NOTIFICATIONS,
                notifications: data.notificationSettings || data.notifications || DEFAULT_NOTIFICATIONS,
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
        setUser({
          ...data,
          notificationSettings: data.notificationSettings || data.notifications || DEFAULT_NOTIFICATIONS,
          notifications: data.notificationSettings || data.notifications || DEFAULT_NOTIFICATIONS,
        });
      } else {
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          name: fbUser.displayName || email.split('@')[0],
          email: fbUser.email || email,
          photoUrl: fbUser.photoURL || undefined,
          bottleId: null,
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

      // Update Firebase Auth display name
      await fbUpdateProfile(fbUser, { displayName: name.trim() });
      setFirebaseUser(fbUser);

      // Create users/{uid} Firestore document with bottleId = null
      const newProfile: UserProfile = {
        uid: fbUser.uid,
        name: name.trim(),
        email: fbUser.email || email.trim(),
        photoUrl: fbUser.photoURL || undefined,
        bottleId: null, // First-time user -> routes to Bottle Pairing
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
        setUser({
          ...data,
          photoUrl: fbUser.photoURL || data.photoUrl || undefined,
          notificationSettings: data.notificationSettings || data.notifications || DEFAULT_NOTIFICATIONS,
          notifications: data.notificationSettings || data.notifications || DEFAULT_NOTIFICATIONS,
        });
      } else {
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          name: fbUser.displayName || 'AquaSense User',
          email: fbUser.email || '',
          photoUrl: fbUser.photoURL || undefined,
          bottleId: null, // New user -> routes to Bottle Pairing
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
      console.error('Firebase Google sign-in error:', error);
      throw new Error(getFirebaseErrorMessage(error));
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

  // Delete account
  const deleteAccount = async () => {
    if (!user || !auth.currentUser) return;
    setLoading(true);
    try {
      const currentUid = user.uid;
      const currentBottleId = user.bottleId;

      // Disassociate bottle if exists
      if (currentBottleId) {
        try {
          const bottleRef = doc(db, 'bottles', currentBottleId);
          await updateDoc(bottleRef, {
            ownerUid: null,
            lastUpdated: new Date().toISOString(),
            serverUpdatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn('Could not release bottle ownership:', e);
        }
      }

      // Delete user document from Firestore
      try {
        await deleteDoc(doc(db, 'users', currentUid));
      } catch (e) {
        console.warn('Could not delete Firestore user doc:', e);
      }

      // Delete Firebase Auth user
      await fbDeleteUser(auth.currentUser);
    } catch (error: any) {
      console.error('Account deletion error:', error);
      throw new Error(getFirebaseErrorMessage(error));
    } finally {
      setFirebaseUser(null);
      setUser(null);
      setLoading(false);
    }
  };

  // Update user profile fields in Firestore
  const updateUserProfile = async (partial: Partial<UserProfile>) => {
    if (!user) return;
    const updated: UserProfile = {
      ...user,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    setUser(updated);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...partial,
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating user profile in Firestore:', err);
    }
  };

  // Pair bottle with Firestore verification & ownership association
  const pairBottle = async (bottleId: string) => {
    if (!user) throw new Error('You must be signed in to pair a bottle.');
    const cleaned = bottleId.trim().toUpperCase();

    // 1. Find and verify bottle in Firestore
    const bottleRef = doc(db, 'bottles', cleaned);
    const bottleSnap = await getDoc(bottleRef);

    if (!bottleSnap.exists()) {
      // Must return exact message as requested
      throw new Error('Could not find this AquaSense X bottle.');
    }

    const bottleData = bottleSnap.data();
    // 2. Verify bottle is not already owned by another user
    if (bottleData.ownerUid && bottleData.ownerUid !== user.uid) {
      // Must return exact message as requested
      throw new Error('This bottle is already paired with another account.');
    }

    // 3. Associate ownerUid with current user's UID
    await updateDoc(bottleRef, {
      ownerUid: user.uid,
      lastUpdated: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    });

    // 4. Save bottleId in users/{uid}
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      bottleId: cleaned,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    });

    // 5. Update state
    setUser({
      ...user,
      bottleId: cleaned,
      updatedAt: new Date().toISOString(),
    });

    setIsPairingModalOpen(false);
  };

  // Unpair / Change bottle (Profile -> My Bottle -> Change Bottle)
  const unpairBottle = async () => {
    if (!user) return;
    const currentBottle = user.bottleId;

    if (currentBottle) {
      try {
        const bottleRef = doc(db, 'bottles', currentBottle);
        await updateDoc(bottleRef, {
          ownerUid: null,
          lastUpdated: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Could not release bottle ownership:', err);
      }
    }

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      bottleId: null,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    });

    setUser({
      ...user,
      bottleId: null,
      updatedAt: new Date().toISOString(),
    });

    setIsPairingModalOpen(true);
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
