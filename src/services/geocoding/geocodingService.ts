export interface GeocodingResult {
  placeId: string | number;
  displayName: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
}

/**
 * OpenStreetMap Nominatim Geocoding Service
 * Provides forward search and reverse geocoding without requiring paid API keys.
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
   * Calculate distance between two coordinates in kilometers using Haversine formula
   */
  calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Format distance into human-readable string
   */
  formatDistance(distanceKm: number): string {
    if (distanceKm < 0.1) {
      return `${Math.round(distanceKm * 1000)} m away`;
    }
    if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)} km away`;
    }
    return `${Math.round(distanceKm)} km away`;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const geocodingService = new GeocodingService();
