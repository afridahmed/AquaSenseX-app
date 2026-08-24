import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CommunityReport } from '../../types';

export interface ExplorationLocation {
  lat: number;
  lon: number;
  label?: string;
  source?: 'search' | 'map_click';
}

interface LeafletCommunityMapProps {
  reports: CommunityReport[];
  selectedReport: CommunityReport | null;
  onSelectReport: (report: CommunityReport) => void;
  userLocation: { lat: number; lon: number } | null;
  exploreLocation?: ExplorationLocation | null;
  onMapClick?: (lat: number, lon: number) => void;
  center?: [number, number];
  zoom?: number;
}

export const LeafletCommunityMap: React.FC<LeafletCommunityMapProps> = ({
  reports,
  selectedReport,
  onSelectReport,
  userLocation,
  exploreLocation = null,
  onMapClick,
  center = [37.7749, -122.4194],
  zoom = 13,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const exploreMarkerRef = useRef<L.Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Helper to get color info based on score
  const getMarkerColor = (score: number) => {
    if (score >= 88) return { hex: '#00D1FF', ring: 'rgba(0, 209, 255, 0.4)', bg: '#00D1FF' };
    if (score >= 70) return { hex: '#10B981', ring: 'rgba(16, 185, 129, 0.4)', bg: '#10B981' };
    if (score >= 50) return { hex: '#F59E0B', ring: 'rgba(245, 158, 11, 0.4)', bg: '#F59E0B' };
    return { hex: '#F43F5E', ring: 'rgba(244, 63, 94, 0.4)', bg: '#F43F5E' };
  };

  // 1. Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    let initialLat = center[0];
    let initialLon = center[1];
    if (exploreLocation) {
      initialLat = exploreLocation.lat;
      initialLon = exploreLocation.lon;
    } else if (userLocation) {
      initialLat = userLocation.lat;
      initialLon = userLocation.lon;
    } else if (reports.length > 0 && typeof reports[0].latitude === 'number' && typeof reports[0].longitude === 'number') {
      initialLat = reports[0].latitude;
      initialLon = reports[0].longitude;
    }

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Dark-styled OpenStreetMap tile layer
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      className: 'dark-tiles',
    });

    tileLayer.addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Handle map click for location exploration
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Update Map Center when selectedReport changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (selectedReport) {
      mapInstanceRef.current.flyTo([selectedReport.latitude, selectedReport.longitude], 14, {
        duration: 0.8,
      });
    }
  }, [selectedReport?.id]);

  // 3. Update Map Center when exploreLocation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !exploreLocation) return;
    mapInstanceRef.current.flyTo([exploreLocation.lat, exploreLocation.lon], 14, {
      duration: 0.8,
    });
  }, [exploreLocation?.lat, exploreLocation?.lon]);

  // 4. Render / Update User Location Pin (Real GPS)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'custom-user-pin',
        html: `
          <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; border-radius: 9999px; background: rgba(0, 209, 255, 0.25); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 14px; height: 14px; border-radius: 9999px; background: #00D1FF; border: 2.5px solid #FFFFFF; box-shadow: 0 0 14px #00D1FF;"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([userLocation.lat, userLocation.lon], {
        icon: userIcon,
        zIndexOffset: 1000,
      });
      marker.bindTooltip('Your Current GPS Location', {
        direction: 'top',
        className: 'custom-map-tooltip',
        offset: [0, -10],
      });
      marker.addTo(mapInstanceRef.current);
      userMarkerRef.current = marker;
    }
  }, [userLocation?.lat, userLocation?.lon]);

  // 5. Render / Update Exploration Location Pin (Search / Map Click)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (exploreMarkerRef.current) {
      exploreMarkerRef.current.remove();
      exploreMarkerRef.current = null;
    }

    if (exploreLocation) {
      const isSearch = exploreLocation.source === 'search';
      const labelText = exploreLocation.label || (isSearch ? 'Searched Location' : 'Selected Map Point');

      const exploreIcon = L.divIcon({
        className: 'custom-explore-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            transform: translateY(-50%);
          ">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 9999px;
              background: #181E26;
              border: 2px solid #F59E0B;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7), 0 0 12px rgba(245, 158, 11, 0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #F59E0B;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
              </svg>
            </div>
            <div style="
              margin-top: 3px;
              background: rgba(18, 22, 28, 0.92);
              border: 1px solid rgba(245, 158, 11, 0.4);
              padding: 2px 6px;
              border-radius: 8px;
              font-size: 10px;
              font-weight: 600;
              color: #FCD34D;
              white-space: nowrap;
              max-width: 140px;
              overflow: hidden;
              text-overflow: ellipsis;
              box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            ">
              ${labelText}
            </div>
          </div>
        `,
        iconSize: [32, 48],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([exploreLocation.lat, exploreLocation.lon], {
        icon: exploreIcon,
        zIndexOffset: 900,
      });
      marker.addTo(mapInstanceRef.current);
      exploreMarkerRef.current = marker;
    }
  }, [exploreLocation?.lat, exploreLocation?.lon, exploreLocation?.label, exploreLocation?.source]);

  // 6. Render Report Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    reports.forEach((report) => {
      const isSelected = selectedReport?.id === report.id;
      const color = getMarkerColor(report.qualityScore);

      const markerHtml = `
        <div style="
          position: relative;
          cursor: pointer;
          transform: ${isSelected ? 'scale(1.18)' : 'scale(1)'};
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: ${isSelected ? 500 : 100};
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 4px 8px;
            border-radius: 14px;
            background: ${isSelected ? '#181E26' : '#12161C'};
            border: ${isSelected ? `2px solid ${color.hex}` : '1px solid rgba(255, 255, 255, 0.15)'};
            box-shadow: 0 8px 24px rgba(0,0,0,0.6), 0 0 ${isSelected ? '14px' : '0px'} ${color.ring};
            backdrop-filter: blur(8px);
            color: #FFFFFF;
            font-family: var(--font-sans);
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          ">
            <span style="
              width: 8px;
              height: 8px;
              border-radius: 9999px;
              background-color: ${color.bg};
              box-shadow: 0 0 6px ${color.bg};
              flex-shrink: 0;
            "></span>
            <span>${report.qualityScore}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-water-pin',
        html: markerHtml,
        iconSize: [44, 28],
        iconAnchor: [22, 14],
      });

      const marker = L.marker([report.latitude, report.longitude], { icon: customIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectReport(report);
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [reports, selectedReport?.id]);

  return (
    <div className="w-full h-full relative rounded-[24px] sm:rounded-[28px] overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full min-h-[320px] xs:min-h-[380px] sm:min-h-[460px] lg:min-h-[560px]" />
    </div>
  );
};
