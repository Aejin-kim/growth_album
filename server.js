import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';
const API_KEY = 'AIzaSyChyKFeZ4XPrwV8B4QbZPP7S7dU7NwbK8M';

// 요청 로거
app.use((req, res, next) => {
  console.log(`[PROXY] ${req.method} ${req.url}`);
  next();
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
