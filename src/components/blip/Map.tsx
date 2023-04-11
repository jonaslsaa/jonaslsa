import React from 'react'
import type { FC } from 'react'
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet'
import L from 'leaflet';

type MarkerData = {
  id: number
  lat: number
  lng: number
  title: string
  type: string
  summary: string
}

const dummyData: MarkerData[] = [
  {
    id: 1,
    lat: 59.94015,
    lng: 10.72185,
    title: 'Blindern, UiO',
    type: 'Public disturbance',
    summary: 'A man was reported throwing objects and hitting house walls with a golf club. The police have detained the man.'
  },
  {
    id: 2,
    lat: 59.97015,
    lng: 10.22185,
    title: 'Some other place',
    type: 'Car crash',
    summary: 'A car crashed into a tree. The driver was not injured.'
  }
]


const markerIcon = new L.Icon({ iconUrl: '/marker-icon.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -15] }) 
const Map: FC = () => {
  return (
    <MapContainer center={[59.94015, 10.72185]} zoom={11} scrollWheelZoom={true} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />
        {dummyData.map((marker) => (
          <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={markerIcon}>
            <Popup>
              <b>Location:</b> {marker.title}
              <br />
              <b>Type:</b> {marker.type}
              <br />
              <b>Summary:</b> {marker.summary}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  )
}

export default Map