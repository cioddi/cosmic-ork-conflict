import React, { useRef, useEffect, useState } from "react";

import { v4 as uuidv4 } from "uuid";

import { useLayer, useMap } from "@mapcomponents/react-maplibre";
import { MapEventType, Map } from "maplibre-gl";

interface MlImageMarkerLayerProps {
  /**
   * Id of the target MapLibre instance in mapContext
   */
  mapId?: string;
  /**
   * The layerId of an existing layer this layer should be rendered visually beneath
   * https://maplibre.org/maplibre-gl-js-docs/api/map/#map#addlayer - see "beforeId" property
   */
  insertBeforeLayer?: string;
  /**
   * Id of the layer that will be added by this component to the maplibre-gl instance
   */
  layerId?: string;
  /**
   * Id of the image that will be added by this component to the maplibre-gl instance
   */
  imageId?: string;
  /**
   * Path or URL to a supported raster image
   */
  imgSrc?: string;
  /**
   * Javascript object that is passed the addLayer command as first parameter.
   */
  options?: any;
  /**
   * Hover event handler that is executed whenever a geometry rendered by this component is hovered.
   */
  onHover?: (ev: MapEventType & unknown) => Map | void;
  /**
   * Click event handler that is executed whenever a geometry rendered by this component is clicked.
   */
  onClick?: (ev: MapEventType & unknown) => Map | void;
  /**
   * Leave event handler that is executed whenever a geometry rendered by this component is
   * left/unhovered.
   */
  onLeave?: (ev: MapEventType & unknown) => Map | void;
}

const MlImageMarkerLayer = (props: MlImageMarkerLayerProps) => {
  const mapHook = useMap({
    mapId: props.mapId,
    waitForLayer: props.insertBeforeLayer,
  });

  const imageIdRef = useRef(props.imageId || "img_" + uuidv4());
  const layerId = useRef(
    props.layerId || "MlImageMarkerLayer-" + mapHook.componentId
  );

  useLayer({
    geojson: props.options.source.data,
    options: {
      id: layerId.current,
      type: "symbol",
      layout: {
        ...props.options.layout,
        "icon-image": imageIdRef.current,
      },
      paint: {
        ...props.options.paint,
      },
    },
    onHover: props.onHover,
    onClick: props.onClick,
    onLeave: props.onLeave,
  });

  const createImage = (
    mapHook: ReturnType<typeof useMap>,
    props: MlImageMarkerLayerProps,
    callback: Function
  ) => {
    if (!mapHook.map) {
      return;
    }

    if (props.imgSrc && !mapHook.map.map.hasImage(imageIdRef.current)) {
      mapHook.map.map.loadImage(props.imgSrc, function (error, image) {
        if (error) throw error;

        if (!mapHook.map || mapHook.map.map.hasImage(imageIdRef.current))
          return;

        mapHook.map.addImage(imageIdRef.current, image, mapHook.componentId);

        if (typeof callback === "function") {
          callback();
        }
      });
    } else {
      if (typeof callback === "function") {
        callback();
      }
    }
  };

  useEffect(() => {
    if (!mapHook.map || mapHook.map?.map.getLayer(layerId.current)) return;

    if (props.imgSrc) {
      createImage(mapHook, props, () => {});
    }
  }, [props, mapHook]);

  return <></>;
};

export default MlImageMarkerLayer;
