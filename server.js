import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const PHOTOS_FILE = path.join(DATA_DIR, 'photos.json');
const IMAGE_DIR = path.join(DATA_DIR, 'images');

// 데이터 디렉토리 및 파일 초기화
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR);
if (!fs.existsSync(PHOTOS_FILE)) fs.writeFileSync(PHOTOS_FILE, JSON.stringify([]));

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';
const API_KEY = 'AIzaSyChyKFeZ4XPrwV8B4QbZPP7S7dU7NwbK8M';

// 이미지 정적 폴더 서빙
app.use('/images', express.static(IMAGE_DIR));

// 요청 로거
app.use((req, res, next) => {
  if (req.url !== '/api/saved-photos') console.log(`[PROXY] ${req.method} ${req.url}`);
  next();
});

// 1. 저장된 모든 사진 가져오기
app.get('/api/saved-photos', (req, res) => {
  try {
    const data = fs.readFileSync(PHOTOS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// 2. 사진 저장 (자동 로컬 다운로드 포함)
app.post('/api/save-photos', async (req, res) => {
  try {
    const newPhotos = req.body; 
    let currentData = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));

    // 중복 체크 및 다운로드 대상 선별
    const existingIds = new Set(currentData.map(p => p.id));
    const photosToDownload = newPhotos.filter(p => !existingIds.has(p.id));

    const processedPhotos = await Promise.all(photosToDownload.map(async (photo) => {
      try {
        console.log(`[STORAGE] Downloading: ${photo.id}`);
        const response = await axios.get(photo.url, { responseType: 'arraybuffer', timeout: 30000 });
        
        const ext = photo.mimeType?.split('/')[1] || 'jpg';
        const filename = `${photo.id || Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
        const filePath = path.join(IMAGE_DIR, filename);
        
        fs.writeFileSync(filePath, response.data);
        
        return {
          ...photo,
          url: `http://localhost:3001/images/${filename}`, // 로컬 주소로 교체
          originalGoogleUrl: photo.url // 만약을 위해 원본 유지
        };
      } catch (err) {
        console.error(`[STORAGE] Failed ${photo.id}: ${err.message}`);
        return photo; 
      }
    }));

    const updatedData = [...processedPhotos, ...currentData];
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(updatedData, null, 2));
    res.json({ success: true, count: processedPhotos.length });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Failed to save photos' });
  }
});

// 3. 사진 삭제
app.delete('/api/delete-photo/:id', (req, res) => {
  try {
    const { id } = req.params;
    const currentData = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));
    const photoToDelete = currentData.find(p => p.id === id);
    
    // 로컬 파일도 삭제 시도
    if (photoToDelete && photoToDelete.url.includes('/images/')) {
      const filename = photoToDelete.url.split('/images/')[1];
      const filePath = path.join(IMAGE_DIR, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const updatedData = currentData.filter(p => p.id !== id);
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(updatedData, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// 4. 정보 업데이트
app.post('/api/update-photo-details', (req, res) => {
  try {
    const { id, theme, comment } = req.body;
    const currentData = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));
    const updatedData = currentData.map(p => p.id === id ? { ...p, theme, comment } : p);
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(updatedData, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

// 5. 대표 사진 설정
app.post('/api/set-cover', (req, res) => {
  try {
    const { id } = req.body;
    const currentData = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));
    
    // 1. 대상 사진 찾기
    const target = currentData.find(p => p.id === id);
    if (!target) return res.status(404).json({ error: 'Photo not found' });

    const targetYear = target.date ? target.date.split('-')[0] : 'Etc';
    const targetTheme = target.theme || '기타 추억';

    // 2. 같은 연도/테마의 모든 사진에서 isCover 해제 후, 대상만 설정
    const updatedData = currentData.map(p => {
      const pYear = p.date ? p.date.split('-')[0] : 'Etc';
      const pTheme = p.theme || '기타 추억';

      if (pYear === targetYear && pTheme === targetTheme) {
        return { ...p, isCover: p.id === id };
      }
      return p;
    });

    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(updatedData, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set cover' });
  }
});

// 6. 테마 이름 일괄 변경 
app.post('/api/rename-theme', (req, res) => {
  try {
    const { year, oldTheme, newTheme } = req.body;
    const currentData = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));
    const updatedData = currentData.map(p => {
      const pYear = p.date ? p.date.split('-')[0] : 'Etc';
      const pTheme = p.theme || '기타 추억';
      if (pYear === String(year) && pTheme === oldTheme) return { ...p, theme: newTheme };
      return p;
    });
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(updatedData, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Rename failed' });
  }
});

// 6. 데이터 초기화 (모든 사진 및 이미지 삭제)
app.post('/api/reset-photos', (req, res) => {
  try {
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify([]));
    
    // 이미지 폴더 내 파일들도 모두 삭제
    const files = fs.readdirSync(IMAGE_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(IMAGE_DIR, file));
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

// --- [Google Photos API Proxy] ---
app.post('/api/create-session', async (req, res) => {
  try {
    const response = await axios.post(`${PICKER_API_BASE}/sessions?key=${API_KEY}`, {}, {
      headers: { Authorization: req.headers.authorization, 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

app.get('/api/session-status/:sessionId', async (req, res) => {
  try {
    const response = await axios.get(`${PICKER_API_BASE}/sessions/${req.params.sessionId}?key=${API_KEY}`, {
      headers: { Authorization: req.headers.authorization, 'X-Goog-Api-Key': API_KEY }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/fetch-items/:sessionId', async (req, res) => {
  try {
    const response = await axios.get(`${PICKER_API_BASE}/mediaItems?sessionId=${req.params.sessionId}&key=${API_KEY}`, {
      headers: { Authorization: req.headers.authorization, 'X-Goog-Api-Key': API_KEY }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/image-proxy', async (req, res) => {
  const { url, token } = req.query;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (error) {
    res.status(500).send('Proxy Error');
  }
});

app.listen(3001, '0.0.0.0', () => {
  console.log('--- Growth Album Server Started on Port 3001 ---');
});
