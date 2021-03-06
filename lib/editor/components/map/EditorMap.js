import React, { Component } from 'react'
import { Map, ZoomControl, GeoJSON, FeatureGroup } from 'react-leaflet'
import { shallowEqual } from 'react-pure-render'

import EditorMapLayersControl from './EditorMapLayersControl'
import AddableStopsLayer from './AddableStopsLayer'
import PatternStopsLayer from './PatternStopsLayer'
import DirectionIconsLayer from './DirectionIconsLayer'
import ControlPointsLayer from './ControlPointsLayer'
import StopsLayer from './StopsLayer'
import EditorMapProps from '../../props'
import PatternsLayer from './PatternsLayer'
import { MAP_LAYERS, constructStop, clickToLatLng, getFeedBounds } from '../../util/map'

export default class EditorMap extends Component {
  static propTypes = EditorMapProps
  constructor (props) {
    super(props)
    this.state = {}
  }
  _onResize = () => {
    this.setState({width: window.innerWidth, height: window.innerHeight})
    this.refs.map && setTimeout(() => this.refs.map.leafletElement.invalidateSize(), 500)
  }
  componentWillMount () {
    this._onResize()
    this.setState({willMount: true})
  }
  componentDidMount () {
    window.addEventListener('resize', this._onResize)
    this.setState({willMount: false})
  }
  componentWillUnmount () {
    window.removeEventListener('resize', this._onResize)
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.offset !== this.props.offset || nextProps.hidden !== this.props.hidden) {
      this._onResize()
    }
    if (nextProps.zoomToTarget && !shallowEqual(nextProps.zoomToTarget, this.props.zoomToTarget)) {
      this.setState({zoomToTarget: true})
    }
  }
  shouldComponentUpdate (nextProps, nextState) {
    const {props} = this
    const {activeEntity, mapState} = props
    // don't update if component continues to be hidden
    if (nextProps.hidden && props.hidden) {
      return false
    }

    const shouldUpdate =
      !shallowEqual(nextState, this.state) ||
      !shallowEqual(nextProps, props) ||
      !shallowEqual(nextProps.mapState.routesGeojson, mapState.routesGeojson) ||
      ((nextProps.activeComponent === 'stop' || nextProps.activeComponent === 'route') && nextProps.activeEntityId !== props.activeEntityId) ||
      (nextProps.activeEntity && activeEntity && nextProps.activeEntity.tripPatterns && !activeEntity.tripPatterns) ||
      !shallowEqual(nextProps.feedSource, props.feedSource) ||
      // TODO: add bounds to shouldComponentUpdate and move mapZoom/bounds to mapState reducer
      (nextProps.drawStops && !shallowEqual(nextProps.mapState.bounds, mapState.bounds)) ||
      (nextProps.activeComponent === 'stop' && activeEntity && nextProps.activeEntity && (activeEntity.stop_lon !== nextProps.activeEntity.stop_lon || activeEntity.stop_lat !== nextProps.activeEntity.stop_lat))

    return shouldUpdate
  }
  async _mapRightClicked (e) {
    switch (this.props.activeComponent) {
      case 'stop':
        // if newly created stop is selected
        const stopLatLng = clickToLatLng(e.latlng)
        if (this.props.activeEntity && this.props.activeEntity.id === 'new') {
          this.props.updateActiveEntity(this.props.activeEntity, this.props.activeComponent, stopLatLng)
          this.refs[this.props.activeEntity.id].leafletElement.setLatLng(e.latlng)
        } else if (this.props.entities && this.props.entities.findIndex(e => e.id === 'new') === -1) {
          const stop = await constructStop(e.latlng, this.props.feedSource.id)
          this.props.newGtfsEntity(this.props.feedSource.id, this.props.activeComponent, stop)
        }
        break
      default:
        break
    }
  }
  _mapBaseLayerChanged = (e) => {
    const layer = MAP_LAYERS.find(l => l.name === e.name)
    console.log('base layer changed', e)
    this.props.updateUserMetadata(this.props.user.profile, {editor: {map_id: layer.id}})
  }
  async _mapClicked (e) {
    if (this.props.activeComponent === 'stop') {
      // TODO: replace with spatial tree
      // locate stop based on latlng
      const selectedStop = this.props.entities.find(stop => Math.round(stop.stop_lat * 1000) / 1000 === Math.round(e.latlng.lat * 1000) / 1000 && Math.round(stop.stop_lon * 1000) / 1000 === Math.round(e.latlng.lng * 1000) / 1000)
      console.log('map click selected -->', selectedStop)
      if (selectedStop) {
        if (this.props.activeEntity && this.props.activeEntity.id === selectedStop.id) {
          // do nothing, the user just clicked the current stop
        } else {
          this.props.setActiveEntity(this.props.feedSource.id, this.props.activeComponent, selectedStop)
        }
      }
    }
    if (this.props.subComponent === 'trippattern' && this.props.editSettings.editGeometry) {
      switch (this.props.editSettings.onMapClick) {
        case 'NO_ACTION':
          break
        case 'ADD_STOP_AT_CLICK':
          return this.props.addStopAtPoint(e.latlng, true, null, this.props.activePattern)
        case 'ADD_STOPS_AT_INTERSECTIONS':
          return this.props.addStopAtIntersection(e.latlng, this.props.activePattern)
        case 'ADD_STOPS_AT_INTERVAL':
          return this.props.addStopAtInterval(e.latlng, this.props.activePattern)
        default:
          break
      }
    }
  }
  _mapBoundsChanged = (e) => {
    if (this.state.zoomToTarget) {
      setTimeout(() => { this.setState({zoomToTarget: false}) }, 200)
      return false
    } else {
      const zoom = e.target.getZoom()
      const bounds = e.target.getBounds()
      if (this.props.mapState.zoom !== zoom) {
        this.props.updateMapSetting({zoom})
      }
      if (!bounds.equals(this.props.mapState.bounds)) {
        this.props.updateMapSetting({bounds: e.target.getBounds()})
      }
    }
  }
  getMapComponents (component, entity, subEntityId, activePattern, stops, editSettings, mapState) {
    switch (component) {
      case 'route':
        if (!entity) return null
        return (
          <FeatureGroup>
            <PatternsLayer
              route={entity}
              subEntityId={subEntityId}
              activePattern={activePattern}
              patternCoordinates={this.props.editSettings.patternCoordinates}
              activeEntity={entity}
              editSettings={editSettings}
              controlPoints={this.props.controlPoints}
              constructControlPoint={this.props.constructControlPoint} />
            <DirectionIconsLayer
              patternCoordinates={this.props.editSettings.patternCoordinates}
              mapState={mapState} />
            {editSettings.editGeometry &&
              <ControlPointsLayer
                stops={stops}
                activePattern={activePattern}
                editSettings={editSettings}
                handlePatternEdit={this.props.handlePatternEdit}
                handleControlPointDrag={this.props.handleControlPointDrag}
                handleControlPointDragEnd={this.props.handleControlPointDragEnd}
                updateControlPoint={this.props.updateControlPoint}
                removeControlPoint={this.props.removeControlPoint}
                updateActiveEntity={this.props.updateActiveEntity}
                updatePatternCoordinates={this.props.updatePatternCoordinates}
                controlPoints={this.props.controlPoints}
                polyline={activePattern && this.refs[activePattern.id]} />
            }
            <PatternStopsLayer
              stops={stops}
              activePattern={activePattern}
              removeStopFromPattern={this.props.removeStopFromPattern}
              entityEdited={this.props.entityEdited}
              saveActiveEntity={this.props.saveActiveEntity}
              setActiveEntity={this.props.setActiveEntity}
              feedSource={this.props.feedSource}
              controlPoints={this.props.controlPoints}
              addStopToPattern={this.props.addStopToPattern}
              updateActiveEntity={this.props.updateActiveEntity}
              editSettings={editSettings} />
            <AddableStopsLayer
              stops={stops}
              activePattern={activePattern}
              addStopToPattern={this.props.addStopToPattern}
              editSettings={editSettings}
              mapState={mapState} />
          </FeatureGroup>
        )
      case 'stop':
        return (
          <StopsLayer
            mapState={mapState}
            stops={stops}
            stopTree={this.props.stopTree}
            drawStops={this.props.drawStops}
            activeEntity={entity}
            updateActiveEntity={this.props.updateActiveEntity}
            setActiveEntity={this.props.setActiveEntity}
            feedSource={this.props.feedSource} />
        )
      default:
        return null
    }
  }
  _overlayAdded = (e) => {
    if (e.name === 'Route alignments' && !this.props.tripPatterns) {
      this.props.fetchTripPatterns(this.props.feedSource.id)
    }
  }
  render () {
    const {
      feedSource,
      mapState,
      offset,
      sidebarExpanded,
      hidden,
      tripPatterns,
      user,
      tableData,
      activeComponent,
      activeEntity,
      subEntityId,
      activePattern,
      editSettings
    } = this.props
    const { zoomToTarget, width, willMount } = this.state
    const fsBounds = getFeedBounds(feedSource, 0.005)
    const bounds = zoomToTarget
      ? mapState.bounds
      : this.refs.map
      ? this.refs.map.leafletElement.getBounds()
      : fsBounds
    const mapStyle = {
      height: '100%',
      width: `${width - offset - (sidebarExpanded ? 130 : 50)}px`,
      position: 'absolute',
      left: `${offset}px`,
      display: hidden ? 'none' : 'initial'
    }
    const mapProps = {
      ref: 'map',
      zoomControl: false,
      style: mapStyle,
      maxBounds: [[200, 180], [-200, -180]],
      onContextMenu: (e) => this._mapRightClicked(e),
      onClick: (e) => this._mapClicked(e),
      onZoomEnd: this._mapBoundsChanged,
      onMoveEnd: this._mapBoundsChanged,
      onBaseLayerChange: this._mapBaseLayerChanged,
      scrollWheelZoom: true,
      onOverlayAdd: this._overlayAdded
    }
    if (willMount || zoomToTarget) {
      mapProps.bounds = bounds
    }
    return (
      <Map {...mapProps}>
        <ZoomControl position='topright' />
        <EditorMapLayersControl
          tripPatterns={tripPatterns}
          user={user}
          stops={tableData.stop} />
        {!hidden && this.getMapComponents(activeComponent, activeEntity, subEntityId, activePattern, tableData.stop, editSettings, mapState)}
        {mapState.routesGeojson &&
          <GeoJSON
            key={mapState.routesGeojson.key}
            data={mapState.routesGeojson} />
        }
      </Map>
    )
  }
}
