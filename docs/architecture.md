# Growth Album Application Architecture

이 문서는 Growth Album 웹 애플리케이션의 시스템 구조, 기술 스택, 그리고 핵심 로직의 흐름을 설명하는 최종 아키텍처 가이드입니다. 

---

## 1. System Overview (시스템 개요)
Growth Album은 사용자가 아이의 성장 과정이나 소중한 추억을 연도별, 추억(테마)별로 기록하고 관리할 수 있도록 설계된 웹 애플리케이션입니다. 

### 1.1 아키텍처 변천사 (V1 -> V2)
*   **V1 (초기 모델 - 로컬 의존성):** 구글 포토 API 이미지 링크의 '60분 만료' 문제를 해결하기 위해, 사진을 선택하는 즉시 백엔드가 로컬 디렉토리(`data/images`)에 원본 파일을 모두 다운로드하고 로컬 JSON(`data/photos.json`)으로 관리했습니다. 이는 엄청난 스토리지 용량 부족과 트래픽 병목 현상을 야기했습니다.
*   **V2 (최종 모델 - 클라우드 지연 로딩):** 이 문제를 해결하기 위해 **Supabase DB**와 **2단계 지연 로딩(2-Step Lazy Loading)** 아키텍처를 도입했습니다. 이제 시스템은 무거운 원본 파일을 다운로드하는 대신 가벼운 구글 포토 고유 ID와 메타데이터만 DB에 저장하며, 사용자가 화면을 볼 때 실시간으로 새로운 링크를 갱신하여 렌더링합니다.

---

## 2. Tech Stack (기술 스택)

### 2.1 Frontend (React / Vite)
*   **Framework**: React.js
*   **Styling**: Tailwind CSS
*   **Animation**: Framer Motion
*   **Icons**: Lucide React
*   **Authentication**: Google OAuth 2.0 (`@react-oauth/google`)

### 2.2 Backend (Node.js Proxy)
*   **Framework**: Express.js
*   **역할**: 프론트엔드가 구글 API와 통신할 때 발생하는 CORS 및 인증 문제를 해결하기 위한 프록시(Proxy) 역할 전담. (로컬 파일 저장 기능은 완전히 제거됨)

### 2.3 Database (Cloud)
*   **Database**: Supabase (PostgreSQL) - 사진 메타데이터 관리

---

## 3. High-Level Architecture (아키텍처 구조)

### 3.1 Frontend (`src/App.jsx`, `src/services/googlePhotos.js`)
*   **Service Layer (`googlePhotos.js`)**: Supabase와의 통신 및 백엔드 프록시 API 호출을 전담합니다.
*   **UI Layer**: 데이터의 상태(`is_synced`)를 기반으로 임시 썸네일('인증시 보여짐') 또는 실제 렌더링을 담당합니다. 대표 사진(`isCover`)을 지정하여 폴더 커버로 사용하는 로직이 포함되어 있습니다.

### 3.2 Backend Proxy (`server.js`)
*   `/api/create-session`, `/api/fetch-items`, `/api/image-proxy` 등 구글 API와의 통신 중계만 수행하는 매우 가벼운 릴레이 서버입니다.

---

## 4. Key Workflows (핵심 동작 흐름)

### 4.1 Photo Sync Flow (사진 동기화 2단계 엔진)
1.  **세션 생성 (1단계 메타저장):** 구글 포토 피커 팝업에서 사진을 선택하면, 원본을 받지 않고 사진의 메타데이터(ID, 날짜 등)만 가져와 Supabase에 `is_synced = false` 상태로 임시 저장합니다. 화면에는 임시 썸네일이 렌더링되어 사용자가 빠르게 앨범을 정리할 수 있습니다.
2.  **최종 네트워크 동기화 (2단계 확정):** 사용자가 앨범 정리를 마치고 "네트워크 노출"을 승인하면, 저장된 고유 ID들을 이용해 백엔드 프록시를 거쳐 리얼 망에서 사진을 불러오고 `is_synced = true`로 확정 짓습니다.

### 4.2 Data Modification (대표 사진 지정)
*   Supabase DB의 `is_cover` 속성을 활용해 테마(폴더)당 1장의 사진만 커버로 사용합니다. 이를 통해 폴더 접근 시 불필요한 트래픽 소모를 방지합니다.

---

## 5. Deployment (배포 타겟)
*   **Database**: Supabase
*   **Frontend**: Vercel
*   **Backend Proxy**: Render.com
