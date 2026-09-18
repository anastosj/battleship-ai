import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL only auto-cleans when vitest `globals` is on; do it explicitly.
afterEach(cleanup);
