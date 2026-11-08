// One outline style for the whole toolbar: 16 px grid, square corners like the controls around them
const PATHS = {
  render: 'M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8ZM10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  measure: 'M1.5 5.5h13v5h-13ZM4 5.5v2M6.5 5.5v3M9 5.5v2M11.5 5.5v3',
  perspective: 'M8 1.75 13.5 4.9v6.2L8 14.25 2.5 11.1V4.9ZM2.5 4.9 8 8l5.5-3.1M8 8v6.25',
  front: 'M2.5 2h11v12h-11ZM8 2v12M6.25 7.25v1.5M9.75 7.25v1.5',
  side: 'M5.5 2h5v12h-5ZM5.5 6h5M5.5 10h5',
  top: 'M1.5 5.5h13v5h-13ZM5.5 5.5v5M10.5 5.5v5',
  grain: 'M2 4c2.5-1.75 4 1.75 6 0s3.5-1.75 6 0M2 8c2.5-1.75 4 1.75 6 0s3.5-1.75 6 0M2 12c2.5-1.75 4 1.75 6 0s3.5-1.75 6 0',
  open: 'M3 14V2h10v12M3 2l6 2v11l-6-1ZM7.25 8.75v1.5',
  close: 'M3 2h10v12H3ZM10.25 7.25v1.5',
  fullscreen: 'M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4',
  ar: 'M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3M8 4.75l2.75 1.6v3.3L8 11.25l-2.75-1.6v-3.3ZM5.25 6.35 8 7.95l2.75-1.6M8 7.95v3.3',
  vr: 'M1.5 4.5h13v7H10.5L9 9.5H7l-1.5 2H1.5ZM4.75 7.5h1M10.25 7.5h1',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
