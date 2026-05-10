import { createClient } from '@supabase/supabase-js';

// .env 파일(Vite 환경의 경우 .env.local)에서 환경변수를 로드합니다.
// VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 정의되어 있어야 합니다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL 또는 Anon Key가 설정되지 않았습니다. .env.local 파일을 확인해주세요.');
}

// Supabase 클라이언트 인스턴스 생성 및 내보내기
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
