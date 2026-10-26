export const USERNAME_MAX = 32;
export const MESSAGE_MAX = 2000;
export const MEMORY_MAX = 500;
export const GROUP_NAME_MAX = 80;

const usernamePattern = /^[a-zA-Z0-9_-]+$/;

export function validUsername(value: string) {
  return value.length <= USERNAME_MAX && usernamePattern.test(value);
}
