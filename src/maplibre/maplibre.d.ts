
export type ViewState = {
  longitude: number,
  latitude: number,
  zoom: number,
  bearing?: number,
  pitch?: number,
  altitude?: number
};

export type MaplibreProps = Partial<{
  maplibregl: any,
  container: any,
  gl: any,
  maplibreApiAccessToken: string,
  maplibreApiUrl: string,
  attributionControl: boolean,
  preserveDrawingBuffer: boolean,
  onLoad: Function,
  onError: Function,
  reuseMaps: boolean,
  transformRequest: Function,
  mapStyle: any,
  preventStyleDiffing: boolean,
  visible: boolean,
  asyncRender: boolean,
  width: number | string,
  height: number | string,
  viewState: ViewState,
  longitude: number,
  latitude: number,
  zoom: number,
  bearing: number,
  pitch: number,
  altitude: number,
  mapOptions: any
}>;

export default class Maplibre {
  static initialized: boolean;
  static defaultProps: MaplibreProps;
  static propTypes: any;
  static savedMap: any;

  props: MaplibreProps;
  width: number;
  height: number;

  constructor(props: MaplibreProps);
  finalize(): Maplibre;
  setProps(props: MaplibreProps): Maplibre;
  getMap(): any;
}
