import React from 'react'
import type { FC } from 'react'
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet';

import seedrandom from 'seedrandom';

type MapProps = {
  markerData: MarkerData[],
  findMe: boolean
}

export type MarkerData = {
  id: string
  tweetUrl: string
  tweetHandle: string
  lat: number
  lng: number
  location: string
  time: Date | string
  type: string
  severity: ("LOW" | "MED" | "HIGH") | null
  summary: string
}

const markerIconLocation = new L.Icon({ iconUrl: '/markers/location-marker.png', iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -10] })

type markerIconMapType = 'default' | 'traffic' | 'fire' | 'speed'
type markerIconSeverityType = 'LOW' | 'MED' | 'HIGH'
const markerIconMap: Record<markerIconMapType, Record<markerIconSeverityType, L.Icon>> = {
  default: {
    HIGH: new L.Icon({ iconUrl: '/markers/marker-red.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    MED: new L.Icon({ iconUrl: '/markers/marker-yellow.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    LOW: new L.Icon({ iconUrl: '/markers/marker-blue.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] })
  },
  traffic: {
    HIGH: new L.Icon({ iconUrl: '/markers/marker-red-traffic.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    MED: new L.Icon({ iconUrl: '/markers/marker-yellow-traffic.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    LOW: new L.Icon({ iconUrl: '/markers/marker-blue-traffic.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] })
  },
  fire: {
    HIGH: new L.Icon({ iconUrl: '/markers/marker-red-fire.png', iconSize: [20, 25], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    MED: new L.Icon({ iconUrl: '/markers/marker-yellow-fire.png', iconSize: [20, 25], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    LOW: new L.Icon({ iconUrl: '/markers/marker-blue-fire.png', iconSize: [20, 25], iconAnchor: [10, 10], popupAnchor: [0, -12] })
  },
  speed: {
    HIGH: new L.Icon({ iconUrl: '/markers/marker-red-speed.png', iconSize: [22, 24], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    MED: new L.Icon({ iconUrl: '/markers/marker-yellow-speed.png', iconSize: [22, 24], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    LOW: new L.Icon({ iconUrl: '/markers/marker-blue-speed.png', iconSize: [22, 24], iconAnchor: [10, 10], popupAnchor: [0, -12] })
  }
}

const markerToIcon = (marker: MarkerData) => {
  const markerType = marker.type.toLowerCase()
  const isVehicle = markerType.match(/traffic|vehicle|car|truck|bus|train|bike|motorcycle|driving/) !== null
  const isVehicleAccident = markerType.match(/accident|incident|fire|smoke|violation|control|drunk|influence|drugged|offense|license/) !== null

  const showTrafficAccident = (isVehicle && isVehicleAccident) || markerType.match(/crash|collision/) !== null
  const isSpeeding = markerType.match(/speeding|speed/) !== null || isVehicle && marker.summary.match(/limit/) !== null
  const isFire = markerType.match(/fire|smoke|burning|burnt|burn/) !== null

  let customIcon: markerIconMapType = 'default'
  if (showTrafficAccident) customIcon = 'traffic'
  if (isSpeeding) customIcon = 'speed'
  if (isFire) customIcon = 'fire'

  if (marker.severity === "HIGH" || marker.severity === "MED" || marker.severity === "LOW") return markerIconMap[customIcon][marker.severity]
  console.error("Unknown severity: ", marker.severity)
  return markerIconMap[customIcon].LOW
}

const dateToStringTime = (date: Date) => {
  if (date.toLocaleDateString() !== new Date().toLocaleDateString()) { // if date is not today, also show date
    return date.toLocaleDateString('no-NO', {day: '2-digit', month: '2-digit', year: 'numeric'}) + ' ' + date.toLocaleTimeString('no-NO', {hour: '2-digit', minute:'2-digit'})
  }
  return date.toLocaleTimeString('no-NO', {hour: '2-digit', minute:'2-digit'})
}

function LocationMarker() {
  const [position, setPosition] = React.useState<L.LatLng | null>(null)
  const map = useMap()

  React.useEffect(() => {
    map.locate({setView: true, maxZoom: 12})
    map.on('locationfound', (e) => {
      setPosition(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
    })
  }, [map])

  return position === null ? null : (
    <Marker position={position} icon={markerIconLocation} zIndexOffset={1000}>
      <Popup>You are here</Popup>
    </Marker>
  )
}

const fixOverlappingMarkers = (markerData: MarkerData[]) => {
  const usedLocations = new Set<string>()
  const fixedMarkerData: MarkerData[] = []
  for (const marker of markerData) {
    const location = marker.lat + ',' + marker.lng
    if (usedLocations.has(location)) {
      // Move marker a bit to avoid overlapping
      const myRandom = seedrandom(location) // Seed random with location to get same result every time
      const randomAngle = 2 * Math.PI * myRandom()
      const randomDistanceLat = 0.00045 * myRandom()
      const randomDistanceLng = 0.00045 * myRandom()
      marker.lat += Math.sin(randomAngle) * randomDistanceLat
      marker.lng += Math.cos(randomAngle) * randomDistanceLng
    }
    usedLocations.add(location)
    fixedMarkerData.push(marker)
  }
  return fixedMarkerData
}

const Map: FC<MapProps> = ({ markerData, findMe }) => {
  return (
    <MapContainer center={[59.94015, 10.72185]} zoom={11} scrollWheelZoom={true} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {fixOverlappingMarkers(markerData).map((marker) => (
          <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={markerToIcon(marker)}>
            <Popup>
              <span style={{float: 'right', opacity: '65%', fontSize: '0.7rem', marginRight: '.1rem'}}>
                {dateToStringTime(typeof marker.time === 'string' ? new Date(marker.time) : marker.time)}
              </span>
              <b>Location:</b> {marker.location}
              <br />
              <b>Type:</b> {marker.type}
              <br />
              <b>Summary:</b> {marker.summary}
              <br />
              <a rel="noreferrer" target='_blank' href={marker.tweetUrl} style={{opacity: '50%', fontSize: '0.7rem', marginRight: '.1rem'}}>
                @{marker.tweetHandle}
              </a>
            </Popup>
          </Marker>
        ))}
        {findMe && <LocationMarker />}
    </MapContainer>
  )
}

export default Map