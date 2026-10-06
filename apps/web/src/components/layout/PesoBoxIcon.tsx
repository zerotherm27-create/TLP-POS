interface Props {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/** Boxed peso icon — same style as the other nav icons (24px grid, round strokes). */
export default function PesoBoxIcon({ size = 24, className, strokeWidth = 2 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      {/* peso glyph from Lucide's PhilippinePeso, scaled to sit inside the box */}
      <g transform="translate(12 12) scale(0.62) translate(-12 -12)" strokeWidth={strokeWidth * 1.2}>
        <path d="M20 11H4" />
        <path d="M20 7H4" />
        <path d="M7 21V4a1 1 0 0 1 1-1h4a1 1 0 0 1 0 12H7" />
      </g>
    </svg>
  );
}
