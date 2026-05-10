# Growth Album: Supabase Database Setup Guide

이 문서는 본 프로젝트가 로컬 기반(`photos.json`) 스토리지에서 **클라우드(Supabase)** 구조로 마이그레이션할 때 진행했던 셋업 절차와, 향후 유지보수를 위한 가이드를 담고 있습니다.

---

## 1. 초기 셋업 진행 과정 (마이그레이션 시점: 2026-04-21)

### Phase 1: 패키지 설치
로컬 프록시 의존성을 프론트엔드 직접 쿼리로 전환하기 위해, 프로젝트에 Supabase Javascript 클라이언트를 설치했습니다.
```bash
npm install @supabase/supabase-js
```

### Phase 2: 클라이언트 세팅 및 환경 변수
인증 정보 하드코딩 방지를 위해 `.env.local`을 생성하고 다음과 같이 환경을 세팅했습니다.
```env
VITE_SUPABASE_URL=https://(자신의_프로젝트값).supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...(자신의_ANON퍼블릭키)
```
- 프로젝트 내 `src/services/db.js` 파일이 위 환경 변수를 참조하여 `supabase` 클라이언트 인스턴스를 애플리케이션 전역에 제공하게 됩니다.

### Phase 3: 데이터베이스 스키마(Table) 구성
Supabase 프로젝트 대시보드의 **SQL Editor**를 통해 아래 쿼리를 실행하여 `photos` 전용 테이블을 생성했습니다.
```sql
CREATE TABLE public.photos (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  original_google_url TEXT,
  mime_type TEXT,
  date TEXT,
  theme TEXT,
  comment TEXT,
  description TEXT,
  is_cover BOOLEAN DEFAULT false,
  is_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
-- 개발 편의를 위해 누구나 CRUD 가능한 RLS 해제 정책 적용
CREATE POLICY "Allow public read access" ON public.photos FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.photos FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.photos FOR DELETE USING (true);
```

---

## 2. 향후 셋업 및 유지보수 시나리오 가이드

### A. 새로운 PC나 환경에서 실행할 경우
본 프로젝트를 Clone 한 뒤, 가장 먼저 위의 **Phase 2**에 나온 `.env.local` 파일을 수동으로 생성해주셔야 정상적으로 클라우드 DB와 통신할 수 있습니다. 키는 GitHub에 올라가지 않습니다(`.gitignore`에 의해 보호됨).

### B. 최종 서버(Vercel, Firebase Hosting, Cloudflare Pages 등)에 배포할 경우
최종적으로 애플리케이션을 배포할 때, 배포 플랫폼의 **Environment Variables (환경 변수 설정 창)**에 반드시 다음 2개의 변수를 수동으로 입력해 주어야 프로덕션 빌드에서 DB 연동이 동작합니다.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### C. (선택) Auth 연동과 보안 적용
현재는 `Allow public read/update access`를 통해 구글 로그인 등과 관계없이 누구나 데이터를 Insert 할 수 있도록 구성되어 있습니다. 추후 앱이 고도화되어 타인과 격리된 완전한 나만의 공간을 만들어야 할 경우, Supabase Auth를 얹어 RLS(Row Level Security) 정책을 `auth.uid() = user_id` 형태로 변경해야 합니다.
