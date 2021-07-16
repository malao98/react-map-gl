import maplibregl from './maplibregl';

// mapboxgl's setRTLTextPlugin, but does not crash in SSR
const setRTLTextPlugin = maplibregl ? maplibregl.setRTLTextPlugin : () => {};
export default setRTLTextPlugin;
