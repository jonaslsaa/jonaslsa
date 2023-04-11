import React from 'react'
import type { FC } from 'react'
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet';

type MapProps = {
  markerData: MarkerData[]
}

export type MarkerData = {
  id: string
  tweetUrl: string
  lat: number
  lng: number
  location: string
  time: Date | string
  type: string
  severity: ("LOW" | "MED" | "HIGH") | null
  summary: string
}

const markerIconHigh = new L.Icon({ iconUrl: '/marker-red.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] }) 
const markerIconMedium = new L.Icon({ iconUrl: '/marker-yellow.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] })
const markerIconLow = new L.Icon({ iconUrl: '/marker-blue.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] })

const dateToStringTime = (date: Date) => {
  if (date.toLocaleDateString() !== new Date().toLocaleDateString()) { // if date is not today, also show date
    return date.toLocaleDateString('no-NO', {day: '2-digit', month: '2-digit', year: 'numeric'}) + ' ' + date.toLocaleTimeString('no-NO', {hour: '2-digit', minute:'2-digit'})
  }
  return date.toLocaleTimeString('no-NO', {hour: '2-digit', minute:'2-digit'})
}

const Map: FC<MapProps> = ({ markerData }) => {
  return (
    <MapContainer center={[59.94015, 10.72185]} zoom={11} scrollWheelZoom={true} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />
        {markerData.map((marker) => (
          <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={marker.severity === 'HIGH' ? markerIconHigh : marker.severity === 'MED' ? markerIconMedium : markerIconLow}>
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
              <a href={marker.tweetUrl} style={{opacity: '50%', fontSize: '0.7rem', marginRight: '.1rem'}}>
                Source
              </a>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  )
}

export default Map