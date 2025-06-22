const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors()); // CORS 설정을 더 유연하게 변경
app.use(express.json());
app.use(express.static('public'));

// Render 환경인지 확인 (NODE_ENV가 'production'으로 설정됨)
const isProduction = process.env.NODE_ENV === 'production';
// Render의 영구 디스크 경로 또는 로컬 개발용 경로 설정
const dataDir = isProduction ? '/var/data/trip-journey' : path.join(__dirname, 'uploads');

console.log(`데이터 저장 경로: ${dataDir}`);
console.log(`서버 환경: ${isProduction ? 'Production (Render)' : 'Development (Local)'}`);

// 업로드 폴더 및 파일 경로 설정
const imagesDir = path.join(dataDir, 'images');
const dataFile = path.join(dataDir, 'photos.json');

// 필요한 디렉토리 및 파일 생성 (최초 실행 시)
fs.ensureDirSync(imagesDir);
if (!fs.existsSync(dataFile)) {
  fs.writeJsonSync(dataFile, []);
}

// 업로드된 이미지를 외부에서 접근할 수 있도록 static 미들웨어 설정
// 예: "https://<...>/uploads/images/photo.jpg"
app.use('/uploads', express.static(dataDir));

// 사진 데이터 초기화 및 마이그레이션
if (!fs.existsSync(dataFile)) {
  fs.writeJsonSync(dataFile, []);
} else {
  // --- 데이터 마이그레이션 로직 ---
  const photosData = fs.readJsonSync(dataFile);
  // 데이터가 있고, 첫 번째 항목에 path가 있고 images가 없다면 옛날 형식으로 간주
  if (photosData.length > 0 && photosData[0].path && !photosData[0].images) {
    console.log('구버전 데이터 감지. 새 버전으로 마이그레이션을 시작합니다...');
    
    const migratedData = photosData.map(photo => {
      // 각 사진을 '이미지 1개를 가진 게시글' 형태로 변환
      return {
        id: photo.id || Date.now(),
        title: photo.title || photo.originalName,
        location: photo.location || '',
        category: photo.category || '',
        season: photo.season || '',
        date: photo.date || photo.uploadDate || new Date().toISOString().split('T')[0],
        description: photo.description || '',
        uploadDate: photo.uploadDate || new Date().toISOString(),
        categories: photo.categories || [],
        images: [{
          filename: photo.filename,
          originalName: photo.originalName,
          path: photo.path
        }]
      };
    });
    
    // 변환된 데이터 저장
    fs.writeJsonSync(dataFile, migratedData, { spaces: 2 });
    console.log('✅ 데이터 마이그레이션 완료!');
  }
}

// Multer 설정 - 이미지 파일 업로드
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir); // 항상 imagesDir에 저장
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
    files: 10 // 최대 10개 파일
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다!'));
    }
  }
});

// 사진 데이터 읽기
function readPhotosData() {
  try {
    return fs.readJsonSync(dataFile);
  } catch (error) {
    console.error('사진 데이터 읽기 오류:', error);
    return [];
  }
}

// 사진 데이터 저장
function savePhotosData(photos) {
  try {
    fs.writeJsonSync(dataFile, photos, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('사진 데이터 저장 오류:', error);
    return false;
  }
}

// API 라우트

// 1. 모든 사진 조회
app.get('/api/photos', (req, res) => {
  try {
    const photos = readPhotosData();
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: '사진 목록을 불러오는데 실패했습니다.' });
  }
});

// 2. 사진 업로드
app.post('/api/photos', upload.array('photos', 10), (req, res) => {
  try {
    const { title, location, category, season, date, description } = req.body;
    const uploadedFiles = req.files;
    
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: '업로드할 사진이 없습니다.' });
    }

    const photos = readPhotosData();
    
    const newPost = {
      id: Date.now(),
      title: title || uploadedFiles[0].originalname.replace(/\.[^/.]+$/, ""),
      location: location || '',
      category: category || '',
      season: season || '',
      date: date || new Date().toISOString().split('T')[0],
      description: description || '',
      uploadDate: new Date().toISOString(),
      categories: category ? category.split('/').map(cat => cat.trim()).filter(Boolean) : [],
      images: uploadedFiles.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/images/${file.filename}`
      }))
    };

    // 데이터베이스에 추가
    photos.unshift(newPost);
    savePhotosData(photos);

    res.json({
      message: `${newPost.images.length}장의 사진이 성공적으로 업로드되었습니다.`,
      post: newPost
    });

  } catch (error) {
    console.error('업로드 오류:', error);
    res.status(500).json({ error: '사진 업로드에 실패했습니다.' });
  }
});

// 3. 사진 삭제
app.delete('/api/photos/:id', (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
    }
    
    const photos = readPhotosData();
    const postIndex = photos.findIndex(post => post.id === postId);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }

    const post = photos[postIndex];
    
    // 모든 이미지 파일 삭제
    if (post.images && Array.isArray(post.images)) {
      post.images.forEach(image => {
        if (image.filename) {
          const filePath = path.join(imagesDir, image.filename); // photos.json에 저장된 filename 사용
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`파일 삭제 성공: ${filePath}`);
          } else {
            console.warn(`삭제할 파일을 찾을 수 없음: ${filePath}`);
          }
        }
      });
    }

    // 데이터베이스(JSON 파일)에서 게시글 제거
    photos.splice(postIndex, 1);
    savePhotosData(photos);

    res.json({ message: '게시글이 성공적으로 삭제되었습니다.' });

  } catch (error) {
    console.error('삭제 오류:', error);
    res.status(500).json({ error: '게시글 삭제에 실패했습니다.' });
  }
});

// 4. 사진 수정
app.put('/api/photos/:id', (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { title, location, category, season, date, description } = req.body;
    
    const photos = readPhotosData();
    const postIndex = photos.findIndex(post => post.id === postId);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }

    // 사진 정보 업데이트
    photos[postIndex] = {
      ...photos[postIndex],
      title: title || photos[postIndex].title,
      location: location || photos[postIndex].location,
      category: category || photos[postIndex].category,
      season: season || photos[postIndex].season,
      date: date || photos[postIndex].date,
      description: description || photos[postIndex].description,
      categories: category ? category.split('/').map(cat => cat.trim()).filter(Boolean) : photos[postIndex].categories
    };

    savePhotosData(photos);
    res.json({ message: '게시글 정보가 업데이트되었습니다.', post: photos[postIndex] });

  } catch (error) {
    console.error('수정 오류:', error);
    res.status(500).json({ error: '게시글 수정에 실패했습니다.' });
  }
});

// 6. 서버 상태 확인
app.get('/api/status', (req, res) => {
  const photos = readPhotosData();
  const stats = fs.statSync(dataDir);
  
  res.json({
    status: 'running',
    totalPhotos: photos.length,
    uploadDir: dataDir,
    diskUsage: {
      total: stats.size,
      photos: photos.length
    }
  });
});

// 서버 관리자를 위한 안내 메시지
console.log('------------------------------------------');
console.log('⚠️  uploads/photos.json 및 uploads/images/는 깃허브에 올리지 마세요!');
console.log('⚠️  Render 등 서버에서만 데이터 파일을 관리하세요.');
console.log('⚠️  서버 재배포/재시작 전에는 반드시 데이터 백업을 권장합니다.');
console.log('------------------------------------------');

// 데이터 백업 엔드포인트 (관리자용)
app.get('/api/backup', (req, res) => {
  try {
    const backupFile = path.join(dataDir, `photos-backup-${Date.now()}.json`);
    fs.copyFileSync(dataFile, backupFile);
    res.json({ message: '백업이 성공적으로 생성되었습니다.', backupFile });
  } catch (error) {
    res.status(500).json({ error: '백업 생성에 실패했습니다.' });
  }
});

// 데이터 복원 엔드포인트 (관리자용)
app.post('/api/restore', express.json(), (req, res) => {
  try {
    const { backupFile } = req.body;
    if (!backupFile || !fs.existsSync(backupFile)) {
      return res.status(400).json({ error: '백업 파일이 존재하지 않습니다.' });
    }
    fs.copyFileSync(backupFile, dataFile);
    res.json({ message: '데이터가 성공적으로 복원되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '데이터 복원에 실패했습니다.' });
  }
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '파일 크기가 너무 큽니다. (최대 10MB)' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '업로드할 수 있는 파일 수를 초과했습니다. (최대 10개)' });
    }
  }
  
  console.error('서버 오류:', error);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 여행일지 서버가 포트 ${PORT}에서 실행 중입니다!`);
  console.log(`📁 업로드 디렉토리: ${dataDir}`);
  console.log(`🌐 서버 주소: http://localhost:${PORT}`);
  console.log(`📊 API 상태: http://localhost:${PORT}/api/status`);
}); 