import axios from 'axios';

// 브라우저에서 직접 구글로 쏘는 대신, 우리가 만든 로컬 프록시 서버(3001번)로 요청을 보냅니다.
const LOCAL_PROXY_BASE = 'http://127.0.0.1:3001/api';

/**
 * Creates a new Picker Session via Proxy.
 */
export const createPickerSession = async (accessToken) => {
  try {
    const response = await axios.post(`${LOCAL_PROXY_BASE}/create-session`, {}, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error in proxy create-session:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Checks if the picker session is completed.
 */
export const checkSessionStatus = async (accessToken, sessionId) => {
  try {
    const response = await axios.get(`${LOCAL_PROXY_BASE}/session-status/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data; // { id, pickerUri, isCompleted }
  } catch (error) {
    console.error('Error checking status:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetches selected media items via Proxy.
 */
export const fetchPickerItems = async (accessToken, sessionId) => {
  try {
    const response = await axios.get(`${LOCAL_PROXY_BASE}/fetch-items/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log('--- [DEBUG] RAW PICKER ITEMS ---', response.data);

    // 구글 포토 피커 API는 mediaItems 배열 안에 아이템을 담고 있습니다.
    const items = response.data.mediaItems || [];

    if (items.length === 0) {
      console.warn('No items found in the response.');
      return [];
    }

    return items.map((item) => {
      // mediaFile.baseUrl 또는 mediaItem.mediaFile.baseUrl 등에 위치할 수 있음
      const baseUrl = item.mediaFile?.baseUrl;
      
      if (!baseUrl) {
        console.error('[-] Failed to find baseUrl for item:', item);
        return null;
      }

      // 구글 이미지 보안 차단을 우회하기 위해 로컬 이미지 프록시(3001) 사용
      // [중요] Picker API는 이미지 접근 시에도 인증 토큰이 필요합니다.
      const originalUrl = baseUrl + '=w1200';
      const localProxyUrl = `${LOCAL_PROXY_BASE}/image-proxy?url=${encodeURIComponent(originalUrl)}&token=${accessToken}`;
      
      return {
        id: item.id || `google-${Math.random().toString(36).substr(2, 9)}`,
        url: localProxyUrl,
        date: (item.mediaItemMetadata?.creationTime || new Date().toISOString()).split('T')[0],
        description: item.mediaItemMetadata?.video?.filename || 'Google Photo',
        isMilestone: false,
      };
    }).filter(item => item !== null);
  } catch (error) {
    console.error('Error in proxy fetch-items:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * DB: Fetch all saved photos from server.
 */
export const getSavedPhotos = async () => {
  try {
    const response = await axios.get(`${LOCAL_PROXY_BASE}/saved-photos`);
    return response.data;
  } catch (error) {
    console.error('Error fetching saved photos:', error);
    return [];
  }
};

/**
 * DB: Save new photos to server.
 */
export const savePhotos = async (photos) => {
  try {
    const response = await axios.post(`${LOCAL_PROXY_BASE}/save-photos`, photos);
    return response.data;
  } catch (error) {
    console.error('Error saving photos:', error);
    throw error;
  }
};

/**
 * DB: Delete a photo from server.
 */
export const deletePhoto = async (id) => {
  try {
    const response = await axios.delete(`${LOCAL_PROXY_BASE}/delete-photo/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
};

/**
 * DB: Update photo details (theme and comment)
 */
export const updatePhotoDetails = async (id, theme, comment) => {
  try {
    const response = await axios.post(`${LOCAL_PROXY_BASE}/update-photo-details`, { id, theme, comment });
    return response.data;
  } catch (error) {
    console.error('Error updating photo details:', error);
    throw error;
  }
};

/**
 * DB: Bulk update theme for multiple photos
 */
export const bulkUpdateTheme = async (ids, theme) => {
  try {
    const response = await axios.post(`${LOCAL_PROXY_BASE}/bulk-update-theme`, { ids, theme });
    return response.data;
  } catch (error) {
    console.error('Error bulk updating theme:', error);
    throw error;
  }
};

/**
 * DB: Rename a theme group
 */
export const renameTheme = async (year, oldTheme, newTheme) => {
  try {
    const response = await axios.post(`${LOCAL_PROXY_BASE}/rename-theme`, { year, oldTheme, newTheme });
    return response.data;
  } catch (error) {
    console.error('Error renaming theme:', error);
    throw error;
  }
};

/**
 * DB: Set a photo as the cover for its theme group
 */
export const setPhotoAsCover = async (id) => {
  try {
    const response = await axios.post(`${LOCAL_PROXY_BASE}/set-cover`, { id });
    return response.data;
  } catch (error) {
    console.error('Error setting cover:', error);
    throw error;
  }
};

/**
 * DB: Reset all data
 */
export const resetPhotos = async () => {
  try {
    const response = await axios.post(`${LOCAL_PROXY_BASE}/reset-photos`);
    return response.data;
  } catch (error) {
    console.error('Error resetting data:', error);
    throw error;
  }
};
