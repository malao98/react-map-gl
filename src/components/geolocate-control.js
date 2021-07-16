import * as React from 'react';
import {useRef, useEffect, useState, useCallback, useMemo} from 'react';
import * as PropTypes from 'prop-types';

import {document} from '../utils/globals';
import maplibregl from '../utils/maplibregl';

import MapState from '../utils/map-state';
import {LINEAR_TRANSITION_PROPS} from '../utils/map-controller';
import {isGeolocationSupported} from '../utils/geolocate-utils';

import useMapControl, {mapControlDefaultProps, mapControlPropTypes} from './use-map-control';

const noop = () => {};

const propTypes = Object.assign({}, mapControlPropTypes, {
  // Custom className
  className: PropTypes.string,
  style: PropTypes.object,
  // Custom label assigned to the control
  label: PropTypes.string,
  disabledLabel: PropTypes.string,
  // Auto trigger instead of waiting for click
  auto: PropTypes.bool,

  // mapbox geolocate options
  // https://docs.mapbox.com/mapbox-gl-js/api/#geolocatecontrol
  positionOptions: PropTypes.object,
  fitBoundsOptions: PropTypes.object,
  trackUserLocation: PropTypes.bool,
  showUserLocation: PropTypes.bool,
  showAccuracyCircle: PropTypes.bool,

  // Callbacks fired when the user interacted with the map. The object passed to the callbacks
  // contains viewport properties such as `longitude`, `latitude`, `zoom` etc.
  onViewStateChange: PropTypes.func,
  onViewportChange: PropTypes.func,

  onGeolocate: PropTypes.func
});

const defaultProps = Object.assign({}, mapControlDefaultProps, {
  className: '',
  label: 'Find My Location',
  disabledLabel: 'Location Not Available',
  auto: false,

  // mapbox geolocate options
  positionOptions: {enableHighAccuracy: false, timeout: 6000},
  fitBoundsOptions: {maxZoom: 15},
  trackUserLocation: false,
  showUserLocation: true,
  showAccuracyCircle: true,

  onGeolocate: () => {}
});

function getBounds(position) {
  const center = new maplibregl.LngLat(position.coords.longitude, position.coords.latitude);
  const radius = position.coords.accuracy;
  const bounds = center.toBounds(radius);

  return [
    [bounds._ne.lng, bounds._ne.lat],
    [bounds._sw.lng, bounds._sw.lat]
  ];
}

function setupMaplibreGeolocateControl(context, props, geolocateButton) {
  const control = new maplibregl.GeolocateControl(props);

  // Dummy placeholders so that _setupUI does not crash
  control._container = document.createElement('div');
  control._map = {
    on: () => {},
    _getUIString: () => ''
  };
  control._setupUI(true);
  control._map = context.map;

  // replace mapbox internal UI elements with ours
  control._geolocateButton = geolocateButton;

  // From _setupUI
  // when the camera is changed (and it's not as a result of the Geolocation Control) change
  // the watch mode to background watch, so that the marker is updated but not the camera.
  const {eventManager} = context;
  if (control.options.trackUserLocation && eventManager) {
    eventManager.on('panstart', () => {
      if (control._watchState === 'ACTIVE_LOCK') {
        control._watchState = 'BACKGROUND';
        geolocateButton.classList.add('maplibregl-ctrl-geolocate-background');
        geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active');
      }
    });
  }

  control.on('geolocate', props.onGeolocate);
  return control;
}

function updateCamera(position, {context, props}) {
  const bounds = getBounds(position);
  const {longitude, latitude, zoom} = context.viewport.fitBounds(bounds, props.fitBoundsOptions);

  const newViewState = Object.assign({}, context.viewport, {
    longitude,
    latitude,
    zoom
  });
  const mapState = new MapState(newViewState);
  const viewState = Object.assign({}, mapState.getViewportProps(), LINEAR_TRANSITION_PROPS);

  const onViewportChange = props.onViewportChange || context.onViewportChange || noop;
  const onViewStateChange = props.onViewStateChange || context.onViewStateChange || noop;

  // Call new style callback
  onViewStateChange({viewState});

  // Call old style callback
  onViewportChange(viewState);
}

function GeolocateControl(props) {
  const thisRef = useMapControl(props);
  const {context, containerRef} = thisRef;
  const geolocateButtonRef = useRef(null);
  const [maplibreGeolocateControl, createMaplibreGeolocateControl] = useState(null);
  const [supportsGeolocation, setSupportsGeolocation] = useState(false);

  useEffect(() => {
    let control;

    if (context.map) {
      isGeolocationSupported().then(result => {
        setSupportsGeolocation(result);

        if (geolocateButtonRef.current) {
          control = setupMaplibreGeolocateControl(context, props, geolocateButtonRef.current);
          // Overwrite Mapbox's GeolocateControl internal method
          control._updateCamera = position => updateCamera(position, thisRef);
          createMaplibreGeolocateControl(control);
        }
      });
    }

    return () => {
      if (control) {
        control._clearWatch();
      }
    };
  }, [context.map]);

  const triggerGeolocate = useCallback(() => {
    if (maplibreGeolocateControl) {
      maplibreGeolocateControl.options = thisRef.props;
      maplibreGeolocateControl.trigger();
    }
  }, [maplibreGeolocateControl]);

  useEffect(() => {
    if (props.auto) {
      triggerGeolocate();
    }
  }, [maplibreGeolocateControl, props.auto]);

  useEffect(() => {
    if (maplibreGeolocateControl) {
      maplibreGeolocateControl._onZoom();
    }
  }, [context.viewport.zoom]);

  const {className, label, disabledLabel, trackUserLocation} = props;

  const style = useMemo(() => ({position: 'absolute', ...props.style}), [props.style]);

  return (
    <div style={style} className={className}>
      <div key="geolocate-control" className="maplibregl-ctrl maplibregl-ctrl-group" ref={containerRef}>
        <button
          key="geolocate"
          className={`maplibregl-ctrl-icon maplibregl-ctrl-geolocate`}
          ref={geolocateButtonRef}
          disabled={!supportsGeolocation}
          aria-pressed={!trackUserLocation}
          type="button"
          title={supportsGeolocation ? label : disabledLabel}
          aria-label={supportsGeolocation ? label : disabledLabel}
          onClick={triggerGeolocate}
        >
          <span className="maplibregl-ctrl-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

GeolocateControl.propTypes = propTypes;
GeolocateControl.defaultProps = defaultProps;

export default React.memo(GeolocateControl);
