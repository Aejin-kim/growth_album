# Growth Album 배포를 위한 Vercel & Render 가이드

백엔드 서버 위치가 환경에 따라 유동적으로 변할 수 있도록(`VITE_API_BASE_URL`) 코드를 업데이트했습니다. 추후 아래 가이드에 따라 배포를 진행하세요!

---

## 1. 전제 조건
이 프로젝트의 폴더 전체가 `GitHub`에 업로드되어 있어야 합니다.

## 2. 백엔드(서버) 배포하기: Render.com
현재 `server.js` 구글 OAuth 세션 발급과 이미지의 CORS 우회를 돕는 프록시 역할을 합니다. 무상으로 Node.js 서버를 띄울 수 있는 `Render` 플랫폼을 사용합니다.

1. **[Render.com](https://render.com/) 가입 및 로그인**
2. 대시보드 우측 상단 **[New]** -> **[Web Service]** 클릭.
3. GitHub 계정을 연동하고 본인의 `Growth Album` 레포지토리를 선택합니다.
4. **설정값 기입:**
   - Name: `growth-album-proxy` (자유롭게 입력)
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. **[Create Web Service]** 버튼을 누릅니다.
6. 배포가 완료되면 좌측 상단에 라이브 URL이 발급됩니다. (예: `https://growth-album-proxy.onrender.com`)
   - **이 주소의 뒤에 `/api`를 붙인 값을 어딘가에 꼭 복사해 둡니다.** (예: `https://growth-...onrender.com/api`)

---

## 3. 프론트엔드(화면) 배포하기: Vercel
웹 화면 즉, React(Vite) 애플리케이션을 Vercel에 올려서 최종 연결합니다.

1. **[Vercel.com](https://vercel.com/) 가입 및 로그인**
2. **[Add New...]** -> **[Project]** 클릭.
3. GitHub 목록에서 `Growth Album` 레포지토리의 **[Import]**를 클릭합니다.
4. **[Environment Variables] (환경 변수)** 항목을 펼친 후 `Add`를 눌러 아래 3가지를 추가합니다:
   - `VITE_SUPABASE_URL` = (본인의 Supabase URL)
   - `VITE_SUPABASE_ANON_KEY` = (본인의 Supabase Anon 퍼블릭 키)
   - `VITE_API_BASE_URL` = (위 2번에서 복사한 **Render 백엔드의 /api URL**)
5. **[Deploy]** 버튼을 누릅니다!

---

🎉 **배포 완료!**
Vercel에서 배포 완료 시 발급해 주는 메인 도메인(`https://xxx.vercel.app`) 주소로 모바일이나 노트북 어디에서든 자유롭게 접속할 수 있습니다. 메인 주소를 친구나 가족에게 공유해 함께 추억을 정리하세요!
