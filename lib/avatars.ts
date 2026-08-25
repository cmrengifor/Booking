/**
 * The fixed catalog behind the avatar picker (account/avatar-picker.tsx).
 * Kept server-readable too — updateAvatar (account/actions.ts) resolves a
 * client-sent id against this same list rather than trusting raw SVG markup
 * from the client, and account/page.tsx uses it to figure out which preset
 * (if any) the profile's current avatar_url matches.
 */
export type PresetAvatar = {
  id: number;
  alt: string;
  /** Selection-ring accent, as an "r, g, b" triplet. */
  rgb: string;
  svg: string;
};

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 1,
    alt: "Avatar 1",
    rgb: "255, 0, 91",
    svg: `<svg aria-label="Avatar 1" fill="none" height="40" role="img" viewBox="0 0 36 36" width="40" xmlns="http://www.w3.org/2000/svg"><title>Avatar 1</title><mask height="36" id="preset-avatar-1-mask" maskUnits="userSpaceOnUse" width="36" x="0" y="0"><rect fill="#FFFFFF" height="36" rx="72" width="36"/></mask><g mask="url(#preset-avatar-1-mask)"><rect fill="#ff005b" height="36" width="36"/><rect fill="#ffb238" height="36" rx="6" transform="translate(9 -5) rotate(219 18 18) scale(1)" width="36" x="0" y="0"/><g transform="translate(4.5 -4) rotate(9 18 18)"><path d="M15 19c2 1 4 1 6 0" fill="none" stroke="#000000" stroke-linecap="round"/><rect fill="#000000" height="2" rx="1" stroke="none" width="1.5" x="10" y="14"/><rect fill="#000000" height="2" rx="1" stroke="none" width="1.5" x="24" y="14"/></g></g></svg>`,
  },
  {
    id: 2,
    alt: "Avatar 2",
    rgb: "255, 125, 16",
    svg: `<svg aria-label="Avatar 2" fill="none" height="40" role="img" viewBox="0 0 36 36" width="40" xmlns="http://www.w3.org/2000/svg"><title>Avatar 2</title><mask height="36" id="preset-avatar-2-mask" maskUnits="userSpaceOnUse" width="36" x="0" y="0"><rect fill="#FFFFFF" height="36" rx="72" width="36"/></mask><g mask="url(#preset-avatar-2-mask)"><rect fill="#ff7d10" height="36" width="36"/><rect fill="#0a0310" height="36" rx="6" transform="translate(5 -1) rotate(55 18 18) scale(1.1)" width="36" x="0" y="0"/><g transform="translate(7 -6) rotate(-5 18 18)"><path d="M15 20c2 1 4 1 6 0" fill="none" stroke="#FFFFFF" stroke-linecap="round"/><rect fill="#FFFFFF" height="2" rx="1" stroke="none" width="1.5" x="14" y="14"/><rect fill="#FFFFFF" height="2" rx="1" stroke="none" width="1.5" x="20" y="14"/></g></g></svg>`,
  },
  {
    id: 3,
    alt: "Avatar 3",
    rgb: "255, 0, 91",
    svg: `<svg aria-label="Avatar 3" fill="none" height="40" role="img" viewBox="0 0 36 36" width="40" xmlns="http://www.w3.org/2000/svg"><title>Avatar 3</title><mask height="36" id="preset-avatar-3-mask" maskUnits="userSpaceOnUse" width="36" x="0" y="0"><rect fill="#FFFFFF" height="36" rx="72" width="36"/></mask><g mask="url(#preset-avatar-3-mask)"><rect fill="#0a0310" height="36" width="36"/><rect fill="#ff005b" height="36" rx="36" transform="translate(-3 7) rotate(227 18 18) scale(1.2)" width="36" x="0" y="0"/><g transform="translate(-3 3.5) rotate(7 18 18)"><path d="M13,21 a1,0.75 0 0,0 10,0" fill="#FFFFFF"/><rect fill="#FFFFFF" height="2" rx="1" stroke="none" width="1.5" x="12" y="14"/><rect fill="#FFFFFF" height="2" rx="1" stroke="none" width="1.5" x="22" y="14"/></g></g></svg>`,
  },
  {
    id: 4,
    alt: "Avatar 4",
    rgb: "137, 252, 179",
    svg: `<svg aria-label="Avatar 4" fill="none" height="40" role="img" viewBox="0 0 36 36" width="40" xmlns="http://www.w3.org/2000/svg"><title>Avatar 4</title><mask height="36" id="preset-avatar-4-mask" maskUnits="userSpaceOnUse" width="36" x="0" y="0"><rect fill="#FFFFFF" height="36" rx="72" width="36"/></mask><g mask="url(#preset-avatar-4-mask)"><rect fill="#d8fcb3" height="36" width="36"/><rect fill="#89fcb3" height="36" rx="6" transform="translate(9 -5) rotate(219 18 18) scale(1)" width="36" x="0" y="0"/><g transform="translate(4.5 -4) rotate(9 18 18)"><path d="M15 19c2 1 4 1 6 0" fill="none" stroke="#000000" stroke-linecap="round"/><rect fill="#000000" height="2" rx="1" stroke="none" width="1.5" x="10" y="14"/><rect fill="#000000" height="2" rx="1" stroke="none" width="1.5" x="24" y="14"/></g></g></svg>`,
  },
];

/** A stable, directly-renderable image URL for a preset — what gets saved to profiles.avatar_url. */
export function presetAvatarUrl(id: number): string | null {
  const avatar = PRESET_AVATARS.find((a) => a.id === id);
  if (!avatar) return null;
  return `data:image/svg+xml,${encodeURIComponent(avatar.svg)}`;
}

/** The reverse lookup — which preset (if any) a stored avatar_url came from. */
export function presetIdForAvatarUrl(avatarUrl: string | null | undefined): number | null {
  if (!avatarUrl) return null;
  return PRESET_AVATARS.find((a) => presetAvatarUrl(a.id) === avatarUrl)?.id ?? null;
}
