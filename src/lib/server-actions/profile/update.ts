'use server';

// update.tsはget.tsに統合されているため、再エクスポート
export { updateProfileSettings as updateProfile } from './get';