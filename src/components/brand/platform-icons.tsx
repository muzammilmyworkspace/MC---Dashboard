import type { SVGProps } from "react";

/* ------------------------------------------------------------------ *
 *  Platform marks
 *
 *  Inline SVG rather than image files: nothing to fetch, crisp at every
 *  size, and no dependency on a CDN that a strict CSP would block.
 *  Lucide dropped brand icons in v1, so these replace the generic
 *  stand-ins that were standing in for them.
 *
 *  Each renders inside a 24x24 box and scales with the `size` prop, so
 *  they line up with the lucide icons used elsewhere.
 * ------------------------------------------------------------------ */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true as const,
});

export function InstagramIcon({ size = 20, ...rest }: IconProps) {
  // Unique gradient id per instance would be ideal, but a stable id keeps
  // the DOM small and these never render with differing gradients.
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <radialGradient id="ig-g" cx="0.3" cy="1.05" r="1.3">
          <stop offset="0%" stopColor="#FDD85D" />
          <stop offset="30%" stopColor="#F6A540" />
          <stop offset="55%" stopColor="#E8437E" />
          <stop offset="80%" stopColor="#B028A9" />
          <stop offset="100%" stopColor="#6A38C4" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5.6" fill="url(#ig-g)" />
      <rect x="6.4" y="6.4" width="11.2" height="11.2" rx="3.6" stroke="#fff" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.7" stroke="#fff" strokeWidth="1.5" />
      <circle cx="17.1" cy="6.9" r="1" fill="#fff" />
    </svg>
  );
}

export function FacebookIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path
        d="M15.1 12.5h-2v6.4a10 10 0 0 1-2.2 0V12.5H9.2v-2.3h1.7V8.7c0-2 1.2-3.1 3-3.1.6 0 1.3.05 1.9.13v2.1h-1c-.9 0-1.2.5-1.2 1.1v1.3h2.1l-.6 2.3Z"
        fill="#fff"
      />
    </svg>
  );
}

export function MetaIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id="meta-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0A7CFF" />
          <stop offset="100%" stopColor="#1D9BFF" />
        </linearGradient>
      </defs>
      {/* The double-loop mark, drawn as two mirrored arcs. */}
      <path
        d="M3.2 15.6c0-3.6 1.9-7.6 4.4-7.6 1.5 0 2.6 1.2 4.4 4 1.8-2.8 2.9-4 4.4-4 2.5 0 4.4 4 4.4 7.6 0 1.8-.9 3-2.4 3-1.5 0-2.5-1-4-3.6L12 12.4l-2.4 2.6C8.1 17.6 7.1 18.6 5.6 18.6c-1.5 0-2.4-1.2-2.4-3Z"
        stroke="url(#meta-g)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function YouTubeIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="1.6" y="5" width="20.8" height="14" rx="4.4" fill="#FF0000" />
      <path d="M10.1 8.9v6.2l5.4-3.1-5.4-3.1Z" fill="#fff" />
    </svg>
  );
}

export function TikTokIcon({ size = 20, ...rest }: IconProps) {
  // The offset cyan/pink layers are the mark's defining feature; without
  // them it reads as a generic music note.
  const note =
    "M14.1 3h2.5c.15 1.5.9 2.8 2 3.6.75.55 1.65.88 2.6.95v2.6a7.7 7.7 0 0 1-4.3-1.45v5.9a5.3 5.3 0 1 1-4.6-5.25v2.7a2.65 2.65 0 1 0 1.9 2.55V3Z";
  return (
    <svg {...base(size)} {...rest}>
      <path d={note} fill="#25F4EE" transform="translate(-1,-0.6)" />
      <path d={note} fill="#FE2C55" transform="translate(0.9,0.6)" />
      <path d={note} fill="currentColor" />
    </svg>
  );
}

export function GoogleAdsIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      {/* Round-capped strokes rather than rotated rects: the two bars have to
          meet in a clean peak, and rotating rectangles about a corner drifts. */}
      <path d="M12 4.3 18.1 17.6" stroke="#4285F4" strokeWidth="6.2" strokeLinecap="round" />
      <path d="M12 4.3 7.1 14.6" stroke="#FBBC04" strokeWidth="6.2" strokeLinecap="round" />
      <circle cx="6.5" cy="17.5" r="3.4" fill="#34A853" />
    </svg>
  );
}

export function GoogleAnalyticsIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="16.4" y="2.2" width="5.4" height="19.6" rx="2.7" fill="#F9AB00" />
      <rect x="9.3" y="8.4" width="5.4" height="13.4" rx="2.7" fill="#E37400" />
      <circle cx="4.9" cy="18.9" r="2.9" fill="#E37400" />
    </svg>
  );
}

export function LandingPagesIcon({ size = 20, ...rest }: IconProps) {
  // The MC brand mark. Unlike the platform logos this one is ours, so it
  // carries the brand gold rather than a neutral tone.
  //
  // Set as live text rather than traced outlines: a hand-traced serif M and C
  // at this size would drift off the real letterforms, and Georgia/Times are
  // present on effectively every system the dashboard runs on.
  return (
    <svg {...base(size)} {...rest}>
      <rect x="1" y="1" width="22" height="22" rx="4.4" fill="#C0A05C" />
      <text
        x="12"
        y="12.6"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', Times, serif"
        fontSize="12.2"
        letterSpacing="-0.4"
        fill="#0A0A0A"
      >
        MC
      </text>
    </svg>
  );
}

export type PlatformIcon = (props: IconProps) => React.ReactElement;
