import { describe, it, expect } from 'vitest';
import { generateUserColor } from '../public/utils.ts';

describe('Utils', () => {
  describe('generateUserColor', () => {
    it('should return null for null input', () => {
      expect(generateUserColor(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(generateUserColor(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(generateUserColor('')).toBe(null);
    });

    it('should generate consistent colors for same username', () => {
      const color1 = generateUserColor('testuser');
      const color2 = generateUserColor('testuser');
      expect(color1).toBe(color2);
    });

    it('should generate different colors for different usernames', () => {
      const color1 = generateUserColor('user1');
      const color2 = generateUserColor('user2');
      expect(color1).not.toBe(color2);
    });

    it('should return HSL color format', () => {
      const color = generateUserColor('testuser');
      expect(color).toMatch(/^hsl\(\d+, 70%, 45%\)$/);
    });

    it('should generate valid hue values (0-360)', () => {
      const color = generateUserColor('testuser');
      const hueMatch = color?.match(/hsl\((\d+), 70%, 45%\)/);
      if (hueMatch) {
        const hue = parseInt(hueMatch[1]);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
      }
    });
  });
});
