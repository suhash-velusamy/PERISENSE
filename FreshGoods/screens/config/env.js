/**
 * Environment configuration
 *
 * Single source of truth for the backend base URL, so it no longer has to
 * be hardcoded independently in every screen. `__DEV__` is the standard
 * React Native/Expo flag that is true in a development build/Metro bundle
 * and false in a release build.
 *
 * Both development and production point at the hosted backend configured
 * in ipadd.js (currently the Render deployment), so no LAN IP setup is
 * needed to reach the API.
 */
import { IPADD } from '../ipadd';

const ENV = {
    development: {
        apiBaseUrl: IPADD,
    },
    production: {
        apiBaseUrl: IPADD,
    },
};

const getEnv = () => (__DEV__ ? ENV.development : ENV.production);

export const API_BASE_URL = getEnv().apiBaseUrl;
