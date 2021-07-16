import {ReactElement} from 'react';
import type {MaplibreProps} from '../maplibre/maplibre';

export type StaticMapProps = MaplibreProps & Partial<{
  className: string,
  style: any,

  disableTokenWarning: boolean,
  visibilityConstraints: any,
  children: any,

  onResize: Function
}>;

export interface MapRef {
  getMap(): any;
  queryRenderedFeatures(geometry: [number,number] | [[number,number],[number,number]], options?: any): Array<any>;
}

export default function StaticMap(props: StaticMapProps) : ReactElement;
