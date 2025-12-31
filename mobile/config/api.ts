const API_BASE_URL = __DEV__
  ? "http://192.168.0.228:8787"
  : "https://receiptchef.onrender.com";

export const CANONICALIZE_URL = `${API_BASE_URL}/api/canonicalize-items`;
export const HEALTH_URL = `${API_BASE_URL}/health`;
export const SCAN_URL = `${API_BASE_URL}/api/scan`;
