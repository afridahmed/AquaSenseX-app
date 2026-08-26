import {
  collection,
  doc,
  addDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { CommunityReport } from '../../types';

/**
 * Validates GPS coordinates according to international standards
 */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Creates a new public community water source report in Firestore
 */
export async function createCommunityReport(
  reportData: Omit<CommunityReport, 'id' | 'createdAt' | 'lastTestedAt'>
): Promise<CommunityReport> {
  if (!isValidCoordinates(reportData.latitude, reportData.longitude)) {
    throw new Error('Invalid GPS coordinates for community report.');
  }

  const now = new Date();
  const fullData = {
    ...reportData,
    verifiedReports: 1, // Author starts with initial verification
    verifiedCount: 1,
    verifiedUids: [reportData.uid],
    createdAt: now.toISOString(),
    lastTestedAt: 'Just now',
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };

  const colRef = collection(db, 'communityReports');
  const docRef = await addDoc(colRef, fullData);

  // Also create subcollection record for the author's verification
  try {
    const verifRef = doc(db, 'communityReports', docRef.id, 'verifications', reportData.uid);
    await setDoc(verifRef, {
      uid: reportData.uid,
      verifiedAt: now.toISOString(),
    });
  } catch {
    // Non-blocking
  }

  return {
    id: docRef.id,
    ...reportData,
    verifiedReports: 1,
    verifiedCount: 1,
    userHasVerified: true,
    createdAt: now.toISOString(),
    lastTestedAt: 'Just now',
  };
}

/**
 * Atomically toggles verification for a community report (1 verification per user)
 * Writes to both the parent report aggregate counters and the per-user subcollection
 */
export async function toggleReportVerification(
  reportId: string,
  userUid: string,
  fallbackReport?: Partial<CommunityReport>
): Promise<{ verifiedReports: number; userHasVerified: boolean }> {
  const reportRef = doc(db, 'communityReports', reportId);
  const verifRef = doc(db, 'communityReports', reportId, 'verifications', userUid);

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(reportRef);
    
    if (!snap.exists()) {
      // If this is an initial starter report not yet committed to Firestore
      const initialCount = fallbackReport?.verifiedReports ?? 1;
      const initialUids = Array.isArray(fallbackReport?.verifiedUids) ? fallbackReport.verifiedUids : [];
      const hasVerified = initialUids.includes(userUid);
      
      const newVerifiedUids = hasVerified ? initialUids.filter((u) => u !== userUid) : [...initialUids, userUid];
      const newCount = hasVerified ? Math.max(0, initialCount - 1) : initialCount + 1;

      transaction.set(reportRef, {
        id: reportId,
        uid: fallbackReport?.uid || 'community_seed',
        bottleId: fallbackReport?.bottleId || 'ASX-9821-4402',
        authorName: fallbackReport?.authorName || 'Community Member',
        sourceName: fallbackReport?.sourceName || 'Public Water Source',
        sourceType: fallbackReport?.sourceType || 'fountain',
        latitude: fallbackReport?.latitude ?? 37.7749,
        longitude: fallbackReport?.longitude ?? -122.4194,
        qualityScore: fallbackReport?.qualityScore ?? 85,
        temperature: fallbackReport?.temperature ?? 18,
        tds: fallbackReport?.tds ?? 150,
        turbidity: fallbackReport?.turbidity ?? 0.5,
        ph: fallbackReport?.ph ?? 7.2,
        verifiedReports: newCount,
        verifiedCount: newCount,
        verifiedUids: newVerifiedUids,
        notes: fallbackReport?.notes || '',
        createdAt: fallbackReport?.createdAt || new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      });

      if (hasVerified) {
        transaction.delete(verifRef);
      } else {
        transaction.set(verifRef, {
          uid: userUid,
          verifiedAt: new Date().toISOString(),
        });
      }

      return {
        verifiedReports: newCount,
        userHasVerified: !hasVerified,
      };
    }

    const data = snap.data();
    const verifiedUids: string[] = Array.isArray(data.verifiedUids) ? [...data.verifiedUids] : [];
    const currentCount = typeof data.verifiedReports === 'number' 
      ? data.verifiedReports 
      : (typeof data.verifiedCount === 'number' ? data.verifiedCount : 0);

    const hasVerified = verifiedUids.includes(userUid);
    let newVerifiedUids: string[];
    let newCount: number;

    if (hasVerified) {
      // Remove verification
      newVerifiedUids = verifiedUids.filter((uid) => uid !== userUid);
      newCount = Math.max(0, currentCount - 1);
      transaction.delete(verifRef);
    } else {
      // Add verification
      newVerifiedUids = [...verifiedUids, userUid];
      newCount = currentCount + 1;
      transaction.set(verifRef, {
        uid: userUid,
        verifiedAt: new Date().toISOString(),
      });
    }

    transaction.update(reportRef, {
      verifiedReports: newCount,
      verifiedCount: newCount,
      verifiedUids: newVerifiedUids,
      serverUpdatedAt: serverTimestamp(),
    });

    return {
      verifiedReports: newCount,
      userHasVerified: !hasVerified,
    };
  });
}

/**
 * Formats relative time description for last tested
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (3600 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 3600 * 1000));

  if (diffMins < 5) return 'Just now';
  if (diffMins < 60) return `Tested ${diffMins}m ago`;
  if (diffHours < 24) return `Tested ${diffHours}h ago`;
  if (diffDays === 1) return 'Tested yesterday';
  if (diffDays < 30) return `Tested ${diffDays}d ago`;
  return `Tested on ${date.toLocaleDateString()}`;
}

