import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CommunityReport } from '../../types';

interface LeafletCommunityMapProps {
  reports: CommunityReport[];
  selectedReport: CommunityReport | null;
  onSelectReport: (report: CommunityReport) => void;
  userLocation: { lat: number; lon: number } | null;
  center?: [number, number];
  zoom?: number;
}

export const LeafletCommunityMap: React.FC<LeafletCommunityMapProps> = ({
  reports,
  selectedReport,
  onSelectReport,
  userLocation,
  center = [37.7749, -122.4194],
  zoom = 13,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

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

    // Use source centroid or default
    let initialLat = center[0];
    let initialLon = center[1];
    if (userLocation) {
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

  // 2. Update Map Center when selectedReport or userLocation changes externally
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (selectedReport) {
      mapInstanceRef.current.flyTo([selectedReport.latitude, selectedReport.longitude], 14, {
        duration: 0.8,
      });
    }
  }, [selectedReport?.id]);

  // 3. Render / Update User Location Pin
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
          <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 24px; height: 24px; border-radius: 9999px; background: rgba(0, 209, 255, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 14px; height: 14px; border-radius: 9999px; background: #00D1FF; border: 2.5px solid #FFFFFF; box-shadow: 0 0 12px #00D1FF;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon, zIndexOffset: 1000 });
      marker.addTo(mapInstanceRef.current);
      userMarkerRef.current = marker;
    }
  }, [userLocation?.lat, userLocation?.lon]);

  // 4. Render Report Markers
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

      marker.on('click', () => {
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
