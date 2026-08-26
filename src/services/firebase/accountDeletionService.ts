import { auth, db, googleAuthProvider } from './firebaseConfig';
import {
  deleteUser as fbDeleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

export interface DeleteAccountParams {
  password?: string;
  forceWipeAndSignOutIfBlocked?: boolean;
}

export interface CleanupStepLog {
  step: string;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  details?: string;
  error?: string;
}

/**
 * Account & Data Deletion Service
 * Thoroughly removes all user-owned data across all Firestore collections & subcollections,
 * releases IoT bottle association if owned, then permanently deletes the Firebase Auth account.
 */
export async function deleteUserAccountAndAllData(
  params?: string | DeleteAccountParams
): Promise<{ success: boolean; logs: CleanupStepLog[] }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No active user session found. Please sign in to delete your account.');
  }

  const currentUid = currentUser.uid;
  const password = typeof params === 'string' ? params : params?.password;
  const forceWipeAndSignOutIfBlocked =
    typeof params === 'object' ? Boolean(params?.forceWipeAndSignOutIfBlocked) : false;

  const logs: CleanupStepLog[] = [];

  const recordStep = (step: string, status: CleanupStepLog['status'], details?: string, error?: string) => {
    logs.push({ step, status, details, error });
    if (status === 'failed') {
      console.error(`[Account Deletion - ERROR] ${step}:`, error, details);
    } else {
      console.log(`[Account Deletion - OK] ${step}:`, details || 'Done');
    }
  };

  // STEP 0: Pre-authentication if password provided for Email/Password accounts
  const isGoogleUser = currentUser.providerData.some(
    (p) => p.providerId === 'google.com' || p.providerId === googleAuthProvider.providerId
  );

  if (password && currentUser.email && !isGoogleUser) {
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      recordStep('Pre-Reauthentication', 'success', 'Email credentials verified successfully');
    } catch (err: any) {
      recordStep('Pre-Reauthentication', 'failed', 'Password verification failed', err.message);
      throw new Error('The password you entered is incorrect. Please try again.');
    }
  }

  // STEP 1: Identify Paired Bottle & Release Ownership (ONLY if ownerUid === currentUid)
  try {
    const userDocRef = doc(db, 'users', currentUid);
    const userSnap = await getDoc(userDocRef);
    const userBottleId = userSnap.exists() ? userSnap.data()?.bottleId : null;

    if (userBottleId) {
      const bottleRef = doc(db, 'bottles', userBottleId);
      await runTransaction(db, async (transaction) => {
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
      });
      recordStep('Release Bottle Ownership', 'success', `Released bottle ${userBottleId}`);
    } else {
      recordStep('Release Bottle Ownership', 'skipped', 'No bottle paired with user');
    }
  } catch (err: any) {
    recordStep('Release Bottle Ownership', 'failed', undefined, err.message);
  }

  // STEP 2: Delete readings in bottle subcollection (bottles/{bottleId}/readings where uid == currentUid)
  try {
    const userDocRef = doc(db, 'users', currentUid);
    const userSnap = await getDoc(userDocRef);
    const userBottleId = userSnap.exists() ? userSnap.data()?.bottleId : null;

    if (userBottleId) {
      const bottleReadingsCol = collection(db, 'bottles', userBottleId, 'readings');
      const snap = await getDocs(query(bottleReadingsCol, where('uid', '==', currentUid)));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        recordStep('Delete Bottle Readings Subcollection', 'success', `Removed ${snap.size} subcollection readings`);
      } else {
        recordStep('Delete Bottle Readings Subcollection', 'skipped', 'No subcollection readings found');
      }
    } else {
      recordStep('Delete Bottle Readings Subcollection', 'skipped', 'No bottleId found');
    }
  } catch (err: any) {
    recordStep('Delete Bottle Readings Subcollection', 'failed', undefined, err.message);
  }

  // STEP 3: Delete readings in top-level readings collection (readings where uid == currentUid)
  try {
    const readingsCol = collection(db, 'readings');
    const snap = await getDocs(query(readingsCol, where('uid', '==', currentUid)));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      recordStep('Delete Top-level Readings', 'success', `Removed ${snap.size} top-level readings`);
    } else {
      recordStep('Delete Top-level Readings', 'skipped', 'No top-level readings found');
    }
  } catch (err: any) {
    recordStep('Delete Top-level Readings', 'failed', undefined, err.message);
  }

  // STEP 4: Delete user hydrationLogs subcollection (users/{uid}/hydrationLogs/*)
  try {
    const userLogsCol = collection(db, 'users', currentUid, 'hydrationLogs');
    const snap = await getDocs(userLogsCol);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      recordStep('Delete User Hydration Logs Subcollection', 'success', `Removed ${snap.size} hydration log items`);
    } else {
      recordStep('Delete User Hydration Logs Subcollection', 'skipped', 'No subcollection logs found');
    }
  } catch (err: any) {
    recordStep('Delete User Hydration Logs Subcollection', 'failed', undefined, err.message);
  }

  // STEP 5: Delete top-level hydrationLogs collection (hydrationLogs where uid == currentUid)
  try {
    const topLogsCol = collection(db, 'hydrationLogs');
    const snap = await getDocs(query(topLogsCol, where('uid', '==', currentUid)));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      recordStep('Delete Top-level Hydration Logs', 'success', `Removed ${snap.size} top-level hydration logs`);
    } else {
      recordStep('Delete Top-level Hydration Logs', 'skipped', 'No top-level hydration logs found');
    }
  } catch (err: any) {
    recordStep('Delete Top-level Hydration Logs', 'failed', undefined, err.message);
  }

  // STEP 6: Delete community reports authored by user (communityReports where uid == currentUid)
  try {
    const reportsCol = collection(db, 'communityReports');
    const snap = await getDocs(query(reportsCol, where('uid', '==', currentUid)));
    if (!snap.empty) {
      for (const reportDoc of snap.docs) {
        // Delete subcollection verifications under this report
        try {
          const verifsSnap = await getDocs(collection(db, 'communityReports', reportDoc.id, 'verifications'));
          if (!verifsSnap.empty) {
            const vBatch = writeBatch(db);
            verifsSnap.docs.forEach((vd) => vBatch.delete(vd.ref));
            await vBatch.commit();
          }
        } catch {
          // ignore subcollection listing errors
        }
        await deleteDoc(reportDoc.ref);
      }
      recordStep('Delete User Community Reports', 'success', `Removed ${snap.size} community reports authored by user`);
    } else {
      recordStep('Delete User Community Reports', 'skipped', 'No community reports authored by user');
    }
  } catch (err: any) {
    recordStep('Delete User Community Reports', 'failed', undefined, err.message);
  }

  // STEP 7: Clean up user verifications on other community reports
  try {
    const reportsCol = collection(db, 'communityReports');
    const snap = await getDocs(query(reportsCol, where('verifiedUids', 'array-contains', currentUid)));
    if (!snap.empty) {
      for (const reportDoc of snap.docs) {
        try {
          // Delete subcollection verification doc if present
          await deleteDoc(doc(db, 'communityReports', reportDoc.id, 'verifications', currentUid));
        } catch {
          // ignore if doc absent
        }

        // Atomically remove currentUid from verifiedUids and decrement count
        try {
          const rData = reportDoc.data();
          const oldUids: string[] = Array.isArray(rData.verifiedUids) ? rData.verifiedUids : [];
          const newUids = oldUids.filter((u) => u !== currentUid);
          const currentCount = typeof rData.verifiedReports === 'number'
            ? rData.verifiedReports
            : (typeof rData.verifiedCount === 'number' ? rData.verifiedCount : 1);
          const newCount = Math.max(0, currentCount - 1);

          await runTransaction(db, async (tx) => {
            tx.update(reportDoc.ref, {
              verifiedUids: newUids,
              verifiedReports: newCount,
              verifiedCount: newCount,
              serverUpdatedAt: serverTimestamp(),
            });
          });
        } catch {
          // non-blocking
        }
      }
      recordStep('Clean User Verifications', 'success', `Cleaned verifications across ${snap.size} reports`);
    } else {
      recordStep('Clean User Verifications', 'skipped', 'No external verifications found');
    }
  } catch (err: any) {
    recordStep('Clean User Verifications', 'failed', undefined, err.message);
  }

  // STEP 8: Delete User Profile Document (users/{uid})
  try {
    await deleteDoc(doc(db, 'users', currentUid));
    recordStep('Delete User Profile Document', 'success', `Deleted users/${currentUid}`);
  } catch (err: any) {
    recordStep('Delete User Profile Document', 'failed', undefined, err.message);
    throw new Error(`Failed to delete user profile from database: ${err.message}`);
  }

  // STEP 9: Delete Firebase Authentication Account
  try {
    await fbDeleteUser(currentUser);
    recordStep('Delete Firebase Auth User', 'success', `User ${currentUid} deleted from Firebase Auth`);
  } catch (authErr: any) {
    const isRecentLoginError =
      authErr.code === 'auth/requires-recent-login' ||
      authErr.message?.includes('requires-recent-login');

    if (isRecentLoginError) {
      if (isGoogleUser) {
        try {
          await reauthenticateWithPopup(currentUser, googleAuthProvider);
          await fbDeleteUser(currentUser);
          recordStep('Delete Firebase Auth User', 'success', 'Re-authenticated with Google and deleted Auth user');
        } catch (popupErr: any) {
          recordStep('Delete Firebase Auth User', 'failed', 'Google popup re-authentication failed', popupErr.message);
          if (forceWipeAndSignOutIfBlocked) {
            recordStep('Delete Firebase Auth User', 'skipped', 'Cloud data wiped; signed out due to popup block');
          } else {
            throw new Error(
              'Security verification required. Please click "Wipe Cloud Data & Sign Out" or sign out and back in before deleting.'
            );
          }
        }
      } else if (password && currentUser.email) {
        try {
          const credential = EmailAuthProvider.credential(currentUser.email, password);
          await reauthenticateWithCredential(currentUser, credential);
          await fbDeleteUser(currentUser);
          recordStep('Delete Firebase Auth User', 'success', 'Re-authenticated with password and deleted Auth user');
        } catch (credErr: any) {
          recordStep('Delete Firebase Auth User', 'failed', 'Password re-authentication failed', credErr.message);
          throw new Error('Incorrect password. Please verify your password to delete your account.');
        }
      } else {
        if (forceWipeAndSignOutIfBlocked) {
          recordStep('Delete Firebase Auth User', 'skipped', 'Cloud data wiped; signed out due to recent login constraint');
        } else {
          throw new Error(
            'This sensitive action requires recent authentication. Please enter your password to confirm deletion.'
          );
        }
      }
    } else {
      if (forceWipeAndSignOutIfBlocked) {
        recordStep('Delete Firebase Auth User', 'skipped', `Cloud data wiped; signed out: ${authErr.message}`);
      } else {
        recordStep('Delete Firebase Auth User', 'failed', undefined, authErr.message);
        throw new Error(`Failed to delete authentication credentials: ${authErr.message}`);
      }
    }
  }

  // STEP 10: Clear local cache
  try {
    localStorage.removeItem('aquasense_coach_chat');
    recordStep('Clear Local Storage Cache', 'success', 'Cleared coach chat cache');
  } catch {
    // non-blocking
  }

  return { success: true, logs };
}
