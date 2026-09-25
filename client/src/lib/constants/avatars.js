import bear from '../../assets/avatars/bear.svg';
import bunny from '../../assets/avatars/bunny.svg';
import cat from '../../assets/avatars/cat.svg';
import dog from '../../assets/avatars/dog.svg';
import fox from '../../assets/avatars/fox.svg';
import frog from '../../assets/avatars/frog.svg';
import owl from '../../assets/avatars/owl.svg';
import penguin from '../../assets/avatars/penguin.svg';

// Ordered list of selectable profile avatars. Keep the keys in sync with the
// server whitelist in server/src/lib/avatars.js.
export const AVATARS = [
  { key: 'bear', label: 'Bear', src: bear },
  { key: 'bunny', label: 'Bunny', src: bunny },
  { key: 'cat', label: 'Cat', src: cat },
  { key: 'dog', label: 'Dog', src: dog },
  { key: 'fox', label: 'Fox', src: fox },
  { key: 'frog', label: 'Frog', src: frog },
  { key: 'owl', label: 'Owl', src: owl },
  { key: 'penguin', label: 'Penguin', src: penguin },
];

// Shown when a user hasn't chosen an avatar (or the stored key is unknown).
export const DEFAULT_AVATAR_KEY = 'dog';

// Resolve a key to its SVG source, falling back to the default avatar.
export function avatarSrc(key) {
  const match = AVATARS.find((a) => a.key === key);
  if (match) return match.src;
  return AVATARS.find((a) => a.key === DEFAULT_AVATAR_KEY).src;
}
