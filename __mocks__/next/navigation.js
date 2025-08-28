// Next.js navigation mock
export const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
}));

export const usePathname = jest.fn(() => '/');

export const useSearchParams = jest.fn(() => ({
  get: jest.fn(),
  getAll: jest.fn(() => []),
  has: jest.fn(() => false),
  entries: jest.fn(() => []),
  keys: jest.fn(() => []),
  values: jest.fn(() => []),
  toString: jest.fn(() => ''),
}));

export const useParams = jest.fn(() => ({}));

export const notFound = jest.fn();

export const redirect = jest.fn();