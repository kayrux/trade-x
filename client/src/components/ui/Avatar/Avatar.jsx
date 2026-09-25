import { avatarSrc } from '../../../lib/constants/avatars';
import './Avatar.css';

// Circular profile avatar. Resolves an avatar key (or missing/unknown key) to
// its SVG via avatarSrc, which falls back to the default avatar.
function Avatar({ avatarKey, size = 32, alt = '' }) {
  return (
    <img
      className="avatar"
      src={avatarSrc(avatarKey)}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

export default Avatar;
