// Bundled ambience beds (FR-304). Files are built by scripts/make-beds.py; credits and
// licences are in assets/beds/README.md. `durationMs` is hardcoded from those files so the
// loop engine can schedule its crossfade without waiting for a player to load.

export type Bed = {
  id: string;
  label: string;
  source: number;
  durationMs: number;
};

export const BEDS: readonly Bed[] = [
  { id: 'rain', label: 'Rain', source: require('@/assets/beds/rain.mp3'), durationMs: 42_000 },
  { id: 'ocean', label: 'Ocean', source: require('@/assets/beds/ocean.mp3'), durationMs: 53_600 },
  {
    id: 'crickets',
    label: 'Night crickets',
    source: require('@/assets/beds/crickets.mp3'),
    durationMs: 56_400,
  },
  { id: 'pad', label: 'Soft pad', source: require('@/assets/beds/pad.mp3'), durationMs: 112_000 },
];

export function getBed(id: string | null): Bed | null {
  return BEDS.find((bed) => bed.id === id) ?? null;
}
