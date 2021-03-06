import React from 'react'
import { Map, Marker, Popup, TileLayer } from 'react-leaflet'
import { Button } from 'react-bootstrap'

import { getFeedsBounds } from '../../common/util/geo'

export default class FeedsMap extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      bounds: this.props.bounds || [[70, 130], [-70, -130]]
    }
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.bounds && this.props.bounds !== nextProps.bounds) {
      this.refs.feedsMap.leafletElement.fitBounds(nextProps.bounds)
    }
  }
  render () {
    const mapStyle = {
      height: '500px',
      width: '100%'
    }
    const feeds = []
    this.props.projects.map(p => {
      if (p.feedSources) {
        return p.feedSources.map(f => {
          feeds.push(f)
          return f
        })
      }
    })
    const getFeedLocation = (bounds) => {
      if (!bounds) return null
      const lngEast = bounds.east ? bounds.east : bounds.west // check for 0 values
      const lngWest = bounds.west ? bounds.west : bounds.east // check for 0 values
      const latNorth = bounds.north ? bounds.north : bounds.south // check for 0 values
      const latSouth = bounds.south ? bounds.south : bounds.north // check for 0 values

      // return averaged location
      return [(latNorth + latSouth) / 2, (lngWest + lngEast) / 2]
    }
    if (feeds.length === 0) {
      return (
        <Map
          ref='feedsMap'
          style={mapStyle}
          bounds={this.state.bounds}
          scrollWheelZoom={false}
        >
          <TileLayer
            url='https://api.tiles.mapbox.com/v4/conveyal.ie3o67m0/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiY29udmV5YWwiLCJhIjoiMDliQURXOCJ9.9JWPsqJY7dGIdX777An7Pw'
            attribution='<a href="https://www.mapbox.com/about/maps/" target="_blank">&copy; Mapbox &copy; OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a>'
          />
        </Map>
      )
    }

    let bounds = getFeedsBounds(feeds)

    const markers = []
    feeds.map(feed => {
      if (feed.latestValidation && feed.latestValidation.bounds) {
        markers.push(
          {
            name: feed.name,
            id: feed.id,
            position: getFeedLocation(feed.latestValidation.bounds),
            url: feed.url
          }
        )
      }
    })
    bounds = bounds && bounds.north ? [[bounds.north, bounds.east], [bounds.south, bounds.west]] : this.state.bounds
    return (
      <Map
        ref='feedsMap'
        style={mapStyle}
        bounds={bounds}
        scrollWheelZoom={false}
      >
        <TileLayer
          url='https://api.tiles.mapbox.com/v4/conveyal.ie3o67m0/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiY29udmV5YWwiLCJhIjoiMDliQURXOCJ9.9JWPsqJY7dGIdX777An7Pw'
          attribution='<a href="https://www.mapbox.com/about/maps/" target="_blank">&copy; Mapbox &copy; OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a>'
        />
        {markers.map(m => {
          if (isNaN(m.position[0]) || isNaN(m.position[1])) {
            return null
          }
          return (
            <Marker position={m.position}>
              <Popup>
                <div>
                  <h3>{m.name}</h3>
                  <p><a href={m.url}>{m.url && m.url.length > 20 ? m.url.slice(0, 20) + '...' : m.url}</a></p>
                  <Button onClick={() => this.props.onFeedClick(m.id)}>View feed</Button>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </Map>
    )
  }
}
