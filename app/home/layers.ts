import { type GroupId, GROUPS, type Kind } from '@/components/parts';

// The measuring page with only these groups switched on
const measure = (...only: GroupId[]) => `/pomiar?hide=${GROUPS.map(group => group.id).filter(id => !only.includes(id)).join()}`;

export type LayerId = 'back' | 'dowels' | 'light' | 'frame' | 'interior' | 'drawers' | 'hinges' | 'fronts';

export type Layer = {
  id: LayerId;
  label: string;
  // Offset along the model's depth once exploded; negative is towards the front
  x: number;
  side: 'right' | 'left';
  to: string;
  // Where its line lands: along the width (A to D) and up the height of the layer's bounding box
  at: [number, number];
};

// In order along each column: the right one serves the far end of the stack, the left one the near end
export const LAYERS: Layer[] = [
  { id: 'back', label: 'Plecy i panel boczny', x: 1.35, side: 'right', to: measure('back'), at: [0.4, 0.82] },
  { id: 'dowels', label: 'Kołki i klocki', x: 0.9, side: 'right', to: measure('dowels', 'blocks'), at: [0.5, 0.7] },
  { id: 'light', label: 'Światło LED', x: 0.45, side: 'right', to: '/elektryka', at: [0.6, 0.8] },
  { id: 'frame', label: 'Rama', x: 0, side: 'right', to: '/rama', at: [0.7, 0.92] },
  { id: 'interior', label: 'Półki i przegrody', x: -0.55, side: 'left', to: measure('interior'), at: [0.3, 0.16] },
  { id: 'drawers', label: 'Szuflady', x: -1.1, side: 'left', to: '/okucia#szuflady', at: [0.4, 0.2] },
  { id: 'hinges', label: 'Zawiasy', x: -1.6, side: 'left', to: '/okucia#zawiasy', at: [0.3, 0.12] },
  { id: 'fronts', label: 'Fronty i uchwyty', x: -2.2, side: 'left', to: measure('fronts'), at: [0.42, 0.06] },
];

const LAYER_OF: Record<Kind, LayerId> = {
  front: 'fronts',
  handle: 'fronts',
  drawer: 'drawers',
  shelf: 'interior',
  aShelf: 'interior',
  support: 'interior',
  aSide: 'interior',
  frame: 'frame',
  led: 'light',
  back: 'back',
};

export const layerIndex = (id: LayerId) => LAYERS.findIndex(layer => layer.id === id);
export const layerOfKind = (kind: Kind) => layerIndex(LAYER_OF[kind]);
