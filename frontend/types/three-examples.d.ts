declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { Loader, LoadingManager, Group } from 'three';

  export interface GLTF {
    scene: Group;
    scenes: Group[];
    animations: unknown[];
    asset: unknown;
  }

  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(url: string, onLoad: (gltf: GLTF) => void, onProgress?: (event: ProgressEvent<EventTarget>) => void, onError?: (event: ErrorEvent) => void): void;
    loadAsync(url: string): Promise<GLTF>;
    parse(data: ArrayBuffer | string, path: string, onLoad: (gltf: GLTF) => void, onError?: (event: ErrorEvent) => void): void;
  }

  export default GLTFLoader;
}
