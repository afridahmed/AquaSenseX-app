export type TrackingMode = 'smart_sync' | 'manual';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  bottleId: string | null;
  assignedBottleId?: string | null;
  hydrationGoal: number; // in ml, e.g. 2500
  trackingMode?: TrackingMode;
  theme: 'dark' | 'light' | 'system';
  notificationSettings: NotificationPreferences;
  notifications?: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  drinkReminders: boolean;
  drinkReminderStart: string; // HH:mm format, e.g. "08:00"
  drinkReminderEnd: string; // HH:mm format, e.g. "22:00"
  drinkReminderIntervalMinutes: number; // 15 | 30 | 60 | 90 | 120
  lowBatteryAlerts: boolean;
}

export interface FCMTokenRecord {
  token: string;
  platform: 'web' | 'ios' | 'android';
  userAgent: string;
  createdAt: string;
  updatedAt: string;
}

export interface BottleData {
  bottleId: string;
  ownerUid: string | null;
  online: boolean;
  battery: number; // 0 - 100 %
  temperature: number | null; // °C
  tds: number | null; // ppm
  turbidity: number | null; // NTU
  ph: number | null; // 0 - 14
  waterLevel: number | null; // ESP32 ToF percentage 0-100% (mapped to ml via maxCapacity)
  maxCapacity?: number; // Physical bottle capacity in ml (default: 2000 ml = 2L)
  lastUpdated: string;
  lastSyncTimestamp?: string;
  isDevelopment?: boolean;
  qualityScore?: number | null;
  qualityCategory?: WaterQualityCategory | 'Offline' | 'Awaiting Connection';
  isStale?: boolean;
  triggerVibration?: boolean; // Set true to trigger ESP32 vibration motor on PIN 14; firmware resets to false after vibrating
  triggerVibrationAt?: any; // Firestore ServerTimestamp of when vibration was last triggered
}


export interface SensorReading {
  id?: string;
  uid?: string;
  bottleId: string;
  temperature: number | null;
  tds: number | null;
  turbidity: number | null;
  ph: number | null;
  waterLevel: number;
  qualityScore: number | null;
  timestamp: string;
  notes?: string;
}

export interface HydrationLog {
  id: string;
  uid?: string;
  amountMl: number;
  timestamp: string;
  source: 'bottle_auto' | 'manual_add' | 'quick_preset' | string;
  note?: string;
  optionalNote?: string;
}

export interface CommunityReport {
  id: string;
  uid: string;
  bottleId: string;
  sourceName: string;
  latitude: number;
  longitude: number;
  qualityScore: number;
  temperature: number;
  tds: number;
  turbidity: number;
  ph: number;
  verifiedReports: number;
  verifiedCount?: number;
  verifiedUids?: string[];
  createdAt: string;
  lastTestedAt: string;
  authorName?: string;
  sourceType?: 'fountain' | 'tap' | 'spring' | 'filtration_station' | 'well' | 'other' | string;
  userHasVerified?: boolean;
  notes?: string;
  distanceKm?: number;
  originalDeviceLat?: number;
  originalDeviceLon?: number;
  gpsAccuracy?: number;
  adjustmentDistanceMeters?: number;
}

export type WaterQualityCategory = 'Excellent' | 'Good' | 'Caution' | 'Poor';

export interface QualityParameterDetail {
  name: string;
  value: number | null | undefined;
  unit: string;
  status: 'optimal' | 'acceptable' | 'warning' | 'danger';
  idealRange: string;
  description: string;
  scoreContribution: number; // 0 - 100
}

export interface WaterQualityEvaluation {
  score: number | null; // 0 - 100 or null when offline
  category: WaterQualityCategory | 'Offline';
  headline: string;
  description: string;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  parameters: {
    ph: QualityParameterDetail;
    tds: QualityParameterDetail;
    turbidity: QualityParameterDetail;
    temperature: QualityParameterDetail;
  };
  safetyDisclaimer: string;
  isDrinkable: boolean;
}

export interface AICoachMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  contextUsed?: {
    score?: number;
    ph?: number;
    tds?: number;
    turbidity?: number;
    consumed?: number;
  };
}

export type NavTab = 'dashboard' | 'community' | 'coach' | 'profile';
