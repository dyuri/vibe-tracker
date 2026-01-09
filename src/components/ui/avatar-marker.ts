import type { LocationProperties } from '@/types';
import { generateUserColor } from '@/utils';

type LatLng = [number, number]; // [latitude, longitude] coordinates

/**
 * Marker wrapper that provides getElement() method
 */
interface MarkerWrapper {
  getElement(): HTMLElement;
}

/**
 * Creates a custom droplet-shaped marker element with user avatar
 */
export function createAvatarMarker(
  latlng: LatLng,
  username: string,
  userId: string,
  avatar: string | null | undefined,
  size: number = 40
): MarkerWrapper {
  const userColor = generateUserColor(username) || '#007cff';
  const avatarSize = Math.round(size * 0.6); // Avatar is 60% of marker size
  const _padding = Math.round(size * 0.05); // 5% padding

  // Create avatar content - either image or initials
  let avatarContent: string;
  if (avatar && avatar.trim()) {
    // Use avatar image
    avatarContent = `
      <img
        src="/api/files/users/${userId}/${avatar}"
        alt="${username}"
        style="
          width: ${avatarSize}px;
          height: ${avatarSize}px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid ${userColor};
        "
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <div style="
        display: none;
        width: ${avatarSize}px;
        height: ${avatarSize}px;
        border-radius: 50%;
        background: white;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: ${Math.round(avatarSize * 0.4)}px;
        color: ${userColor};
        border: 2px solid white;
      ">
        ${username ? username.charAt(0).toUpperCase() : '?'}
      </div>
    `;
  } else {
    // Use initials fallback
    avatarContent = `
      <div style="
        width: ${avatarSize}px;
        height: ${avatarSize}px;
        border-radius: 50%;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: ${Math.round(avatarSize * 0.4)}px;
        color: ${userColor};
        border: 2px solid white;
      ">
        ${username ? username.charAt(0).toUpperCase() : '?'}
      </div>
    `;
  }

  // Calculate dimensions for proper droplet shape
  const circleRadius = size * 0.3; // Circle radius (60% of marker width)
  const triangleHeight = size * 0.35; // Triangle height
  const triangleWidth = circleRadius * 0.8; // Triangle width
  const totalHeight = circleRadius * 2 + triangleHeight;
  const centerX = size / 2;
  const centerY = circleRadius; // Circle center

  // Create the droplet-shaped marker HTML
  const markerHtml = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${totalHeight}px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <!-- Main droplet shape -->
      <svg width="${size}" height="${totalHeight}" style="position: absolute; z-index: 2;">
        <!-- Triangle pointing down -->
        <polygon points="${centerX - triangleWidth},${centerY + circleRadius * 0.6} ${centerX + triangleWidth},${centerY + circleRadius * 0.6} ${centerX},${totalHeight - 4}"
                 fill="${userColor}"
                 stroke="white"
                 stroke-width="1"
                 stroke-linejoin="round" />
      </svg>

      <!-- Avatar container positioned in the circle -->
      <div style="
        position: absolute;
        top: ${centerY - avatarSize / 2}px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${avatarContent}
      </div>
    </div>
  `;

  // Create custom HTML element
  const element = document.createElement('div');
  element.className = 'avatar-marker';
  element.innerHTML = markerHtml;
  element.style.width = `${size}px`;
  element.style.height = `${totalHeight}px`;

  return {
    getElement: () => element,
  };
}

/**
 * Creates a simple default marker element
 */
function createDefaultMarker(): MarkerWrapper {
  const element = document.createElement('div');
  element.className = 'default-marker';
  element.innerHTML = `
    <div style="
      width: 25px;
      height: 41px;
      position: relative;
    ">
      <svg viewBox="0 0 27 43" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.5,0 C6.044,0 0,6.044 0,13.5 C0,23.8125 13.5,43 13.5,43 C13.5,43 27,23.8125 27,13.5 C27,6.044 20.956,0 13.5,0 Z" fill="#3388ff" stroke="white" stroke-width="2"/>
        <circle cx="13.5" cy="13.5" r="5" fill="white"/>
      </svg>
    </div>
  `;
  element.style.width = '25px';
  element.style.height = '41px';

  return {
    getElement: () => element,
  };
}

/**
 * Creates a marker - either avatar marker for latest points or default marker for others
 */
export function createMarker(
  latlng: LatLng,
  properties: LocationProperties,
  size: number = 40
): MarkerWrapper {
  // Check if this point has username and avatar (indicates it's a latest point)
  if (properties.username && properties.user_id && properties.avatar !== undefined) {
    return createAvatarMarker(
      latlng,
      properties.username,
      properties.user_id,
      properties.avatar,
      size
    );
  } else {
    // Use default marker for historical points
    return createDefaultMarker();
  }
}
