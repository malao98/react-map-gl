// Copyright (c) 2015 Uber Technologies, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
import * as React from 'react';
import {useState, useRef, useCallback, useContext, useImperativeHandle, forwardRef} from 'react';
import * as PropTypes from 'prop-types';

import WebMercatorViewport from 'viewport-mercator-project';
import ResizeObserver from 'resize-observer-polyfill';

import Maplibre from '../maplibre/maplibre';
import maplibregl from '../utils/maplibregl';
import {checkVisibilityConstraints} from '../utils/map-constraints';
import {MAPBOX_LIMITS} from '../utils/map-state';
import MapContext, {MapContextProvider} from './map-context';
import useIsomorphicLayoutEffect from '../utils/use-isomorphic-layout-effect';
import {getTerrainElevation} from '../utils/terrain';

/* eslint-disable max-len */
const TOKEN_DOC_URL = 'https://visgl.github.io/react-map-gl/docs/get-started/mapbox-tokens';
const NO_TOKEN_WARNING = 'A valid API access token is required to use Mapbox data';
/* eslint-disable max-len */

function noop() {}

export function getViewport({map, props, width, height}) {
  const viewportProps = {
    ...props,
    ...props.viewState,
    width,
    height
  };
  viewportProps.position = [0, 0, getTerrainElevation(map, viewportProps)];
  return new WebMercatorViewport(viewportProps);
}

const UNAUTHORIZED_ERROR_CODE = 401;

const CONTAINER_STYLE = {
  position: 'absolute',
  width: '100%',
  height: '100%',
  overflow: 'hidden'
};

const propTypes = Object.assign({}, Maplibre.propTypes, {
  /** The dimensions of the map **/
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

  /** Callback when map size changes **/
  onResize: PropTypes.func,
  /** Hide invalid token warning even if request fails */
  disableTokenWarning: PropTypes.bool,
  /** Whether the map is visible */
  visible: PropTypes.bool,
  /** Custom class name for the map */
  className: PropTypes.string,
  /** Custom CSS for the container */
  style: PropTypes.object,

  /** Advanced features */
  // Contraints for displaying the map. If not met, then the map is hidden.
  // Experimental! May be changed in minor version updates.
  visibilityConstraints: PropTypes.object
});

const defaultProps = Object.assign({}, Maplibre.defaultProps, {
  disableTokenWarning: false,
  visible: true,
  onResize: noop,
  className: '',
  style: null,
  visibilityConstraints: MAPBOX_LIMITS
});

function NoTokenWarning() {
  const style = {
    position: 'absolute',
    left: 0,
    top: 0
  };
  return (
    <div
      key="warning"
      id="no-token-warning"
      // @ts-ignore
      style={style}
    >
      <h3 key="header">{NO_TOKEN_WARNING}</h3>
      <div key="text">For information on setting up your basemap, read</div>
      <a key="link" href={TOKEN_DOC_URL}>
        Note on Map Tokens
      </a>
    </div>
  );
}

function getRefHandles(maplibreRef) {
  return {
    getMap: () => maplibreRef.current && maplibreRef.current.getMap(),
    queryRenderedFeatures: (geometry, options = {}) => {
      const map = maplibreRef.current && maplibreRef.current.getMap();
      return map && map.queryRenderedFeatures(geometry, options);
    }
  };
}

const StaticMap = forwardRef((props, ref) => {
  const [accessTokenValid, setTokenState] = useState(true);
  const [size, setSize] = useState({width: 0, height: 0});
  const maplibreRef = useRef(null);
  const mapDivRef = useRef(null);
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const context = useContext(MapContext);

  useIsomorphicLayoutEffect(() => {
    if (!StaticMap.supported()) {
      return undefined;
    }

    // Initialize
    const maplibre = new Maplibre({
      ...props,
      ...size,
      maplibregl, // Handle to mapbox-gl library
      container: mapDivRef.current,
      onError: evt => {
        const statusCode = (evt.error && evt.error.status) || evt.status;
        if (statusCode === UNAUTHORIZED_ERROR_CODE && accessTokenValid) {
          // Mapbox throws unauthorized error - invalid token
          console.error(NO_TOKEN_WARNING); // eslint-disable-line
          setTokenState(false);
        }
        props.onError(evt);
      }
    });
    maplibreRef.current = maplibre;

    if (context && context.setMap) {
      context.setMap(maplibre.getMap());
    }

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0].contentRect) {
        const {width, height} = entries[0].contentRect;
        setSize({width, height});
        props.onResize({width, height});
      }
    });
    resizeObserver.observe(containerRef.current);

    // Clean up
    return () => {
      maplibre.finalize();
      maplibreRef.current = null;
      resizeObserver.disconnect();
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (maplibreRef.current) {
      maplibreRef.current.setProps({...props, ...size});
    }
  });

  const map = maplibreRef.current && maplibreRef.current.getMap();

  // External apps can call methods via ref
  // Note: this is not a recommended pattern in React FC - Keeping for backward compatibility
  useImperativeHandle(ref, () => getRefHandles(maplibreRef), []);

  const preventScroll = useCallback(({target}) => {
    if (target === overlayRef.current) {
      target.scrollTo(0, 0);
    }
  }, []);

  const overlays = map && (
    <MapContextProvider
      value={{
        ...context,
        viewport: context.viewport || getViewport({map, props, ...size}),
        map,
        container: context.container || containerRef.current
      }}
    >
      <div
        key="map-overlays"
        className="overlays"
        ref={overlayRef}
        // @ts-ignore
        style={CONTAINER_STYLE}
        onScroll={preventScroll}
      >
        {props.children}
      </div>
    </MapContextProvider>
  );

  const {className, width, height, style, visibilityConstraints} = props;
  const mapContainerStyle = Object.assign({position: 'relative'}, style, {
    width,
    height
  });

  const visible =
    props.visible && checkVisibilityConstraints(props.viewState || props, visibilityConstraints);

  const mapStyle = Object.assign({}, CONTAINER_STYLE, {
    visibility: visible ? 'inherit' : 'hidden'
  });

  return (
    <div
      key="map-container"
      ref={containerRef}
      // @ts-ignore
      style={mapContainerStyle}
    >
      <div
        key="map-maplibre"
        ref={mapDivRef}
        // @ts-ignore
        style={mapStyle}
        className={className}
      />
      {overlays}
      {!accessTokenValid && !props.disableTokenWarning && <NoTokenWarning />}
    </div>
  );
});

StaticMap.supported = () => maplibregl && maplibregl.supported();
StaticMap.propTypes = propTypes;
StaticMap.defaultProps = defaultProps;

export default StaticMap;
