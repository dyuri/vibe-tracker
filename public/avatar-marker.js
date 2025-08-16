import { generateUserColor } from './utils.js';

/**
 * Creates a custom droplet-shaped marker with user avatar
 * @param {Array} latlng - [latitude, longitude] coordinates
 * @param {string} username - Username for color generation and fallback text
 * @param {string} userId - User ID for avatar URL
 * @param {string} avatar - Avatar filename (can be empty/null)
 * @param {number} size - Marker size in pixels (default: 40)
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
          border: 2px solid white;
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

  // Create the droplet-shaped marker SVG
  const markerHtml = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <!-- Droplet shadow -->
      <svg width="${size}" height="${size}" style="position: absolute; top: 2px; left: 2px; z-index: 1;">
        <path d="M${size/2},${size-2} 
                 C${size/2-size*0.4},${size-2} 
                 ${size*0.1},${size*0.6} 
                 ${size*0.1},${size*0.4} 
                 C${size*0.1},${size*0.15} 
                 ${size*0.25},${2} 
                 ${size/2},${2} 
                 C${size*0.75},${2} 
                 ${size*0.9},${size*0.15} 
                 ${size*0.9},${size*0.4} 
                 C${size*0.9},${size*0.6} 
                 ${size/2+size*0.4},${size-2} 
                 ${size/2},${size-2} Z" 
              fill="rgba(0,0,0,0.2)" />
      </svg>
      
      <!-- Main droplet shape -->
      <svg width="${size}" height="${size}" style="position: absolute; z-index: 2;">
        <path d="M${size/2},${size-4} 
                 C${size/2-size*0.4},${size-4} 
                 ${size*0.1},${size*0.6} 
                 ${size*0.1},${size*0.4} 
                 C${size*0.1},${size*0.15} 
                 ${size*0.25},${0} 
                 ${size/2},${0} 
                 C${size*0.75},${0} 
                 ${size*0.9},${size*0.15} 
                 ${size*0.9},${size*0.4} 
                 C${size*0.9},${size*0.6} 
                 ${size/2+size*0.4},${size-4} 
                 ${size/2},${size-4} Z" 
              fill="${userColor}" 
              stroke="white" 
              stroke-width="2" />
      </svg>
      
      <!-- Avatar container positioned in the circular part -->
      <div style="
        position: absolute;
        top: ${padding}px;
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
    iconSize: [size, size],
    iconAnchor: [size/2, size-2], // Point to the bottom tip of the droplet
    popupAnchor: [0, -(size-10)] // Popup appears above the marker
  });

  // Create and return the marker
  return L.marker(latlng, { icon: customIcon });
}

/**
 * Creates a marker - either avatar marker for latest points or default marker for others
 * @param {Array} latlng - [latitude, longitude] coordinates
 * @param {Object} properties - Point properties containing optional username and avatar
 * @param {number} size - Marker size (default: 40)
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