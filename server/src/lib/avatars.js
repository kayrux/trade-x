// Whitelist of allowed profile-avatar keys. The SVG art lives in the client
// bundle (client/src/assets/avatars + client/src/lib/constants/avatars.js) —
// this list only guards the PATCH /auth/me route from storing arbitrary values.
// Keep it in sync with the client manifest when adding avatars.
const AVATAR_KEYS = [
  'bear',
  'bunny',
  'cat',
  'dog',
  'fox',
  'frog',
  'owl',
  'penguin',
];

// null is allowed — it resets the user to the default (dog) avatar.
function isValidAvatar(value) {
  return value === null || AVATAR_KEYS.includes(value);
}

module.exports = { AVATAR_KEYS, isValidAvatar };
