import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Calendar, Camera, Heart, ChevronRight, Star, LogIn, RefreshCcw, X, Tag, MessageSquare, Save, Folder, ArrowLeft, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { mockPhotos } from './data/mockData';
import { 
  createPickerSession, fetchPickerItems, checkSessionStatus, getSavedPhotos, 
  savePhotos, deletePhoto, updatePhotoDetails, renameTheme, resetPhotos, setPhotoAsCover, finalizePhotosSync
} from './services/googlePhotos';

const LazyImagePlaceholder = () => (
  <div className="w-full h-full bg-pastel-pink/10 flex flex-col items-center justify-center text-pastel-accent p-4 text-center">
    <Sparkles className="w-6 h-6 mb-2 opacity-50" />
    <p className="text-xs font-bold font-sans">인증 시<br/>보여짐</p>
  </div>
);

const START_YEAR = 2012;
const CURRENT_YEAR = new Date().getFullYear();
const years = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 1 },
  (_, i) => START_YEAR + i
).reverse();

const GOOGLE_CLIENT_ID = "953413689641-i8gtt9m4jgni6sv8htpul9u6o39nmd7q.apps.googleusercontent.com";

function AlbumContent() {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photos, setPhotos] = useState([]); 
  const [accessToken, setAccessToken] = useState(null);
  const [pickerSessionId, setPickerSessionId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSaved = async () => {
      setLoading(true);
      const saved = await getSavedPhotos();
      if (saved.length > 0) {
        setPhotos(saved);
      } else {
        setPhotos(mockPhotos);
      }
      setLoading(false);
    };
    loadSaved();
  }, []);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      try {
        setLoading(true);
        const session = await createPickerSession(tokenResponse.access_token);
        setPickerSessionId(session.id);
        window.open(session.pickerUri, 'google-photos-picker', 'width=600,height=800');
        alert('구글 포토 선택기가 열렸습니다. 사진을 선택하고 [Done]을 누른 뒤 앱에서 [선택 완료 및 가져오기] 버튼을 눌러주세요.');
      } catch (err) {
        alert('피커 세션을 생성하지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    scope: 'openid profile email https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
    prompt: 'consent',
  });

  /**
   * 1. 구글 포토 선택기 열기
   */
  const handleOpenPicker = async () => {
    if (!accessToken) {
      login();
      return;
    }
    try {
      setLoading(true);
      const session = await createPickerSession(accessToken);
      setPickerSessionId(session.id);
      const pickerWindow = window.open(session.pickerUri, 'google-photos-picker', 'width=600,height=800');
      if (!pickerWindow) {
        alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해 주세요.');
        return;
      }
      alert('구글 창에서 사진을 선택하고 [Done]을 누른 뒤, 앱의 [선택 완료 및 가져오기] 버튼을 눌러주세요.');
    } catch (err) {
      alert('피커를 열지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 2. 선택된 사진들 DB로 가져오기 (지능형 대기 로직)
   */
  const handleSyncPhotos = async () => {
    if (!accessToken || !pickerSessionId) {
      alert('먼저 사진을 선택해 주세요.');
      return;
    }
    
    setLoading(true);
    let attempts = 0;
    const maxAttempts = 5;

    const checkAndFetch = async () => {
      try {
        const session = await checkSessionStatus(accessToken, pickerSessionId);
        const isFinished = session.isCompleted || (session.status === 'COMPLETED') || session.mediaItemsSet;

        if (isFinished) {
          const selectedPhotos = await fetchPickerItems(accessToken, pickerSessionId);
          if (selectedPhotos && selectedPhotos.length > 0) {
            const userTheme = window.prompt("이번 추억의 이름을 입력해 주세요:", "아이와의 소중한 하루");
            if (userTheme === null) return "CANCELLED";

            const theme = userTheme || "기타 추억";
            const themedPhotos = selectedPhotos.map(p => ({ ...p, theme }));
            
            await savePhotos(themedPhotos);
            const updated = await getSavedPhotos();
            setPhotos(updated);
            
            if (themedPhotos[0].date) {
              setSelectedYear(parseInt(themedPhotos[0].date.split('-')[0]));
              setSelectedTheme(theme);
            }
            alert(`${themedPhotos.length}개의 사진을 보관함에 담았습니다!`);
            setPickerSessionId(null);
            return "SUCCESS";
          }
           return "NO_PHOTOS";
        }
        return "WAITING";
      } catch (error) {
        console.error('Sync error:', error);
        return "ERROR";
      }
    };

    const poll = async () => {
      const status = await checkAndFetch();
      if (status === "SUCCESS" || status === "CANCELLED" || status === "NO_PHOTOS") {
        setLoading(false);
        if (status === "NO_PHOTOS") alert('선택된 사진이 없습니다.');
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(poll, 2000); // 2초 뒤 재시도
      } else {
        setLoading(false);
        alert('구글 창에서 [Done] 버튼을 누르셨나요? 아직 확인되지 않습니다. 잠시 후 다시 시도해 주세요.');
      }
    };

    poll();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      await deletePhoto(id);
      setPhotos(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert('삭제 중 오류 발생');
    }
  };

  const handleUpdateDetails = async (id, theme, comment) => {
    try {
      setLoading(true);
      await updatePhotoDetails(id, theme, comment);
      setPhotos(prev => prev.map(p => p.id === id ? { ...p, theme, comment } : p));
      setSelectedPhoto(prev => ({ ...prev, theme, comment }));
      alert('기록되었습니다!');
    } catch (err) {
      alert('저장 오류');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (photo) => {
    if (!photo) return '';
    if (photo.is_synced === false) return null; // Placeholder 트리거
    
    const proxyBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api';
    const url = photo.url;
    // 과거 로컬 저장 데이터 호환처리 제거됨
    
    const isGooglePhoto = url.includes('googleusercontent.com');
    if (isGooglePhoto && accessToken) {
      return `${proxyBase}/image-proxy?url=${encodeURIComponent(url)}&token=${accessToken}`;
    }
    return url;
  };

  const handleFinalizeSync = async () => {
    if (!window.confirm('현재 임시 모드인 사진들을 리얼망(네트워크)을 통해 불러오시겠습니까? (최종 권한 인가)')) return;
    try {
      setLoading(true);
      const unsyncedIds = photos.filter(p => p.is_synced === false).map(p => p.id);
      if (unsyncedIds.length === 0) {
        alert('모든 사진이 이미 로드되어 있습니다.');
        return;
      }
      await finalizePhotosSync(unsyncedIds);
      const updated = await getSavedPhotos();
      setPhotos(updated);
      alert(`${unsyncedIds.length}개의 사진 인증을 완료했습니다!`);
    } catch (err) {
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameTheme = async (e, oldTheme) => {
    e.stopPropagation();
    const newTheme = window.prompt(`'${oldTheme}'의 이름 변경:`, oldTheme);
    if (newTheme && newTheme !== oldTheme) {
      try {
        setLoading(true);
        await renameTheme(selectedYear, oldTheme, newTheme);
        setPhotos(prev => prev.map(p => {
          const pYear = p.date ? p.date.split('-')[0] : 'Etc';
          const pTheme = p.theme || '기타 추억';
          return (pYear === String(selectedYear) && pTheme === oldTheme) ? { ...p, theme: newTheme } : p;
        }));
      } catch (err) {
        alert('오류 발생');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSetCover = async (e, id) => {
    e.stopPropagation();
    try {
      setLoading(true);
      const targetPhoto = photos.find(p => p.id === id);
      const targetYear = targetPhoto.date ? targetPhoto.date.split('-')[0] : 'Etc';
      const targetTheme = targetPhoto.theme || '기타 추억';
      
      await setPhotoAsCover(id, targetYear, targetTheme);
      
      setPhotos(prev => prev.map(p => {
        const pYear = p.date ? p.date.split('-')[0] : 'Etc';
        const pTheme = p.theme || '기타 추억';
        return (pYear === targetYear && pTheme === targetTheme) ? { ...p, isCover: p.id === id } : p;
      }));
      if (selectedPhoto && selectedPhoto.id === id) {
        setSelectedPhoto(prev => ({ ...prev, isCover: true }));
      }
      alert('대표 지정 완료!');
    } catch (err) {
      alert('설정 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('전체 초기화하시겠습니까?')) return;
    try {
      setLoading(true);
      await resetPhotos();
      setPhotos(mockPhotos);
      alert('초기화 완료');
    } catch (err) {
      alert('오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const albumStructure = useMemo(() => {
    const yearsData = {};
    photos.forEach(photo => {
      const yr = photo.date ? photo.date.split('-')[0] : 'Etc';
      const thm = photo.theme || '기타 추억';
      if (!yearsData[yr]) yearsData[yr] = {};
      if (!yearsData[yr][thm]) yearsData[yr][thm] = [];
      yearsData[yr][thm].push(photo);
    });
    return yearsData;
  }, [photos]);

  const currentThemes = useMemo(() => {
    if (!albumStructure[selectedYear]) return [];
    return Object.keys(albumStructure[selectedYear]);
  }, [albumStructure, selectedYear]);

  const currentPhotos = useMemo(() => {
    if (!albumStructure[selectedYear] || !selectedTheme) return [];
    return albumStructure[selectedYear][selectedTheme] || [];
  }, [albumStructure, selectedYear, selectedTheme]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-warm-cream font-sans text-[#4A4A4A] overflow-hidden">
      <aside className="w-full md:w-80 bg-white/80 backdrop-blur-md border-b md:border-b-0 md:border-r border-[#F0EBE3] flex flex-col p-8 z-10 overflow-y-auto">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-pastel-pink rounded-xl flex items-center justify-center"><Sparkles className="text-pastel-accent w-6 h-6" /></div>
          <div><h1 className="text-xl font-serif italic text-pastel-accent leading-none">Growth</h1><p className="text-[10px] tracking-widest text-gray-400 uppercase mt-1">Journey Album</p></div>
        </div>

        <div className="mb-10">
          {!accessToken ? (
            <button onClick={() => login()} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#F0EBE3] rounded-2xl text-sm font-medium hover:bg-[#FFF5F5] transition-all shadow-sm">
              <LogIn className="w-4 h-4" /> <span>Google Photos 연동</span>
            </button>
          ) : (
            <div className="flex items-center justify-between px-4 py-3 bg-pastel-pink/20 rounded-2xl border border-pastel-pink/30">
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /><span className="text-[11px] font-bold text-pastel-accent uppercase tracking-wider">Connected</span></div>
              <button onClick={handleSyncPhotos} disabled={loading} className="text-pastel-accent"><RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
          )}
        </div>

        <nav className="flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 px-4">Timeline</p>
          <ul className="space-y-2">
            {years.map((year) => (
              <li key={year}>
                <button onClick={() => { setSelectedYear(year); setSelectedTheme(null); }} className={`w-full group flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${selectedYear === year ? 'bg-pastel-pink text-pastel-accent font-semibold shadow-sm' : 'hover:bg-[#FFF5F5] text-gray-400'}`}>
                  <div className="flex items-center gap-3"><Calendar className={`w-4 h-4 ${selectedYear === year ? 'text-pastel-accent' : 'text-gray-300'}`} /><span>{year} Year</span></div>
                  {selectedYear === year && <ChevronRight className="w-4 h-4" />}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-8 pt-6 border-t border-[#F0EBE3]"><button onClick={handleResetData} className="w-full py-3 bg-red-50 text-red-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"><X className="w-3 h-3" /><span>데이터 초기화</span></button></div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-warm-cream/50">
        <div className="max-w-6xl mx-auto p-8 md:p-16">
          <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <motion.div key={selectedYear} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center gap-2 mb-2"><span className="px-3 py-1 bg-pastel-pink text-white text-[10px] font-bold rounded-full uppercase">Viewing</span><span className="text-gray-400 text-xs font-mono">/ {selectedYear} Records</span></div>
              <h2 className="text-5xl md:text-7xl font-serif italic text-gray-800 leading-tight">{selectedYear} <span className="not-italic font-sans text-gray-400">Growth Story</span></h2>
              {selectedTheme && <button onClick={() => setSelectedTheme(null)} className="mt-4 flex items-center gap-2 text-pastel-accent hover:underline font-bold"><ArrowLeft className="w-4 h-4" /> <span>목록으로 돌아가기</span></button>}
            </motion.div>
            <div className="flex gap-4 w-full md:w-auto">
              {photos.some(p => p.is_synced === false) && (
                <button
                  onClick={handleFinalizeSync}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-full font-bold shadow-lg transition-all border-2 border-pastel-accent bg-white text-pastel-accent hover:bg-pastel-pink/10"
                >
                  <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  <span>네트워크 노출 (2단계 완료)</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (!accessToken) login();
                  else if (!pickerSessionId) handleOpenPicker();
                  else handleSyncPhotos();
                }}
                disabled={loading}
                className={`flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold shadow-lg transition-all ${
                  pickerSessionId ? 'bg-green-500 text-white animate-pulse' : 'bg-pastel-accent text-white hover:border-b-4 hover:shadow-pastel-accent/30 hover:-translate-y-1'
                } active:scale-95`}
              >
                {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : pickerSessionId ? <Sparkles className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                <span>{!accessToken ? '구글 Photos 연동' : (!pickerSessionId ? '구글 포토에서 추억 골라오기' : '선택 완료 (1단계 메타저장)')}</span>
              </button>
            </div>
          </header>

          {!selectedTheme ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {currentThemes.length > 0 ? (
                currentThemes.map((theme) => {
                  const themePhotos = albumStructure[selectedYear][theme];
                  const coverPhoto = themePhotos.find(p => p.isCover) || themePhotos[0];
                  return (
                    <motion.div key={theme} whileHover={{ scale: 1.02 }} className="group relative cursor-pointer bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl border border-[#F0EBE3]" onClick={() => setSelectedTheme(theme)}>
                      <button onClick={(e) => handleRenameTheme(e, theme)} className="absolute top-8 right-8 z-20 p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-400 hover:text-pastel-pink opacity-0 group-hover:opacity-100 transition-all"><Edit2 className="w-3 h-3" /></button>
                      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-6 bg-warm-cream">
                        {coverPhoto && (
                          getImageUrl(coverPhoto) 
                            ? <img src={getImageUrl(coverPhoto)} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            : <LazyImagePlaceholder />
                        )}
                        <div className="absolute top-4 right-4 bg-white/90 rounded-full px-3 py-1 text-[10px] font-bold text-gray-600">{themePhotos.length} Photos</div>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-1">{theme}</h3><p className="text-gray-400 text-xs font-mono uppercase">Memory Group</p>
                    </motion.div>
                  );
                })
              ) : (<div className="col-span-full py-24 text-center border-2 border-dashed border-warm-cream rounded-[2.5rem]"><Folder className="w-12 h-12 text-warm-cream mx-auto mb-4" /><p className="text-gray-400">등록된 추억이 없습니다.</p></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <AnimatePresence mode="popLayout">
                {currentPhotos.map((photo) => (
                  <motion.div key={photo.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group relative cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                    <div className="relative h-full bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all border border-[#F0EBE3] group-hover:-translate-y-2">
                      <button onClick={(e) => handleDelete(e, photo.id)} className="absolute top-4 right-4 z-20 p-2 bg-white/80 rounded-full text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button>
                      <button onClick={(e) => handleSetCover(e, photo.id)} className={`absolute top-4 left-4 z-20 p-2 rounded-full transition-all shadow-md opacity-0 group-hover:opacity-100 ${photo.isCover ? 'bg-yellow-400 text-white opacity-100' : 'bg-white/80 text-gray-400 hover:text-yellow-500'}`} title="대표 지정"><Star className={`w-4 h-4 ${photo.isCover ? 'fill-current' : ''}`} /></button>
                      {getImageUrl(photo)
                        ? <img src={getImageUrl(photo)} referrerPolicy="no-referrer" className="w-full aspect-[4/5] object-cover transition-transform group-hover:scale-110" />
                        : <div className="w-full aspect-[4/5]"><LazyImagePlaceholder /></div>
                      }
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6"><div className="text-white"><p className="text-sm font-medium line-clamp-2">{photo.comment || photo.description}</p><p className="text-[10px] opacity-60 mt-1 uppercase tracking-widest">{photo.date}</p></div></div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedPhoto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative max-w-6xl w-full bg-white rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex-1 bg-black flex items-center justify-center p-4">
                {getImageUrl(selectedPhoto)
                  ? <img src={getImageUrl(selectedPhoto)} referrerPolicy="no-referrer" className="max-w-full max-h-[70vh] object-contain rounded-xl" />
                  : <div className="max-w-full"><LazyImagePlaceholder /></div>
                }
              </div>
              <div className="w-full md:w-96 p-8 flex flex-col bg-white overflow-y-auto">
                <div className="flex justify-between mb-8"><div><span className="text-[10px] font-bold text-pastel-accent uppercase tracking-widest block mb-1">Photo Details</span><h3 className="text-2xl font-serif italic text-gray-800">{selectedPhoto.date}</h3></div><button onClick={() => setSelectedPhoto(null)}><X className="w-6 h-6 text-gray-300 hover:text-pastel-accent" /></button></div>
                <div className="space-y-6 flex-1">
                  <div><label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2"><Tag className="w-3 h-3" /> Theme</label><input type="text" id="photo-theme" defaultValue={selectedPhoto.theme || ''} className="w-full px-4 py-3 bg-warm-cream/50 rounded-2xl border-none outline-none text-sm" /></div>
                  <div><label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2"><MessageSquare className="w-3 h-3" /> Our Story</label><textarea id="photo-comment" defaultValue={selectedPhoto.comment || ''} rows={5} className="w-full px-4 py-3 bg-warm-cream/50 rounded-2xl border-none outline-none text-sm resize-none" /></div>
                </div>
                <div className="mt-8 flex flex-col gap-3">
                  <button onClick={() => { const theme = document.getElementById('photo-theme').value; const comment = document.getElementById('photo-comment').value; handleUpdateDetails(selectedPhoto.id, theme, comment); }} className="w-full py-4 bg-pastel-accent text-white rounded-2xl font-bold hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><Save className="w-4 h-4" /> <span>추억 기록하기</span></button>
                  <button onClick={(e) => handleSetCover(e, selectedPhoto.id)} className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border-2 ${selectedPhoto.isCover ? 'bg-yellow-50 border-yellow-200 text-yellow-600' : 'bg-white border-gray-100 text-gray-400 hover:border-yellow-200 hover:bg-yellow-50 hover:text-yellow-600'}`}><Star className={`w-4 h-4 ${selectedPhoto.isCover ? 'fill-current' : ''}`} /><span>{selectedPhoto.isCover ? '현재 대표 사진' : '이 사진을 대표로 지정'}</span></button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AlbumContent />
    </GoogleOAuthProvider>
  );
}

export default App;
