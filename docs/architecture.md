# Growth Album Application Architecture

이 문서는 Growth Album 웹 애플리케이션의 전체적인 시스템 구조, 기술 스택, 그리고 핵심 로직의 흐름을 설명하는 아키텍처 가이드입니다.

---

## 1. System Overview (시스템 개요)
Growth Album은 사용자가 아이의 성장 과정이나 소중한 추억을 연도별, 추억(테마)별로 기록하고 관리할 수 있도록 설계된 웹 애플리케이션입니다. 

구글 포토(Google Photos Picker API)와 연동하여 사용자의 소중한 추억을 관리합니다. **2단계(Lazy Loading) 동기화 아키텍처**를 채택하여, 1단계(빠른 메타데이터 정리) 작업과 2단계(최종 권한 승인 시 원본 로드) 작업을 완벽히 분리했습니다. 이를 통해 로컬 환경의 제약과 트래픽 병목을 해결하고, 구글 포토 이미지의 URL 보안 만료(60분) 문제 및 확장성을 확보했습니다.

---

## 2. Tech Stack (기술 스택)

### 2.1 Frontend
*   **Framework**: React.js (Vite 환경)
*   **Styling**: Tailwind CSS
*   **Animation**: Framer Motion (부드러운 전환 효과, 리스트 애니메이션 등)
*   **Icons**: Lucide React
*   **Authentication**: Google OAuth 2.0 (`@react-oauth/google`)

### 2.2 Backend (Proxy & Local Server)
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **HTTP Client**: Axios

### 2.3 Database & Storage
*   **Database**: Supabase (PostgreSQL) - 사용자, 연도, 테마, 사진의 관계형 메타데이터 관리
*   **Auth**: Supabase Auth (구현 예정)

---

## 3. High-Level Architecture (아키텍처 구조)

### 3.1 Frontend (`src/App.jsx`, `src/services/googlePhotos.js`)
프론트엔드는 UI를 렌더링하고, 사용자와 Google Photos 간의 인증 및 사진 동기화 생명 주기를 제어합니다.
*   **State Management**: `useState`와 `useMemo`를 이용해 사진 데이터 배열을 앨범 계층(연도 > 테마 > 사진)으로 변환하여 사용합니다.
*   **Auth Flow**: `useGoogleLogin` 호출 시 사용자의 Access Token을 발급받아 상태로 유지하며, 이후 백엔드로 전달합니다.
*   **Service Layer (`googlePhotos.js`)**: 백엔드 REST API와의 통신을 전담하는 계층입니다. 관심사 분리(SoC)를 달성하여 `App.jsx`에서 UI 관련 로직에만 집중하게 돕습니다.

### 3.2 Backend (`server.js`)
Express 서버는 단순한 백엔드가 아닌, **API 프록시**이자 **다운로드 관리자** 역할을 수행합니다.
1.  **Google API Proxy (토큰 및 CORS 관리)**: 
    *   프론트엔드에서 구글 API를 직접 호출할 때 발생하는 CORS 및 인증서 문제를 해결합니다. `/api/create-session`, `/api/session-status`, `/api/fetch-items` 엔드포인트를 제공합니다.
2.  **2-Step Synchronization (지연 연동 엔진)**: 
    *   (1단계 - 정리 단계): 클라이언트가 사진 선택 시 1차적으로 메타데이터(ID, 상태값 등)만 가공하여 Supabase에 동기화(`is_synced = false`)시킵니다. 실제 원본 파일은 다운로드하지 않습니다.
    *   (2단계 - 최종 권한): 사용자가 최종 승인/저장 시 실제 구글 망을 타서 이미지를 확정적으로 불러옵니다.
3.  **Supabase DB Manager**: 
    *   로컬 JSON 대신 클라우드 RDBMS 환경으로 트랜잭션을 관리하여 동시성, 무결성을 보장합니다.

---

## 4. Key Workflows (핵심 동작 흐름)

### 4.1 Photo Sync & Permanent Archival Flow (사진 동기화 2단계 엔진)
가장 핵심적이고 정교한 기능인 '지능형 구글 포토 2단계 연동'의 프로세스입니다.

1.  **Session & Popup (팝업 열기)**:
    *   사용자가 '구글 포토 연동'을 클릭하여 OAuth Token을 발급받습니다.
    *   프론트엔드에서 `createPickerSession`을 요청 후, 반환된 `pickerUri`를 `window.open`으로 팝업을 띄웁니다.
2.  **Intelligent Polling & DB Registry (지능형 대기 및 1단계 등록)**:
    *   사용자가 구글 창에서 사진을 골라 [Done]을 누른 뒤 앱에서 가져오기를 수행합니다.
    *   세션 완료(COMPLETED) 응답 확인 시, 사진들의 메타데이터를 가져옵니다. 프론트엔드가 사용자에게 프롬프트 창을 띄워 추억의 이름(Theme)을 입력받습니다.
    *   해당 정보들은 Supabase DB에 메타데이터로만 저장되며(`is_synced: false`), UI 상에는 "인증시 보여짐"과 같은 임시 컴포넌트가 표기됩니다.
3.  **Final Authorization (2단계 최종 동기화)**:
    *   앨범 정리가 완료된 뒤 사용자가 최종 동기화 행동(트리거)을 취하면 구글 망을 거쳐 실제 이미지를 불러와 앨범 시스템을 확정(`is_synced: true`) 짓습니다.

### 4.2 Data Modification (데이터 가공)
*   **대표 사진 지정 (Cover Photo)**: `/api/set-cover` 함수를 호출하여 같은 테마 디렉토리 내에 있는 모든 `isCover` 속성을 초기화하고, 선택된 단 하나의 사진만 `true`로 설정. `useMemo` 기반 프론트엔드 연산 통해 폴더의 썸네일로 즉시 자동 배정됩니다.
*   **초기화 (Reset)**: 테스트 및 링크 오류 초기화를 위해 파일시스템 모듈(`fs`)을 호출하여 `data/images/` 내부 파일 및 DB(`photos.json`) 데이터를 한 번에 정리.

---

## 5. Security & Configuration (보안 및 설정)
*   **Client Abstraction**: 프론트엔드에는 Google Client ID 이외엔 API_KEY 같은 백엔드 전용 시크릿들이 노출되지 않아 클라이언트 측면의 구조적 안전성을 확보했습니다.
*   **Storage Integrity**: 외부 구글 사진 주소가 죽더라도(HTTP 500/403) 로컬 파일 시스템에는 원본 파일이 완전히 다운로딩 되어있어 치명적 데이터 소실을 방지합니다.
