import {
  locationService,
  REPORT_LOCATION_ADJUSTMENT_RADIUS_METERS,
  REPORT_LOCATION_ADJUSTMENT_RADIUS_KM,
} from '../location/locationService';

export interface GeocodingResult {
  placeId: string | number;
  displayName: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
}

export interface AcquiredLocation {
  lat: number;
  lon: number;
  accuracy?: number;
  placeName: string;
  source: 'gps' | 'network' | 'ip' | 'preset';
  isApproximate?: boolean;
}

export interface CityPreset {
  name: string;
  region: string;
  lat: number;
  lon: number;
}

export const POPULAR_CITY_PRESETS: CityPreset[] = [
  { name: 'San Francisco', region: 'CA, USA', lat: 37.7749, lon: -122.4194 },
  { name: 'New York', region: 'NY, USA', lat: 40.7128, lon: -74.0060 },
  { name: 'London', region: 'UK', lat: 51.5074, lon: -0.1278 },
  { name: 'Tokyo', region: 'Japan', lat: 35.6762, lon: 139.6503 },
  { name: 'Singapore', region: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Sydney', region: 'Australia', lat: -33.8688, lon: 151.2093 },
  { name: 'Austin', region: 'TX, USA', lat: 30.2672, lon: -97.7431 },
  { name: 'Seattle', region: 'WA, USA', lat: 47.6062, lon: -122.3321 },
];

/**
 * OpenStreetMap Nominatim Geocoding Service with Multi-Tiered Geolocation Fallback
 * Provides forward search, reverse geocoding, and resilient GPS/Network/IP location detection.
 */
class GeocodingService {
  private cache: Map<string, GeocodingResult[]> = new Map();
  private reverseCache: Map<string, string> = new Map();

  /**
   * Search for locations by query text (city, address, landmark, place name)
   */
  async search(query: string): Promise<GeocodingResult[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const cacheKey = trimmed.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&limit=6&addressdetails=1`;

      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Geocoding HTTP error ${response.status}`);
      }

      const data = await response.json();
      const results: GeocodingResult[] = (data || []).map((item: any) => ({
        placeId: item.place_id,
        displayName: item.display_name,
        name: item.name || item.display_name.split(',')[0],
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type || item.class || 'location',
      })).filter((item: GeocodingResult) => !isNaN(item.lat) && !isNaN(item.lon));

      this.cache.set(cacheKey, results);
      return results;
    } catch (err) {
      console.warn('Nominatim geocoding search fallback:', err);
      return [];
    }
  }

  /**
   * Reverse geocode latitude and longitude to a human-readable location name
   */
  async reverseGeocode(lat: number, lon: number): Promise<string> {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (this.reverseCache.has(cacheKey)) {
      return this.reverseCache.get(cacheKey)!;
    }

    try {
      const endpoint = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Reverse geocoding error ${response.status}`);
      }

      const data = await response.json();
      const name = data.display_name || data.name || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
      // Shorten display name for compact UI
      const shortName = name.split(',').slice(0, 3).join(', ').trim();
      this.reverseCache.set(cacheKey, shortName);
      return shortName;
    } catch (err) {
      console.warn('Reverse geocode fallback:', err);
      return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    }
  }

  /**
   * Attempt IP-based approximate geolocation when hardware GPS is blocked, unavailable, or times out
   */
  async getIpLocation(): Promise<AcquiredLocation | null> {
    // 1. Try FreeIPAPI (CORS enabled, fast)
    try {
      const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const d = await res.json();
        if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
          const place = [d.cityName, d.regionName, d.countryName].filter(Boolean).join(', ') || 'Approximate Network Location';
          return {
            lat: d.latitude,
            lon: d.longitude,
            accuracy: 8000,
            placeName: place,
            source: 'ip',
            isApproximate: true,
          };
        }
      }
    } catch {
      // Try next fallback
    }

    // 2. Try ipwho.is (CORS enabled)
    try {
      const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const d = await res.json();
        if (d.success && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
          const place = [d.city, d.region, d.country].filter(Boolean).join(', ') || 'Approximate Network Location';
          return {
            lat: d.latitude,
            lon: d.longitude,
            accuracy: 8000,
            placeName: place,
            source: 'ip',
            isApproximate: true,
          };
        }
      }
    } catch {
      // Try next fallback
    }

    // 3. Try ipapi.co
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const d = await res.json();
        if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
          const place = [d.city, d.region, d.country_name].filter(Boolean).join(', ') || 'Approximate Network Location';
          return {
            lat: d.latitude,
            lon: d.longitude,
            accuracy: 8000,
            placeName: place,
            source: 'ip',
            isApproximate: true,
          };
        }
      }
    } catch {
      // All IP services exhausted
    }

    return null;
  }

  /**
   * Resilient multi-tiered location acquisition:
   * Tier 1: Hardware GPS (High Accuracy)
   * Tier 2: Network / Wi-Fi Geolocation (Low Accuracy)
   * Tier 3: IP Geolocation API fallback
   */
  async acquireBestLocation(onProgress?: (statusText: string) => void): Promise<AcquiredLocation> {
    // Check if navigator.geolocation is supported
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // Try Tier 1: High Accuracy GPS (5s timeout)
      try {
        onProgress?.('Acquiring high-precision GPS...');
        const highAccPos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 120000,
          });
        });

        const lat = highAccPos.coords.latitude;
        const lon = highAccPos.coords.longitude;
        const accuracy = highAccPos.coords.accuracy;
        let placeName = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
        try {
          placeName = await this.reverseGeocode(lat, lon);
        } catch {}

        return {
          lat,
          lon,
          accuracy,
          placeName,
          source: 'gps',
          isApproximate: false,
        };
      } catch (err: any) {
        console.warn('Tier 1 GPS failed/timed out, attempting Tier 2 network geolocation:', err);
      }

      // Try Tier 2: Low-Accuracy / Network-assisted Geolocation (6s timeout)
      try {
        onProgress?.('Resolving network location...');
        const lowAccPos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 6000,
            maximumAge: 300000,
          });
        });

        const lat = lowAccPos.coords.latitude;
        const lon = lowAccPos.coords.longitude;
        const accuracy = lowAccPos.coords.accuracy || 1000;
        let placeName = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
        try {
          placeName = await this.reverseGeocode(lat, lon);
        } catch {}

        return {
          lat,
          lon,
          accuracy,
          placeName,
          source: 'network',
          isApproximate: accuracy > 200,
        };
      } catch (err: any) {
        console.warn('Tier 2 Network Geolocation failed, attempting Tier 3 IP fallback:', err);
      }
    }

    // Try Tier 3: IP Geolocation Fallback
    onProgress?.('Estimating approximate location via IP...');
    const ipLocation = await this.getIpLocation();
    if (ipLocation) {
      return ipLocation;
    }

    // Default fallback to San Francisco preset if all else fails
    return {
      lat: 37.7749,
      lon: -122.4194,
      accuracy: 5000,
      placeName: 'San Francisco, CA, USA',
      source: 'preset',
      isApproximate: true,
    };
  }

  /**
   * Calculate distance between two coordinates in kilometers using Haversine formula
   */
  calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return locationService.calculateDistanceKm(lat1, lon1, lat2, lon2);
  }

  /**
   * Format distance into human-readable string
   */
  formatDistance(distanceKm: number): string {
    return locationService.formatDistance(distanceKm);
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const geocodingService = new GeocodingService();

// Re-export core location service types & utilities for centralized access
export {
  locationService,
  LocationError,
  LocationErrorCode,
  REPORT_LOCATION_ADJUSTMENT_RADIUS_METERS,
  REPORT_LOCATION_ADJUSTMENT_RADIUS_KM,
} from '../location/locationService';
export type {
  Coordinates,
  GeoPosition,
  LocationResult,
  LocationOptions,
  LatLngPoint,
} from '../location/locationService';
