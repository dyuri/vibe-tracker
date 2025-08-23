import { generateUserColor } from './utils.js';

/**
 * @typedef {import('../src/types/index.js').LocationProperties} LocationProperties
 * @typedef {[number, number]} LatLng - [latitude, longitude] coordinates
 */

/**
 * Creates a custom droplet-shaped marker with user avatar
 * @param {LatLng} latlng - [latitude, longitude] coordinates
 * @param {string} username - Username for color generation and fallback text
 * @param {string} userId - User ID for avatar URL
 * @param {string|null|undefined} avatar - Avatar filename (can be empty/null)
 * @param {number} [size=40] - Marker size in pixels
 * @returns {L.Marker} Leaflet marker with custom icon
 */
export function createAvatarMarker(latlng, username, userId, avatar, size = 40) {
  const userColor = generateUserColor(username) || '#007cff';
  const avatarSize = Math.round(size * 0.6); // Avatar is 60% of marker size
  const padding = Math.round(size * 0.05); // 5% padding
  
  // Create avatar content - either image or initials
  let avatarContent;
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
  const triangleHeight = size * 0.35; // Triangle height (increased from 0.25)
  const triangleWidth = circleRadius * 0.8; // Triangle width (increased from 0.6)
  const totalHeight = circleRadius * 2 + triangleHeight;
  const centerX = size / 2;
  const centerY = circleRadius; // Circle center
  
  // Create the droplet-shaped marker SVG
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
        <polygon points="${centerX-triangleWidth},${centerY+circleRadius*0.6} ${centerX+triangleWidth},${centerY+circleRadius*0.6} ${centerX},${totalHeight-4}" 
                 fill="${userColor}" 
                 stroke="white" 
                 stroke-width="1" 
                 stroke-linejoin="round" />
      </svg>
      
      <!-- Avatar container positioned in the circle -->
      <div style="
        position: absolute;
        top: ${centerY - avatarSize/2}px;
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

  // Create custom icon
  const customIcon = L.divIcon({
    html: markerHtml,
    className: 'avatar-marker',
    iconSize: [size, totalHeight],
    iconAnchor: [centerX, totalHeight-2], // Point to the bottom tip of the triangle
    popupAnchor: [0, -(totalHeight-10)] // Popup appears above the marker
  });

  // Create and return the marker
  return L.marker(latlng, { icon: customIcon });
}

/**
 * Creates a marker - either avatar marker for latest points or default marker for others
 * @param {LatLng} latlng - [latitude, longitude] coordinates
 * @param {LocationProperties} properties - Point properties containing optional username and avatar
 * @param {number} [size=40] - Marker size
 * @returns {L.Marker} Leaflet marker
 */
export function createMarker(latlng, properties, size = 40) {
  // Check if this point has username and avatar (indicates it's a latest point)
  if (properties.username && properties.user_id && properties.avatar !== undefined) {
    return createAvatarMarker(latlng, properties.username, properties.user_id, properties.avatar, size);
  } else {
    // Use default Leaflet marker for historical points
    return L.marker(latlng);
  }
}
