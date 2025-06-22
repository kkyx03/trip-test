# 여행일지 | My Journey

여행 사진을 저장하고 관리하는 웹 애플리케이션입니다.

## 🚀 배포 정보

### 프론트엔드 (GitHub Pages)
- URL: https://kkyx03.github.io/trip-test/
- 기술: HTML, CSS, JavaScript
- 지도: Kakao Maps API

### 백엔드 (Render)
- URL: https://my-journey-backend.onrender.com
- 기술: Node.js, Express
- 기능: 파일 업로드, 이미지 저장, API 제공

## 📁 프로젝트 구조

```
My-Journey/
├── server.js              # Express 서버 (백엔드)
├── package.json           # Node.js 의존성
├── index.html             # GitHub Pages용 정적 파일
├── public/                # 정적 파일들
│   ├── style.css
│   ├── script.js
│   └── index.html
├── uploads/               # 업로드된 이미지들
│   ├── images/
│   └── photos.json
└── README.md
```

## 🔧 설치 및 실행

### 로컬 개발
```bash
npm install
npm start
```

### 배포
- 프론트엔드: GitHub Pages 자동 배포
- 백엔드: Render Web Service

## 🌟 주요 기능

- 📸 사진 업로드 (다중 파일 지원)
- 🗺️ 카카오맵 위치 표시
- 📂 카테고리별 분류
- 🔍 검색 및 필터링
- 👤 관리자 로그인
- 📱 반응형 디자인

## 🔑 API 엔드포인트

- `GET /api/photos` - 모든 사진 조회
- `POST /api/photos` - 사진 업로드
- `DELETE /api/photos/:id` - 사진 삭제
- `PUT /api/photos/:id` - 사진 정보 수정
- `GET /api/status` - 서버 상태 확인

## 🛠️ 기술 스택

### 프론트엔드
- HTML5, CSS3, JavaScript
- Font Awesome (아이콘)
- Kakao Maps API

### 백엔드
- Node.js
- Express.js
- Multer (파일 업로드)
- CORS
- fs-extra

## 📝 라이선스

MIT License 