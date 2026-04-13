import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import L from 'leaflet'

// Fix Leaflet default styles/markers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function MapViewer({ geojson, center = [14.6, 121], zoom = 10, height = '400px' }) {
  const mapRef = useRef()

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo(center, zoom)
    }
  }, [geojson])

  const style = (feature) => ({
    fillColor: feature.properties.farm_type === 'rice' ? '#10b981' : '#f59e0b',
    weight: 2,
    opacity: 1,
    color: 'white',
    dashArray: '3',
    fillOpacity: 0.7,
  })

  return (
    <div style={{ height, width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geojson && (
          <GeoJSON 
            data={geojson} 
            style={style}
            onEachFeature={(feature, layer) => {
              layer.bindPopup(`Parcel: ${feature.properties.parcel_number}<br/>Area: ${feature.properties.total_area_ha} ha`)
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}

