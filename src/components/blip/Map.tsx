import React from 'react'
import type { FC } from 'react'
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet';

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

const markerIconHigh = new L.Icon({ iconUrl: '/markers/marker-red.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] })
const markerIconMedium = new L.Icon({ iconUrl: '/markers/marker-yellow.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] })
const markerIconLow = new L.Icon({ iconUrl: '/markers/marker-blue.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] })

const markerIconHighTraffic = new L.Icon({ iconUrl: '/markers/marker-red-traffic.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] })
const markerIconMediumTraffic = new L.Icon({ iconUrl: '/markers/marker-yellow-traffic.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] })
const markerIconLowTraffic = new L.Icon({ iconUrl: '/markers/marker-blue-traffic.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] })


const markerToIcon = (marker: MarkerData) => {
  const markerType = marker.type.toLowerCase()
  const isVehicle = markerType.match(/traffic|vehicle|car|truck|bus|train|bike|motorcycle|driving|speed/) !== null
  const isVehicleAccident = markerType.match(/accident|incident|fire|smoke|violation|control|drunk|influence|drugged|offense|license/) !== null
  const showTrafficAccident = (isVehicle && isVehicleAccident) || markerType.match(/crash|collision|speeding/) !== null
  switch (marker.severity) {
    case "HIGH":
      if (showTrafficAccident) return markerIconHighTraffic
      return markerIconHigh
    case "MED":
      if (showTrafficAccident) return markerIconMediumTraffic
      return markerIconMedium
    case "LOW":
      if (showTrafficAccident) return markerIconLowTraffic
      return markerIconLow
    default:
      console.error("Unknown severity: ", marker.severity)
      return markerIconLow
  }
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

const Map: FC<MapProps> = ({ markerData, findMe }) => {
  return (
    <MapContainer center={[59.94015, 10.72185]} zoom={11} scrollWheelZoom={true} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />
        {markerData.map((marker) => (
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