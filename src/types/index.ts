export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  bottleId: string | null;
  hydrationGoal: number; // in ml, e.g. 2500
  theme: 'dark' | 'light' | 'system';
  notificationSettings: NotificationPreferences;
  notifications?: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  drinkReminders: boolean;
  waterQualityAlerts: boolean;
  nearbyCommunitySourceAlerts: boolean;
  lowBatteryAlerts: boolean;
  fcmToken?: string;
}

export interface BottleData {
  bottleId: string;
  ownerUid: string | null;
  online: boolean;
  battery: number; // 0 - 100 %
  temperature: number; // °C
  tds: number; // ppm
  turbidity: number; // NTU
  ph: number; // 0 - 14
  waterLevel: number; // in ml, e.g. 0 - 750 ml
  maxCapacity?: number; // e.g. 750 ml
  lastUpdated: string;
  isDevelopment?: boolean;
  qualityScore?: number;
  qualityCategory?: WaterQualityCategory;
  isStale?: boolean;
}

export interface SensorReading {
  id?: string;
  uid?: string;
  bottleId: string;
  temperature: number;
  tds: number;
  turbidity: number;
  ph: number;
  waterLevel: number;
  qualityScore: number;
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
  verifiedUids?: string[];
  createdAt: string;
  lastTestedAt: string;
  authorName?: string;
  sourceType?: 'fountain' | 'tap' | 'spring' | 'filtration_station' | 'well' | 'other' | string;
  userHasVerified?: boolean;
  notes?: string;
  distanceKm?: number;
}

export type WaterQualityCategory = 'Excellent' | 'Good' | 'Caution' | 'Poor';

export interface QualityParameterDetail {
  name: string;
  value: number;
  unit: string;
  status: 'optimal' | 'acceptable' | 'warning' | 'danger';
  idealRange: string;
  description: string;
  scoreContribution: number; // 0 - 100
}

export interface WaterQualityEvaluation {
  score: number; // 0 - 100
  category: WaterQualityCategory;
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
