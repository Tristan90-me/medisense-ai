import { createNavigationContainerRef } from '@react-navigation/native';

// Exported for any future imperative navigation need (e.g. deep-linking from
// a push notification). The 401 flow specifically does NOT use this: see
// api/axios.js's comment for why a plain logout() is correct there instead
// of an imperative reset.
export const navigationRef = createNavigationContainerRef();
