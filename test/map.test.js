import { it, expect } from 'vitest';
import { formatCoords } from '../src/map.js';

it('format koordinat dengan arah', () => {
  expect(formatCoords(-6.2, 106.8)).toBe('6.20000° S, 106.80000° T');
  expect(formatCoords(51.5, -0.12)).toBe('51.50000° U, 0.12000° B');
});
