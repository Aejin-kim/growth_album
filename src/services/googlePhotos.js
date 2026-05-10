import axios from 'axios';
import { supabase } from './db';

// 환경 변수 VITE_API_BASE_URL이 배포 환경(Vercel)에 설정되어 있다면 그 주소를 활용하고, 없다면 로컬 개발 주소를 사용합니다.
const PROXY_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api';

/**
 * Creates a new Picker Session via Proxy.
 */
export const createPickerSession = async (accessToken) => {
  try {
    const response = await axios.post(`${PROXY_BASE}/create-session`, {}, {
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
    const response = await axios.get(`${PROXY_BASE}/session-status/${sessionId}`, {
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
    const response = await axios.get(`${PROXY_BASE}/fetch-items/${sessionId}`, {
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

      // 구글 이미지 보안 차단을 우회하기 위해 프록시 서버의 /image-proxy 사용
      // [중요] Picker API는 이미지 접근 시에도 인증 토큰이 필요합니다.
      const originalUrl = baseUrl + '=w1200';
      const proxyUrl = `${PROXY_BASE}/image-proxy?url=${encodeURIComponent(originalUrl)}&token=${accessToken}`;
      
      return {
        id: item.id || `google-${Math.random().toString(36).substr(2, 9)}`,
        url: proxyUrl,
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
 * DB: Fetch all saved photos from Supabase.
 */
export const getSavedPhotos = async () => {
  try {
    const { data, error } = await supabase.from('photos').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching saved photos:', error);
    return [];
  }
};

/**
 * DB: Save new photos to Supabase (Step 1: is_synced false by default).
 */
export const savePhotos = async (photos) => {
  try {
    const { data, error } = await supabase.from('photos').upsert(
      photos.map(p => ({
        id: p.id,
        url: p.url,
        original_google_url: p.originalGoogleUrl || p.url,
        mime_type: p.mimeType || 'image/jpeg',
        date: p.date,
        theme: p.theme,
        comment: p.comment,
        description: p.description,
        is_synced: false
      }))
    );
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving photos to Supabase:', error);
    throw error;
  }
};

/**
 * DB: Delete a photo from Supabase.
 */
export const deletePhoto = async (id) => {
  try {
    const { error } = await supabase.from('photos').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
};

/**
 * DB: Update photo details (theme and comment) in Supabase.
 */
export const updatePhotoDetails = async (id, theme, comment) => {
  try {
    const { error } = await supabase.from('photos').update({ theme, comment }).eq('id', id);
    if (error) throw error;
    return true;
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
    const { error } = await supabase.from('photos').update({ theme }).in('id', ids);
    if (error) throw error;
    return true;
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
    // Supabase에서는 조건이 복잡해질 수 있으므로, 프론트에서 date like/startsWith 조건으로 일괄 업뎃이 필요함.
    const { error } = await supabase
      .from('photos')
      .update({ theme: newTheme })
      .like('date', `${year}-%`)
      .eq('theme', oldTheme);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error renaming theme:', error);
    throw error;
  }
};

/**
 * DB: Set a photo as the cover for its theme group
 */
export const setPhotoAsCover = async (id, year, theme) => {
  try {
    // 1. 해당 테마의 모든 사진 is_cover = false 처리
    await supabase.from('photos').update({ is_cover: false }).like('date', `${year}-%`).eq('theme', theme);
    // 2. 타겟 사진 is_cover = true
    const { error } = await supabase.from('photos').update({ is_cover: true }).eq('id', id);
    if (error) throw error;
    return true;
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
    const { error } = await supabase.from('photos').delete().neq('id', 'dummy'); // 모두 삭제
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error resetting data:', error);
    throw error;
  }
};

/**
 * DB: (Step 2) Finalize Auth to mark photos as synced
 */
export const finalizePhotosSync = async (ids) => {
  try {
    const { error } = await supabase.from('photos').update({ is_synced: true }).in('id', ids);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error finalizing sync:', error);
    throw error;
  }
};
