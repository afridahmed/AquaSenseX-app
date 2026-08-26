/**
 * AquaSense X - Reusable Geolocation & Spatial Calculation Service
 * 
 * Provides centralized browser Geolocation API interaction, fresh position acquisition,
 * typed error handling, coordinate validation, distance calculations (Haversine formula),
 * and proximity checking with a centralized 100m report adjustment radius.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number; // In meters
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  coords: Coordinates;
}

export enum LocationErrorCode {
  UNSUPPORTED = 'UNSUPPORTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE = 'POSITION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export class LocationError extends Error {
  public readonly code: LocationErrorCode;
  public readonly originalError?: GeolocationPositionError | Error;

  constructor(code: LocationErrorCode, message: string, originalError?: GeolocationPositionError | Error) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
    this.originalError = originalError;
  }
}

export type LocationResult =
  | { success: true; position: GeoPosition; error: null }
  | { success: false; position: null; error: LocationError };

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  fresh?: boolean; // Force maximumAge to 0 for fresh tests/reports
}

export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

/**
 * Centralized constant for water test / report location adjustment limit (100 meters).
 */
export const REPORT_LOCATION_ADJUSTMENT_RADIUS_METERS = 100;
export const REPORT_LOCATION_ADJUSTMENT_RADIUS_KM = 0.1;

export interface LocationDiagnostics {
  isSecureContext: boolean;
  isSupported: boolean;
  protocol: string;
  hostname: string;
  hasGeolocation: boolean;
  permissionState: 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown';
  diagnosticMessage: string;
}

export class LocationService {
  /**
   * Check if browser Geolocation API is supported in current environment
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'geolocation' in navigator;
  }

  /**
   * Check if the application is running in a secure context (required by Geolocation API)
   */
  isSecureContext(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof window.isSecureContext === 'boolean') {
      return window.isSecureContext;
    }
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  /**
   * Inspect current runtime environment and permission state for actionable diagnostics
   */
  async getDiagnostics(): Promise<LocationDiagnostics> {
    const isSupported = this.isSupported();
    const isSecureContext = this.isSecureContext();
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'unknown';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
    const hasGeolocation = typeof navigator !== 'undefined' && 'geolocation' in navigator;

    let permissionState: LocationDiagnostics['permissionState'] = 'unknown';

    if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        permissionState = status.state as LocationDiagnostics['permissionState'];
      } catch {
        permissionState = 'unsupported';
      }
    } else {
      permissionState = isSupported ? 'unknown' : 'unsupported';
    }

    let diagnosticMessage = 'GPS and Geolocation services are operational.';
    if (!isSecureContext) {
      diagnosticMessage = `Insecure context detected (${protocol}//${hostname}). Modern browsers require HTTPS or localhost to access device GPS.`;
    } else if (!isSupported) {
      diagnosticMessage = 'The browser environment does not support the Geolocation API.';
    } else if (permissionState === 'denied') {
      diagnosticMessage = 'Location permission is denied by browser site settings or OS location privacy.';
    } else if (permissionState === 'prompt') {
      diagnosticMessage = 'Location permission has not yet been granted. Browser prompt will appear on request.';
    }

    return {
      isSecureContext,
      isSupported,
      protocol,
      hostname,
      hasGeolocation,
      permissionState,
      diagnosticMessage,
    };
  }

  /**
   * Request user's current GPS position using browser Geolocation API.
   * Uses high accuracy first, with automatic standard accuracy fallback if high accuracy times out on desktop/laptops.
   * 
   * @param options LocationOptions
   * @returns Promise<GeoPosition>
   * @throws LocationError with typed error codes
   */
  async getCurrentPosition(options: LocationOptions = {}): Promise<GeoPosition> {
    if (!this.isSupported()) {
      const isSecure = this.isSecureContext();
      if (!isSecure) {
        throw new LocationError(
          LocationErrorCode.UNSUPPORTED,
          'Geolocation requires a secure HTTPS connection. Insecure HTTP contexts block GPS access.'
        );
      }
      throw new LocationError(
        LocationErrorCode.UNSUPPORTED,
        'Geolocation is not supported by your browser.'
      );
    }

    const highAccuracy = options.enableHighAccuracy ?? true;
    const timeout = options.timeout ?? 12000;
    // When fresh is requested (e.g. for new water reports), enforce maximumAge = 0 to prevent stale cached positions
    const maximumAge = options.fresh ? 0 : (options.maximumAge ?? 0);

    const tryAcquire = (useHighAcc: boolean, timeoutMs: number): Promise<GeoPosition> => {
      return new Promise<GeoPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos: GeolocationPosition) => {
            const position: GeoPosition = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp || Date.now(),
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
              },
            };
            resolve(position);
          },
          (err: GeolocationPositionError) => {
            reject(this.mapBrowserError(err));
          },
          {
            enableHighAccuracy: useHighAcc,
            timeout: timeoutMs,
            maximumAge,
          }
        );
      });
    };

    try {
      // First attempt with requested highAccuracy
      return await tryAcquire(highAccuracy, highAccuracy ? Math.min(timeout, 8000) : timeout);
    } catch (err: any) {
      // If high accuracy timed out or position unavailable (common on laptops/desktops without dedicated GPS chips),
      // and permission was NOT denied, attempt a standard accuracy pass
      if (
        highAccuracy &&
        err instanceof LocationError &&
        (err.code === LocationErrorCode.TIMEOUT || err.code === LocationErrorCode.POSITION_UNAVAILABLE)
      ) {
        try {
          return await tryAcquire(false, 6000);
        } catch {
          // Re-throw original typed error
          throw err;
        }
      }
      throw err;
    }
  }

  /**
   * Acquires a strictly FRESH position (maximumAge: 0, high accuracy)
   * specifically for new water tests, calibrations, or field source reporting.
   */
  async getFreshPosition(timeoutMs = 12000): Promise<GeoPosition> {
    return this.getCurrentPosition({
      enableHighAccuracy: true,
      fresh: true,
      maximumAge: 0,
      timeout: timeoutMs,
    });
  }

  /**
   * Safe wrapper that resolves without throwing, returning a typed LocationResult object.
   */
  async getPositionSafe(options: LocationOptions = {}): Promise<LocationResult> {
    try {
      const position = await this.getCurrentPosition(options);
      return { success: true, position, error: null };
    } catch (err: any) {
      const locationError =
        err instanceof LocationError
          ? err
          : new LocationError(LocationErrorCode.UNKNOWN, err?.message || 'Unknown location error', err);
      return { success: false, position: null, error: locationError };
    }
  }

  /**
   * Safe wrapper for fresh position acquisition.
   */
  async getFreshPositionSafe(timeoutMs = 12000): Promise<LocationResult> {
    return this.getPositionSafe({
      enableHighAccuracy: true,
      fresh: true,
      maximumAge: 0,
      timeout: timeoutMs,
    });
  }

  /**
   * Start watching user position with live updates.
   * 
   * @param onUpdate Callback for position updates
   * @param onError Callback for typed location errors
   * @param options LocationOptions
   * @returns Unsubscribe cleanup function
   */
  watchPosition(
    onUpdate: (position: GeoPosition) => void,
    onError?: (error: LocationError) => void,
    options: LocationOptions = {}
  ): () => void {
    if (!this.isSupported()) {
      if (onError) {
        onError(
          new LocationError(
            LocationErrorCode.UNSUPPORTED,
            'Geolocation is not supported by your browser.'
          )
        );
      }
      return () => {};
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 15000,
      maximumAge: options.maximumAge ?? 5000,
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos: GeolocationPosition) => {
        const position: GeoPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          },
        };
        onUpdate(position);
      },
      (err: GeolocationPositionError) => {
        if (onError) {
          onError(this.mapBrowserError(err));
        }
      },
      geoOptions
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }

  /**
   * Calculate distance between two coordinates in METERS using the Haversine formula
   */
  calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    return this.calculateDistanceKm(lat1, lon1, lat2, lon2) * 1000;
  }

  /**
   * Calculate distance between two coordinates in KILOMETERS using the Haversine formula
   */
  calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Helper to calculate distance from two coordinate objects in meters
   */
  distanceBetweenPointsMeters(pointA: LatLngPoint, pointB: LatLngPoint): number {
    return this.calculateDistanceMeters(
      pointA.latitude,
      pointA.longitude,
      pointB.latitude,
      pointB.longitude
    );
  }

  /**
   * Checks whether a coordinate is within a configurable radius of another coordinate (in meters).
   * 
   * @param point1 First coordinate point
   * @param point2 Second coordinate point
   * @param radiusMeters Radius in meters to test against
   * @returns boolean true if within radius, false otherwise
   */
  isWithinRadius(
    point1: LatLngPoint | { lat: number; lon: number },
    point2: LatLngPoint | { lat: number; lon: number },
    radiusMeters: number
  ): boolean {
    const lat1 = 'latitude' in point1 ? point1.latitude : point1.lat;
    const lon1 = 'longitude' in point1 ? point1.longitude : point1.lon;
    const lat2 = 'latitude' in point2 ? point2.latitude : point2.lat;
    const lon2 = 'longitude' in point2 ? point2.longitude : point2.lon;

    const distMeters = this.calculateDistanceMeters(lat1, lon1, lat2, lon2);
    return distMeters <= radiusMeters;
  }

  /**
   * Validates if a manually adjusted report coordinate is within the centralized
   * allowed 100-meter adjustment radius from the original GPS position.
   */
  isWithinReportAdjustmentRadius(
    originalGPS: LatLngPoint | { lat: number; lon: number },
    adjustedLocation: LatLngPoint | { lat: number; lon: number }
  ): boolean {
    return this.isWithinRadius(
      originalGPS,
      adjustedLocation,
      REPORT_LOCATION_ADJUSTMENT_RADIUS_METERS
    );
  }

  /**
   * Format distance into human-readable string (e.g. "45 m away", "1.2 km away")
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

  /**
   * Validate coordinate validity
   */
  isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Map raw browser GeolocationPositionError to strongly-typed LocationError
   */
  private mapBrowserError(err: GeolocationPositionError): LocationError {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return new LocationError(
          LocationErrorCode.PERMISSION_DENIED,
          'Location permission was denied. Please allow location access in your browser address bar (lock/tune icon) or in system privacy settings.',
          err
        );
      case err.POSITION_UNAVAILABLE:
        return new LocationError(
          LocationErrorCode.POSITION_UNAVAILABLE,
          'GPS/Location signal is currently unavailable. Please verify device Location Services and Wi-Fi are turned on.',
          err
        );
      case err.TIMEOUT:
        return new LocationError(
          LocationErrorCode.TIMEOUT,
          'GPS location request timed out while waiting for satellite/network fix. Tap Retry to try again.',
          err
        );
      default:
        return new LocationError(
          LocationErrorCode.UNKNOWN,
          err.message || 'An unexpected error occurred while querying the Geolocation API.',
          err
        );
    }
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

/**
 * Singleton shared LocationService instance
 */
export const locationService = new LocationService();
