
export interface DeviceInfo {
  deviceId: string;
  deviceModel: string;
  browser: string;
  os: string;
  isMobile: boolean;
  screen: string;
  userAgent: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DevicePermissions {
  audioAccepted: boolean;
  notificationsAccepted: boolean;
}

export interface RegisteredDevice {
  id: string;
  deviceId: string;
  deviceModel: string;
  role: 'owner';
  userName: string;
  phone?: string;
  isMobile: boolean;
  browser: string;
  os: string;
  permissions: DevicePermissions;
  lastActiveAt: string;
  firstRegisteredAt: string;
}

/**
 * Returns a persistent unique ID for this browser / phone
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server-env';
  
  const STORAGE_KEY = 'burger_house_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  
  if (!deviceId) {
    const randomPart = Math.random().toString(36).substring(2, 10);
    const timePart = Date.now().toString(36);
    deviceId = `dev_${timePart}_${randomPart}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  
  return deviceId;
}

/**
 * Inspects navigator.userAgent to detect friendly device model and OS
 */
export function detectDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'server',
      deviceModel: 'Servidor',
      browser: 'Node',
      os: 'Linux',
      isMobile: false,
      screen: '1920x1080',
      userAgent: '',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
  }

  const ua = navigator.userAgent;
  let os = 'Outro';
  let deviceModel = 'Computador';
  let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS (Apple)';
    deviceModel = /iPad/i.test(ua) ? 'iPad' : 'iPhone';
    isMobile = true;
  } else if (/Android/i.test(ua)) {
    os = 'Android';
    isMobile = true;
    if (/Samsung|SM-|GT-/i.test(ua)) {
      deviceModel = 'Samsung Galaxy';
    } else if (/Motorola|Moto/i.test(ua)) {
      deviceModel = 'Motorola Moto';
    } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
      deviceModel = 'Xiaomi';
    } else {
      deviceModel = 'Smartphone Android';
    }
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
    deviceModel = 'PC Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
    deviceModel = 'Apple Mac';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    deviceModel = 'PC Linux';
  }

  let browser = 'Navegador';
  if (/Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/Edg/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Firefox/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/Opera|OPR/i.test(ua)) {
    browser = 'Opera';
  }

  const screen = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  const deviceId = getOrCreateDeviceId();

  return {
    deviceId,
    deviceModel,
    browser,
    os,
    isMobile,
    screen,
    userAgent: ua.slice(0, 150),
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
}

/**
 * Checks whether this browser has accepted local device permissions
 */
export async function checkDeviceRegistration(
  siteId: string,
  role: 'owner',
  identifier: string
): Promise<{ isRecognized: boolean; registeredDevice: RegisteredDevice | null }> {
  try {
    const deviceId = getOrCreateDeviceId();
    
    // Check local storage accepted flag
    const localAccepted = localStorage.getItem(`owner_device_accepted_${deviceId}`);
    
    if (localAccepted === 'true') {
      const info = detectDeviceInfo();
      return {
        isRecognized: true,
        registeredDevice: {
          id: deviceId,
          deviceId,
          deviceModel: info.deviceModel,
          role: 'owner',
          userName: identifier || 'Lucas Rodrigo',
          isMobile: info.isMobile,
          browser: info.browser,
          os: info.os,
          permissions: { audioAccepted: true, notificationsAccepted: true },
          lastActiveAt: new Date().toISOString(),
          firstRegisteredAt: new Date().toISOString(),
        },
      };
    }

    return { isRecognized: false, registeredDevice: null };
  } catch (err) {
    console.warn('Check device failed:', err);
    return { isRecognized: false, registeredDevice: null };
  }
}

/**
 * Confirms device permissions in this browser
 */
export async function saveDeviceRegistration(
  siteId: string,
  role: 'owner',
  userName: string,
  permissions: DevicePermissions
): Promise<RegisteredDevice> {
  const info = detectDeviceInfo();
  const now = new Date().toISOString();

  const registered: RegisteredDevice = {
    id: info.deviceId,
    deviceId: info.deviceId,
    deviceModel: info.deviceModel,
    role,
    userName,
    isMobile: info.isMobile,
    browser: info.browser,
    os: info.os,
    permissions,
    lastActiveAt: now,
    firstRegisteredAt: now,
  };

  localStorage.setItem(`owner_device_accepted_${info.deviceId}`, 'true');
  localStorage.setItem('delivery_sound_accepted', 'true');

  return registered;
}


