/**
 * Generate a consistent color for a given username
 */
export function generateUserColor(username: string | null | undefined): string | null {
  if (!username) {
    return null;
  }

  // Generate a consistent hash from username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Map hash to hue (0-360 degrees)
  const hue = Math.abs(hash) % 360;

  // Return HSL color with fixed saturation and lightness for vivid, readable colors
  return `hsl(${hue}, 70%, 45%)`;
}
