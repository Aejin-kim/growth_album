-- Growth Album: Photos Table Schema
-- 이 코드를 복사하여 Supabase의 [SQL Editor] 탭에 붙여넣고 실행(Run)해 주세요.

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
  is_synced BOOLEAN DEFAULT false,  -- 2단계 로딩(지연 연동)을 위한 핵심 상태값
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS (Row Level Security) 설정 (현재는 편의상 모두에게 접근 허용, 추후 Auth 적용 시 수정)
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.photos FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access"
  ON public.photos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON public.photos FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access"
  ON public.photos FOR DELETE
  USING (true);
