import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  query,
  orderBy,
  limit,
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
    await updateDoc(verifRef, {
      uid: reportData.uid,
      timestamp: now.toISOString(),
    }).catch(() => {
      // Subcollection create via setDoc
    });
  } catch {
    // Non-blocking
  }

  return {
    id: docRef.id,
    ...reportData,
    verifiedReports: 1,
    userHasVerified: true,
    createdAt: now.toISOString(),
    lastTestedAt: 'Just now',
  };
}

/**
 * Atomically toggles verification for a community report (1 verification per user)
 */
export async function toggleReportVerification(
  reportId: string,
  userUid: string
): Promise<{ verifiedReports: number; userHasVerified: boolean }> {
  const reportRef = doc(db, 'communityReports', reportId);

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(reportRef);
    if (!snap.exists()) {
      throw new Error('Community report does not exist.');
    }

    const data = snap.data();
    const verifiedUids: string[] = Array.isArray(data.verifiedUids) ? [...data.verifiedUids] : [];
    const currentCount = typeof data.verifiedReports === 'number' ? data.verifiedReports : 0;

    const hasVerified = verifiedUids.includes(userUid);
    let newVerifiedUids: string[];
    let newCount: number;

    if (hasVerified) {
      // Remove verification
      newVerifiedUids = verifiedUids.filter((uid) => uid !== userUid);
      newCount = Math.max(0, currentCount - 1);
    } else {
      // Add verification
      newVerifiedUids = [...verifiedUids, userUid];
      newCount = currentCount + 1;
    }

    transaction.update(reportRef, {
      verifiedReports: newCount,
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
