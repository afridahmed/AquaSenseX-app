import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CommunityReport } from '../../types';

export interface DeviceLocationState {
  lat: number;
  lon: number;
  accuracy?: number;
}

export interface SearchLocationState {
  lat: number;
  lon: number;
  label?: string;
}

export interface ExplorationLocationState {
  lat: number;
  lon: number;
  label?: string;
  source?: 'device' | 'search' | 'map_click';
}

interface LeafletCommunityMapProps {
  reports: CommunityReport[];
  selectedReport: CommunityReport | null;
  onSelectReport: (report: CommunityReport) => void;
  deviceLocation?: DeviceLocationState | null;
  searchLocation?: SearchLocationState | null;
  explorationLocation?: ExplorationLocationState | null;
  onMapClick?: (lat: number, lon: number) => void;
  center?: [number, number];
  zoom?: number;
}

export const LeafletCommunityMap: React.FC<LeafletCommunityMapProps> = ({
  reports,
  selectedReport,
  onSelectReport,
  deviceLocation = null,
  searchLocation = null,
  explorationLocation = null,
  onMapClick,
  center = [37.7749, -122.4194],
  zoom = 13,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  
  // Dedicated layer / refs for special markers
  const deviceMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const explorationMarkerRef = useRef<L.Marker | null>(null);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Helper for score badge colors
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
    
    if (explorationLocation) {
      initialLat = explorationLocation.lat;
      initialLon = explorationLocation.lon;
    } else if (searchLocation) {
      initialLat = searchLocation.lat;
      initialLon = searchLocation.lon;
    } else if (deviceLocation) {
      initialLat = deviceLocation.lat;
      initialLon = deviceLocation.lon;
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

    // Map click for exploration
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    // Container resize observer
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

  // 2. Center transition when selectedReport changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedReport) return;
    mapInstanceRef.current.flyTo([selectedReport.latitude, selectedReport.longitude], 14, {
      duration: 0.8,
    });
  }, [selectedReport?.id]);

  // 3. Center transition when searchLocation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !searchLocation) return;
    mapInstanceRef.current.flyTo([searchLocation.lat, searchLocation.lon], 14, {
      duration: 0.8,
    });
  }, [searchLocation?.lat, searchLocation?.lon]);

  // 4. Center transition when explorationLocation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !explorationLocation) return;
    mapInstanceRef.current.flyTo([explorationLocation.lat, explorationLocation.lon], 14, {
      duration: 0.8,
    });
  }, [explorationLocation?.lat, explorationLocation?.lon]);

  // 5. Center transition when deviceLocation changes (and no exploration active)
  useEffect(() => {
    if (!mapInstanceRef.current || !deviceLocation || explorationLocation || searchLocation) return;
    mapInstanceRef.current.flyTo([deviceLocation.lat, deviceLocation.lon], 14, {
      duration: 0.8,
    });
  }, [deviceLocation?.lat, deviceLocation?.lon]);

  // 6. Render Device Location Pin & Accuracy Circle (Blue Marker)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (deviceMarkerRef.current) {
      deviceMarkerRef.current.remove();
      deviceMarkerRef.current = null;
    }
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    if (deviceLocation) {
      // Blue pulsing GPS pin
      const deviceIcon = L.divIcon({
        className: 'custom-gps-pin',
        html: `
          <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 30px; height: 30px; border-radius: 9999px; background: rgba(0, 209, 255, 0.28); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 14px; height: 14px; border-radius: 9999px; background: #00D1FF; border: 2.5px solid #FFFFFF; box-shadow: 0 0 16px #00D1FF;"></div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([deviceLocation.lat, deviceLocation.lon], {
        icon: deviceIcon,
        zIndexOffset: 1000,
      });
      marker.bindTooltip('Your Current GPS Location', {
        direction: 'top',
        className: 'custom-map-tooltip',
        offset: [0, -10],
      });
      marker.addTo(mapInstanceRef.current);
      deviceMarkerRef.current = marker;

      // Render accuracy circle if accuracy is known and sensible
      if (typeof deviceLocation.accuracy === 'number' && deviceLocation.accuracy > 0 && deviceLocation.accuracy < 5000) {
        const circle = L.circle([deviceLocation.lat, deviceLocation.lon], {
          radius: deviceLocation.accuracy,
          color: '#00D1FF',
          fillColor: '#00D1FF',
          fillOpacity: 0.1,
          weight: 1.5,
          dashArray: '4, 4',
        }).addTo(mapInstanceRef.current);
        accuracyCircleRef.current = circle;
      }
    }
  }, [deviceLocation?.lat, deviceLocation?.lon, deviceLocation?.accuracy]);

  // 7. Render Search Location Pin (Subtle Contrasting Amber/Gold Marker)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    if (searchLocation) {
      const searchIcon = L.divIcon({
        className: 'custom-search-pin',
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
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7), 0 0 14px rgba(245, 158, 11, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #F59E0B;
            ">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <div style="
              margin-top: 3px;
              background: rgba(24, 30, 38, 0.95);
              border: 1px solid rgba(245, 158, 11, 0.4);
              padding: 2px 7px;
              border-radius: 8px;
              font-size: 10px;
              font-weight: 700;
              color: #FCD34D;
              white-space: nowrap;
              max-width: 140px;
              overflow: hidden;
              text-overflow: ellipsis;
              box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            ">
              ${searchLocation.label || 'Search Location'}
            </div>
          </div>
        `,
        iconSize: [32, 48],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([searchLocation.lat, searchLocation.lon], {
        icon: searchIcon,
        zIndexOffset: 950,
      });
      marker.addTo(mapInstanceRef.current);
      searchMarkerRef.current = marker;
    }
  }, [searchLocation?.lat, searchLocation?.lon, searchLocation?.label]);

  // 8. Render Selected Exploration Pin (Distinct Emerald/Cyan Accent)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (explorationMarkerRef.current) {
      explorationMarkerRef.current.remove();
      explorationMarkerRef.current = null;
    }

    if (explorationLocation) {
      const isClick = explorationLocation.source === 'map_click';
      const labelText = explorationLocation.label || (isClick ? 'Exploration Pin' : 'Selected Location');

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
              background: #12161C;
              border: 2px solid #10B981;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.8), 0 0 14px rgba(16, 185, 129, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #10B981;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
              </svg>
            </div>
            <div style="
              margin-top: 3px;
              background: rgba(18, 22, 28, 0.95);
              border: 1px solid rgba(16, 185, 129, 0.4);
              padding: 2px 7px;
              border-radius: 8px;
              font-size: 10px;
              font-weight: 700;
              color: #6EE7B7;
              white-space: nowrap;
              max-width: 140px;
              overflow: hidden;
              text-overflow: ellipsis;
              box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            ">
              ${labelText}
            </div>
          </div>
        `,
        iconSize: [32, 48],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([explorationLocation.lat, explorationLocation.lon], {
        icon: exploreIcon,
        zIndexOffset: 920,
      });
      marker.addTo(mapInstanceRef.current);
      explorationMarkerRef.current = marker;
    }
  }, [explorationLocation?.lat, explorationLocation?.lon, explorationLocation?.label, explorationLocation?.source]);

  // 9. Render Community Report Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    reports.forEach((report) => {
      const isSelected = selectedReport?.id === report.id;
      const color = getMarkerColor(report.qualityScore);

      const markerBorder = isSelected ? `2px solid ${color.hex}` : '1px solid rgba(255, 255, 255, 0.15)';
      const markerBg = isSelected ? '#181E26' : '#12161C';
      const markerShadow = `0 8px 24px rgba(0,0,0,0.6), 0 0 ${isSelected ? '14px' : '0px'} ${color.ring}`;

      const markerHtml = `
        <div style="
          position: relative;
          cursor: pointer;
          transform: ${isSelected ? 'scale(1.16)' : 'scale(1)'};
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: ${isSelected ? 500 : 100};
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 7px;
            border-radius: 12px;
            background: ${markerBg};
            border: ${markerBorder};
            box-shadow: ${markerShadow};
            backdrop-filter: blur(8px);
            color: #FFFFFF;
            font-family: var(--font-sans);
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          ">
            <span style="
              width: 7px;
              height: 7px;
              border-radius: 9999px;
              background-color: ${color.bg};
              box-shadow: 0 0 6px ${color.bg};
              flex-shrink: 0;
            "></span>
            <span style="color: #FFFFFF;">${report.qualityScore}</span>
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
    <div className="w-full h-full relative rounded-[22px] sm:rounded-[26px] overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full min-h-[320px] xs:min-h-[380px] sm:min-h-[460px] lg:min-h-[560px]" />
    </div>
  );
};
