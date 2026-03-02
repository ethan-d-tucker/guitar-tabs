// Base file for TypeScript resolution.
// At runtime, Metro uses native-db.native.ts or native-db.web.ts based on platform.
export { getDatabase } from './native-db.native';
