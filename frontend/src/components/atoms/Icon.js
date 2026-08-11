import React from "react";

import { colors } from "../../styles";

// Line icons, 2px stroke, no fill — each drawn to depict its concept
// literally (lock, shield, clock, key) so meaning is legible at a glance.
// `currentColor` lets a caller tint an icon by setting `color` on the wrapper.
const PATHS = {
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  code: (
    <>
      <path d="M8 4L2 12l6 8" />
      <path d="M16 4l6 8-6 8" />
    </>
  ),
  chain: (
    <>
      <rect x="2" y="9" width="9" height="6" rx="3" />
      <rect x="13" y="9" width="9" height="6" rx="3" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  // A seedling: growth, for earning on savings. `gift` is already the deposit
  // section, so earning needs its own mark.
  sprout: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12C12 8 9 5 5 5c0 4 3 7 7 7z" />
      <path d="M12 12c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6z" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <line x1="11" y1="11" x2="20" y2="20" />
      <line x1="16" y1="19" x2="19" y2="16" />
    </>
  ),
  snowflake: (
    <>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="4.2" y1="7.5" x2="19.8" y2="16.5" />
      <line x1="4.2" y1="16.5" x2="19.8" y2="7.5" />
    </>
  ),
  arrowRight: (
    <>
      <line x1="4" y1="12" x2="19" y2="12" />
      <path d="M14 7l5 5-5 5" />
    </>
  ),
  check: <path d="M4 12.5l5.2 5.2L20 6.5" />,
  cross: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="10" width="18" height="10" rx="2" />
      <line x1="12" y1="10" x2="12" y2="20" />
      <path d="M12 10C12 6 9 5 8 6.2 7 7.4 8.7 10 12 10z" />
      <path d="M12 10c0-4 3-5 4-3.8 1 1.2-.7 3.8-4 3.8z" />
    </>
  ),
  // Three sliders: "adjust this", rather than a cog's "system settings"
  sliders: (
    <>
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="16" cy="16" r="2.2" />
    </>
  ),
};

/**
 * Icon - line icon in the LockIn stroke language.
 *
 * @param {string} name  key from PATHS
 * @param {number} size  pixel box, default 20
 * @param {string} color stroke color, defaults to the mint accent
 */
const Icon = ({ name, size = 20, color = colors.primary.main, style }) => {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {path}
    </svg>
  );
};

export default Icon;
