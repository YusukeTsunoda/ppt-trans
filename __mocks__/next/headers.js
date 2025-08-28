// Next.js headers mock
const mockCookies = new Map();

export const cookies = jest.fn(() => ({
  get: jest.fn((name) => mockCookies.get(name)),
  set: jest.fn((name, value, options) => {
    mockCookies.set(name, { value, ...options });
  }),
  delete: jest.fn((name) => {
    mockCookies.delete(name);
  }),
  getAll: jest.fn(() => Array.from(mockCookies.entries()).map(([name, value]) => ({ name, value }))),
  has: jest.fn((name) => mockCookies.has(name)),
}));

export const headers = jest.fn(() => ({
  get: jest.fn((name) => null),
  set: jest.fn(),
  delete: jest.fn(),
  append: jest.fn(),
  entries: jest.fn(() => []),
  forEach: jest.fn(),
  has: jest.fn(() => false),
  keys: jest.fn(() => []),
  values: jest.fn(() => []),
}));