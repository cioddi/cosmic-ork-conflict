declare module "@deck.gl/mapbox" {
  export class MapboxLayer<T = any> {
    constructor(props: any);
    readonly id: string;
    setProps(props: any): void;
    finalize?: () => void;
  }

  export class MapboxOverlay {
    constructor(props: any);
    setProps(props: any): void;
    finalize?(): void;
    onAdd?(map: any): HTMLElement;
    onRemove?(map: any): void;
  }
}

declare module "@deck.gl/layers" {
  export class IconLayer<T = any> {
    constructor(props: any);
  }

  export class TextLayer<T = any> {
    constructor(props: any);
  }
}
