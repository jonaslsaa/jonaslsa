import React from 'react'
import type { FC } from 'react'
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet';
import seedrandom from 'seedrandom';

import type { SourceFilters } from '../../pages/blip';

type MapProps = {
  markerData: MarkerData[],
  findMe: number,
  filters: Record<markerFilterType, boolean>,
  severityFilters: Record<markerSeverityType, boolean>,
  sourceFilters: SourceFilters,
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
  summary: string,
  updates: number,
  tweetUpdatedAt: Date | string,
}

const markerIconLocation = new L.Icon({ iconUrl: '/markers/location-marker.png', iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -10] })

export type markerFilterType = 'default' | 'traffic' | 'fire' | 'speed' | 'missing'

export type markerSeverityType = 'LOW' | 'MED' | 'HIGH'
const markerIconMap: Record<markerFilterType, Record<markerSeverityType, L.Icon>> = {
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
  },
  missing: {
    HIGH: new L.Icon({ iconUrl: '/markers/marker-red-missing.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    MED: new L.Icon({ iconUrl: '/markers/marker-yellow-missing.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
    LOW: new L.Icon({ iconUrl: '/markers/marker-blue-missing.png', iconSize: [22, 22], iconAnchor: [10, 10], popupAnchor: [0, -12] })
  }
}

function markerToFilterType(marker: MarkerData) {
  const markerFilterTypes: Record<markerFilterType, boolean> = {
    default: false,
    traffic: false,
    fire: false,
    speed: false,
    missing: false
  }
  const markerTypeText = marker.type.toLowerCase()

  const isVehicle = markerTypeText.match(/traffic|vehicle|car|truck|bus|train|bike|motorcycle|driving/) !== null
  const isVehicleAccident = markerTypeText.match(/accident|incident|fire|smoke|violation|control|drunk|influence|drugged|offense|license|dangerous/) !== null

  markerFilterTypes.traffic = (isVehicle && isVehicleAccident) || markerTypeText.match(/crash|collision/) !== null
  markerFilterTypes.speed = markerTypeText.match(/speeding|speed/) !== null || isVehicle && marker.summary.match(/limit/) !== null
  markerFilterTypes.fire = markerTypeText.match(/fire|smoke|burning|burnt|burn/) !== null
  markerFilterTypes.missing = markerTypeText.match(/missing|lost|kidnapped|kidnap|kidnapping/) !== null

  // if no filter is set, set default to true
  if (!Object.values(markerFilterTypes).some((value) => value)) markerFilterTypes.default = true

  return markerFilterTypes
}

const markerToIcon = (marker: MarkerData) => {
  const filterTypes = markerToFilterType(marker)

  let customIcon: markerFilterType = 'default'
  if (filterTypes.traffic) customIcon = 'traffic'
  if (filterTypes.speed) customIcon = 'speed'
  if (filterTypes.fire) customIcon = 'fire'
  if (filterTypes.missing) customIcon = 'missing'

  if (marker.severity === "HIGH" || marker.severity === "MED" || marker.severity === "LOW") return markerIconMap[customIcon][marker.severity]
  console.error("Unknown severity: ", marker.severity)
  return markerIconMap[customIcon].LOW
}

const dateToStringTime = (date: Date) => {
  if (date.toLocaleDateString() !== new Date().toLocaleDateString()) { // if date is not today, also show date
    return date.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
}

function LocationMarker(findMe: { findMe: number }) {
  const [position, setPosition] = React.useState<L.LatLng | null>(null)
  const map = useMap()

  React.useEffect(() => {
    map.locate({ setView: true, maxZoom: 12 })
    map.on('locationfound', (e) => {
      setPosition(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
    })
  }, [map, findMe])

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

const filterMarkers = (markerData: MarkerData[], filtersMap: Record<markerFilterType, boolean>, severityMap: Record<markerSeverityType, boolean>, accountMap: Record<string, boolean>) => {
  const filteredMarkerData: MarkerData[] = []
  for (const marker of markerData) {
    const filterType = markerToFilterType(marker)
    for (const filterTypeKey in filterType) {
      if (filterType[filterTypeKey as markerFilterType] && filtersMap[filterTypeKey as markerFilterType]
        && marker.severity && severityMap[marker.severity]
        && accountMap[marker.tweetHandle]
      ) {
        filteredMarkerData.push(marker)
        break
      }
    }
  }
  return filteredMarkerData
}

const Map: FC<MapProps> = ({ markerData, findMe, filters, severityFilters, sourceFilters: sourceFilters }) => {
  const flattenSourceHandleFilters = Object.values(sourceFilters).reduce((acc, val) => ({ ...acc, ...val }), {})
  return (
    <MapContainer center={[59.94015, 10.72185]} zoom={11} scrollWheelZoom={true} style={{ height: '100vh', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {fixOverlappingMarkers(filterMarkers(markerData, filters, severityFilters, flattenSourceHandleFilters)).map((marker) => (
        <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={markerToIcon(marker)}>
          <Popup>
            <span style={{ float: 'right', opacity: '65%', fontSize: '0.7rem', marginRight: '.1rem' }}>
              {dateToStringTime(typeof marker.time === 'string' ? new Date(marker.time) : marker.time)}
            </span>
            <b>Location:</b> {marker.location}
            <br />
            <b>Type:</b> {marker.type}
            <br />
            <b>Summary:</b> {marker.summary}
            <br />
            <div className='flex flex-row gap-4 justify-between mt-1' style={{ opacity: '50%', fontSize: '0.7rem' }}>
              <a rel="noreferrer" target='_blank' href={marker.tweetUrl}>
                @{marker.tweetHandle}
              </a>
              <span className='whitespace-nowrap'>
                {marker.updates > 0 && <span>Updated at {dateToStringTime(new Date(marker.tweetUpdatedAt))}</span>}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
      {findMe && <LocationMarker findMe={findMe} />}
    </MapContainer>
  )
}

export default Map