// 전역 변수
let photos = [];
let currentFilter = 'all';
let isLoggedIn = false;
let locationMapping = {};
let map = null; // 카카오 지도 인스턴스

// API 기본 URL 설정 (로컬 개발과 배포 환경 자동 감지)
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const API_BASE_URL = isLocal ? "http://localhost:3000" : "https://trip-test.onrender.com";

console.log('현재 환경:', isLocal ? '로컬 개발' : '배포 환경');
console.log('API URL:', API_BASE_URL);

// 계절 매핑
const seasonNames = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울'
};

// DOM 요소들
const photoFeed = document.getElementById('photoFeed');
const uploadModal = document.getElementById('uploadModal');
const detailModal = document.getElementById('detailModal');
const loginModal = document.getElementById('loginModal');
const uploadForm = document.getElementById('uploadForm');
const loginForm = document.getElementById('loginForm');
const photoInput = document.getElementById('photoInput');
const previewContainer = document.getElementById('previewContainer');
const detailContent = document.getElementById('detailContent');
const mainCategoryTitle = document.getElementById('mainCategoryTitle');
const photoCountElement = document.getElementById('photoCount');
const filteredPhotoCount = document.getElementById('filteredPhotoCount');
const regionCategories = document.getElementById('regionCategories');
const placeCategories = document.getElementById('placeCategories');
const yearCategories = document.getElementById('yearCategories');
const loginBtn = document.getElementById('loginBtn');
const uploadBtn = document.getElementById('uploadBtn');
const logoutBtn = document.getElementById('logoutBtn');

// API 함수들
async function fetchPhotos() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/photos`);
    if (!response.ok) throw new Error('사진 목록을 불러오는데 실패했습니다.');
    return await response.json();
  } catch (error) {
    console.error('사진 목록 조회 오류:', error);
    showNotification('사진 목록을 불러오는데 실패했습니다.', 'error');
    return [];
  }
}

async function uploadPhotos(formData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/photos`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '업로드에 실패했습니다.');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('업로드 오류:', error);
    throw error;
  }
}

async function deletePhoto(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/photos/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '삭제에 실패했습니다.');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('삭제 오류:', error);
    throw error;
  }
}

async function updatePhoto(id, photoData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/photos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(photoData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '수정에 실패했습니다.');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('수정 오류:', error);
    throw error;
  }
}

// 사진 URL 생성 (항상 서버 전체 경로 사용)
function getPhotoUrl(photo) {
  // photo 객체나 filename이 없는 경우를 대비한 방어 코드
  if (!photo || !photo.filename) {
    console.warn('잘못된 사진 데이터입니다:', photo);
    return 'path/to/placeholder/image.jpg'; // 에러 시 보여줄 기본 이미지 경로
  }
  return `${API_BASE_URL}/uploads/images/${photo.filename}`;
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', async function () {
  await loadLocationMapping();
  await loadPhotos();
  setupEventListeners();
  renderCategoryMenu();
  updateCategoryDisplay();
  updateLoginUI();
  
  // 개발 테스트용: 로그인 상태 강제 활성화 (실제 배포 시 제거)
  isLoggedIn = true;
  updateLoginUI();
});

// 사진 데이터 로드 및 UI 갱신
async function loadPhotos() {
  photos = await fetchPhotos();
  renderCategoryMenu();
  updateCategoryDisplay();
  renderPhotoFeed();
}

// 카테고리 메뉴 렌더링 (실제 데이터 기반)
function renderCategoryMenu() {
  const regionCategories = document.getElementById('regionCategories');
  const placeCategories = document.getElementById('placeCategories');
  const yearCategories = document.getElementById('yearCategories');
  if (!regionCategories || !placeCategories || !yearCategories) return;

  // 실제 업로드된 사진에서만 지역/장소/연도 추출
  const usedRegions = new Set();
  const usedPlaces = new Set();
  const usedYears = new Set();
  (photos || []).forEach(photo => {
    if (photo.category) usedRegions.add(photo.category);
    if (photo.location) usedPlaces.add(photo.location);
    if (photo.date) {
      const year = photo.date.split('-')[0];
      if (year && year.length === 4) usedYears.add(year);
    }
  });

  // 전체 보기
  const totalCount = photos.length;
  regionCategories.innerHTML = `<li><a href="#" onclick="filterByCategory('all', this)" class="active">📸 모든 추억 (${totalCount})</a></li>`;

  // 지역별
  if (usedRegions.size === 0) {
    regionCategories.innerHTML += '<li class="empty-category"><span>📍 지역별 추억</span><small>첫 번째 사진을 업로드해보세요</small></li>';
  } else {
    regionCategories.innerHTML += '<li class="category-header"><span>📍 지역별 추억</span></li>';
    Array.from(usedRegions).sort().forEach(region => {
      const count = photos.filter(photo => photo.category === region).length;
      regionCategories.innerHTML += `<li><a href="#" onclick="filterByCategory('${region}', this)">${region} (${count})</a></li>`;
    });
  }

  // 장소별
  placeCategories.innerHTML = '';
  if (usedPlaces.size === 0) {
    placeCategories.innerHTML = '<li class="empty-category"><span>🏛️ 장소별 추억</span><small>사진을 업로드하면 장소가 표시됩니다</small></li>';
  } else {
    placeCategories.innerHTML = '<li class="category-header"><span>🏛️ 장소별 추억</span></li>';
    Array.from(usedPlaces).sort().forEach(place => {
      const count = photos.filter(photo => photo.location === place).length;
      placeCategories.innerHTML += `<li><a href="#" onclick="filterByCategory('${place}', this)">${place} (${count})</a></li>`;
    });
  }

  // 연도별
  yearCategories.innerHTML = '';
  if (usedYears.size === 0) {
    yearCategories.innerHTML = '<li class="empty-category"><span>📅 연도별 추억</span><small>날짜가 있는 사진을 업로드해보세요</small></li>';
  } else {
    yearCategories.innerHTML = '<li class="category-header"><span>📅 연도별 추억</span></li>';
    Array.from(usedYears).sort((a, b) => b - a).forEach(year => {
      const count = photos.filter(photo => photo.date && photo.date.startsWith(year)).length;
      yearCategories.innerHTML += `<li><a href="#" onclick="filterByCategory('${year}', this)">${year}년 (${count})</a></li>`;
    });
  }
}

// 카테고리 필터링 (사이드바 반응 추가)
function filterByCategory(category, el = null) {
  currentFilter = category;
  
  // 모든 카테고리 링크에서 active 클래스 제거
  document.querySelectorAll('.category-section a').forEach(link => link.classList.remove('active'));
  
  // 클릭된 링크에 active 클래스 추가
  if (el) el.classList.add('active');
  
  // 사이드바가 접혀있으면 자동으로 열기
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && sidebar.classList.contains('collapsed')) {
    sidebar.classList.remove('collapsed');
    showNotification('사이드바를 열었습니다.', 'info');
  }
  
  // 카테고리 표시 업데이트
  updateCategoryDisplay();
  
  // 사진 피드 다시 렌더링
  renderPhotoFeed();
}

// 카테고리 타이틀/개수 표시
function updateCategoryDisplay() {
  const mainCategoryTitle = document.getElementById('mainCategoryTitle');
  const mainPhotoCount = document.getElementById('mainPhotoCount');
  if (!mainCategoryTitle || !mainPhotoCount) return;
  
  const filteredPhotos = getFilteredPhotos();
  
  if (currentFilter === 'all') {
    mainCategoryTitle.textContent = '전체 추억';
  } else if (seasonNames[currentFilter]) {
    mainCategoryTitle.textContent = `${seasonNames[currentFilter]} 추억`;
  } else if (/^\d{4}$/.test(currentFilter)) {
    mainCategoryTitle.textContent = `${currentFilter}년 추억`;
  } else {
    mainCategoryTitle.textContent = `${currentFilter} 추억`;
  }
  
  mainPhotoCount.textContent = `${filteredPhotos.length}개`;
}

// 필터링된 사진 반환
function getFilteredPhotos() {
  if (currentFilter === 'all') return photos;
  
  return photos.filter(photo => {
    if (seasonNames[currentFilter]) {
      if (!photo.date) return false;
      const month = parseInt(photo.date.split('-')[1]);
      const season = getSeasonFromMonth(month);
      return season === currentFilter;
    } else if (/^\d{4}$/.test(currentFilter)) {
      return photo.date && photo.date.startsWith(currentFilter);
    } else {
      return photo.category === currentFilter || photo.location === currentFilter;
    }
  });
}

// 월을 계절로 변환
function getSeasonFromMonth(month) {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// 사진 피드 렌더링
function renderPhotoFeed() {
  const photoFeed = document.getElementById('photoFeed');
  if (!photoFeed) return;
  
  const filteredPhotos = getFilteredPhotos();
  
  if (filteredPhotos.length === 0) {
    photoFeed.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-camera"></i>
        <h3>아직 추억이 없습니다</h3>
        <p>첫 번째 추억을 추가해보세요!</p>
      </div>
    `;
    return;
  }
  
  photoFeed.innerHTML = filteredPhotos.map((photo, index) => `
    <div class="photo-card" onclick="openDetailModal(${index})">
      <div class="photo-image">
        <img src="${getPhotoUrl(photo)}" alt="${photo.location || '사진'}" loading="lazy" onload="this.style.opacity='1';" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div class="photo-error" style="display: none; text-align: center; padding: 20px; color: #999;">
          <i class="fas fa-image"></i>
          <p>이미지를 불러올 수 없습니다</p>
        </div>
      </div>
      <div class="photo-info">
        <h3>${photo.location || '제목 없음'}</h3>
        <p>${photo.description || ''}</p>
        <div class="photo-date">${photo.date || ''}</div>
      </div>
    </div>
  `).join('');
  
  // 이미지 로딩 완료 후 opacity 설정 (추가 안전장치)
  setTimeout(() => {
    document.querySelectorAll('.photo-image img').forEach(img => {
      if (img.complete) {
        img.style.opacity = '1';
      } else {
        img.onload = () => {
          img.style.opacity = '1';
        };
      }
    });
  }, 100);
}

// 이벤트 리스너 등록
function setupEventListeners() {
  // 사진 업로드 폼 제출 이벤트
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData();
      const imageFile = document.getElementById('imageFile').files[0];
      const location = document.getElementById('locationInput').value;
      const category = document.getElementById('categoryInput').value;
      const description = document.getElementById('descriptionInput').value;
      const date = document.getElementById('dateInput').value;
      
      if (!imageFile) {
        showNotification('사진을 선택해주세요.', 'error');
        return;
      }
      
      formData.append('image', imageFile);
      formData.append('location', location);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('date', date);
      
      // 환경에 따라 다른 업로드 방식 사용
      if (isLocal) {
        // 로컬 개발 환경: 서버 API 사용
        fetch('/upload', {
          method: 'POST',
          body: formData
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            showNotification('사진이 성공적으로 업로드되었습니다!', 'success');
            document.getElementById('uploadForm').reset();
            loadPhotos();
          } else {
            showNotification('업로드 실패: ' + data.message, 'error');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          showNotification('업로드 중 오류가 발생했습니다.', 'error');
        });
      } else {
        // 깃허브 Pages 환경: 서버 API 사용
        fetch(`${API_BASE_URL}/api/photos`, {
          method: 'POST',
          body: formData
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            showNotification('사진이 성공적으로 업로드되었습니다!', 'success');
            document.getElementById('uploadForm').reset();
            closeUploadModal();
            loadPhotos();
          } else {
            showNotification('업로드 실패: ' + (data.error || '알 수 없는 오류'), 'error');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          showNotification('업로드 중 오류가 발생했습니다.', 'error');
        });
      }
    });
  }
  
  // 로그인 폼 제출 이벤트
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
  
  // 장소 입력 필드에 실시간 이벤트 리스너 추가
  const locationInput = document.getElementById('locationInput');
  if (locationInput) {
    locationInput.addEventListener('input', handleLocationInput);
  }
  
  // 모달 닫기 이벤트
  window.addEventListener('click', e => {
    const uploadModal = document.getElementById('uploadModal');
    const detailModal = document.getElementById('detailModal');
    const loginModal = document.getElementById('loginModal');
    
    if (e.target === uploadModal) closeUploadModal();
    if (e.target === detailModal) closeDetailModal();
    if (e.target === loginModal) closeLoginModal();
  });
  
  // ESC 키로 모달 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeUploadModal();
      closeDetailModal();
      closeLoginModal();
    }
  });
}

function openDetailModal(index) {
  const detailModal = document.getElementById('detailModal');
  const detailContent = document.getElementById('detailContent');
  
  if (!detailModal || !detailContent) return;
  
  const filteredPhotos = getFilteredPhotos();
  const photo = filteredPhotos[index];
  
  if (!photo) return;
  
  detailContent.innerHTML = `
    <div class="detail-image">
      <img src="${getPhotoUrl(photo)}" alt="${photo.location || '사진'}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div class="detail-error" style="display: none; text-align: center; padding: 40px; color: #999;">
        <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h3>이미지를 불러올 수 없습니다</h3>
        <p>파일이 존재하지 않거나 경로가 잘못되었습니다.</p>
      </div>
    </div>
    <div class="detail-info">
      <h3 class="detail-title">${photo.location || '제목 없음'}</h3>
      <div class="detail-meta">
        <span class="detail-category">${photo.category || ''}</span>
        <span class="detail-date">${photo.date || ''}</span>
      </div>
      <p class="detail-description">${photo.description || ''}</p>
      <div class="detail-actions">
        <button class="show-map-btn" onclick="showMap('${photo.location}')">
          <i class="fas fa-map-marker-alt"></i> 지도 보기
        </button>
        ${isLoggedIn ? `
          <div class="detail-options">
            <button class="option-toggle-btn" onclick="toggleDetailOptions(event)">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="option-dropdown" style="display: none;">
              <button onclick="handleModifyPhoto('${photo._id}')">수정</button>
              <button onclick="handleDeletePhoto('${photo._id}')">삭제</button>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  detailModal.classList.add('active');
}

function toggleDetailOptions(e) {
  e.stopPropagation();
  const dropdown = e.target.closest('.detail-options').querySelector('.option-dropdown');
  const isVisible = dropdown.style.display !== 'none';
  
  dropdown.style.display = isVisible ? 'none' : 'block';
  
  document.addEventListener('click', function closeDropdown(ev) {
    if (!ev.target.closest('.detail-options')) {
      dropdown.style.display = 'none';
      document.removeEventListener('click', closeDropdown);
    }
  });
}

function closeDetailModal() {
  const detailModal = document.getElementById('detailModal');
  if (detailModal) {
    detailModal.classList.remove('active');
  }
  closeMap();
}

function openUploadModal() {
  const uploadModal = document.getElementById('uploadModal');
  if (uploadModal) {
    uploadModal.classList.add('active');
  }
}

function closeUploadModal() {
  const uploadModal = document.getElementById('uploadModal');
  if (uploadModal) {
    uploadModal.classList.remove('active');
  }
  resetForm();
}

function resetForm() {
  document.getElementById('uploadForm').reset();
}

async function handleDeletePhoto(id) {
  if (!confirm('정말로 이 사진을 삭제하시겠습니까?')) return;
  
  try {
    showNotification('사진을 삭제하는 중입니다...', 'info');
    await deletePhoto(id);
    showNotification('사진이 성공적으로 삭제되었습니다.', 'success');
    closeDetailModal();
    loadPhotos();
  } catch (error) {
    showNotification('삭제 중 오류가 발생했습니다: ' + error.message, 'error');
  }
}

async function handleModifyPhoto(id) {
  const photo = photos.find(p => p._id === id);
  if (!photo) {
    showNotification('수정할 사진을 찾을 수 없습니다.', 'error');
    return;
  }
  
  // 업로드 폼에 기존 데이터 채우기
  document.getElementById('locationInput').value = photo.location || '';
  document.getElementById('categoryInput').value = photo.category || '';
  document.getElementById('descriptionInput').value = photo.description || '';
  document.getElementById('dateInput').value = photo.date || '';
  
  // 수정 모드로 설정
  const uploadForm = document.getElementById('uploadForm');
  uploadForm.setAttribute('data-edit-id', id);
  
  // 모달 제목 변경
  const modalTitle = document.querySelector('#uploadModal .modal-header h2');
  if (modalTitle) {
    modalTitle.textContent = '사진 수정';
  }
  
  // 버튼 텍스트 변경
  const submitBtn = document.querySelector('#uploadForm .btn-primary');
  if (submitBtn) {
    submitBtn.textContent = '수정 완료';
  }
  
  closeDetailModal();
  openUploadModal();
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// 로그인 처리
async function handleLoginSubmit(e) {
  e.preventDefault();
  
  const username = document.getElementById('usernameInput').value;
  const password = document.getElementById('passwordInput').value;
  
  if (username === 'admin' && password === 'admin123') {
    isLoggedIn = true;
    updateLoginUI();
    closeLoginModal();
    showNotification('로그인 성공!', 'success');
  } else {
    showNotification('잘못된 로그인 정보입니다.', 'error');
  }
}

// 로그아웃
function logout() {
  isLoggedIn = false;
  updateLoginUI();
  showNotification('로그아웃되었습니다.', 'info');
}

// 로그인 UI 업데이트
function updateLoginUI() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  
  if (isLoggedIn) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'block';
    if (uploadBtn) uploadBtn.style.display = 'block';
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (uploadBtn) uploadBtn.style.display = 'none';
  }
}

// 로그인 모달
function openLoginModal() {
  const loginModal = document.getElementById('loginModal');
  if (loginModal) {
    loginModal.classList.add('active');
  }
}

function closeLoginModal() {
  const loginModal = document.getElementById('loginModal');
  if (loginModal) {
    loginModal.classList.remove('active');
  }
  resetLoginForm();
}

function resetLoginForm() {
  document.getElementById('loginForm').reset();
}

// 사이드바 토글
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
  }
}

function toggleCategoryMenu() {
  const categoryMenu = document.querySelector('.category-menu');
  if (categoryMenu) {
    categoryMenu.classList.toggle('collapsed');
  }
}

// 슬라이더 관련 함수들
function nextSlide() {
  const slider = document.querySelector('.photo-slider');
  if (slider) {
    const currentIndex = parseInt(slider.dataset.currentIndex || 0);
    const totalSlides = slider.querySelectorAll('.slider-image').length;
    const nextIndex = (currentIndex + 1) % totalSlides;
    goToSlide(nextIndex);
  }
}

function prevSlide() {
  const slider = document.querySelector('.photo-slider');
  if (slider) {
    const currentIndex = parseInt(slider.dataset.currentIndex || 0);
    const totalSlides = slider.querySelectorAll('.slider-image').length;
    const prevIndex = (currentIndex - 1 + totalSlides) % totalSlides;
    goToSlide(prevIndex);
  }
}

function goToSlide(index) {
  const slider = document.querySelector('.photo-slider');
  if (slider) {
    slider.dataset.currentIndex = index;
    updateSlider();
  }
}

function updateSlider() {
  const slider = document.querySelector('.photo-slider');
  if (!slider) return;
  
  const currentIndex = parseInt(slider.dataset.currentIndex || 0);
  const images = slider.querySelectorAll('.slider-image');
  const dots = slider.querySelectorAll('.slider-dot');
  
  images.forEach((img, i) => {
    img.style.display = i === currentIndex ? 'block' : 'none';
  });
  
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });
}

// 지도 관련 함수들

// 카카오 지도 로드 확인
function isKakaoLoaded() {
  return typeof kakao !== 'undefined' && kakao.maps;
}

// 지도 초기화
function initMap() {
  if (!isKakaoLoaded()) {
    console.error('카카오 지도 API가 로드되지 않았습니다.');
    return;
  }
  
  const mapContainer = document.getElementById('map');
  if (!mapContainer) {
    console.error('지도 컨테이너를 찾을 수 없습니다.');
    return;
  }
  
  const mapOption = {
    center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청
    level: 3
  };
  
  map = new kakao.maps.Map(mapContainer, mapOption);
  console.log('지도가 초기화되었습니다.');
}

// 지도에 위치 표시 (CSV 좌표 우선, 없으면 자동 검색)
function showMap(locationName) {
  if (!isKakaoLoaded()) {
    showNotification('카카오 지도 API가 로드되지 않았습니다.', 'error');
    return;
  }
  
  // 지도 컨테이너 표시
  const mapContainer = document.getElementById('detailMapContainer');
  if (mapContainer) {
    mapContainer.style.display = 'block';
  }
  
  // 지도 초기화 (필요시)
  if (!map) {
    initMap();
  }
  
  // CSV에서 좌표 확인
  const locationInfo = findLocationInfo(locationName);
  
  if (locationInfo && locationInfo.lat && locationInfo.lng) {
    // ✅ CSV에 좌표가 있으면 바로 이동
    moveToPosition(locationInfo.lat, locationInfo.lng, locationName);
  } else {
    // ❌ 좌표가 없으면 자동 검색
    showKakaoMap(locationName);
  }
}

// 좌표로 지도 이동
function moveToPosition(lat, lng, locationName) {
  if (!map) {
    console.error('지도가 초기화되지 않았습니다.');
    return;
  }
  
  if (!lat || !lng) {
    console.warn('유효한 좌표가 없어 지도 이동 불가');
    showNotification('유효한 좌표가 없습니다.', 'warning');
    return;
  }
  
  try {
    const center = new kakao.maps.LatLng(parseFloat(lat), parseFloat(lng));
    map.setCenter(center);
    
    // 마커 추가
    const marker = new kakao.maps.Marker({
      position: center
    });
    marker.setMap(map);
    
    // 지도 정보 업데이트
    updateMapInfo(locationName, `${lat}, ${lng}`);
    
    console.log(`지도가 ${locationName} (${lat}, ${lng})로 이동했습니다.`);
  } catch (error) {
    console.error('지도 이동 중 오류:', error);
    showNotification('지도 이동 중 오류가 발생했습니다.', 'error');
  }
}

// 카카오 API로 주소 검색 후 지도 이동
function showKakaoMap(locationName) {
  if (!isKakaoLoaded()) {
    showNotification('카카오 지도 API가 로드되지 않았습니다.', 'error');
    return;
  }
  
  if (!map) {
    initMap();
  }
  
  showNotification(`'${locationName}' 위치를 검색하는 중입니다...`, 'info');
  
  const geocoder = new kakao.maps.services.Geocoder();
  
  geocoder.addressSearch(locationName, function(result, status) {
    if (status === kakao.maps.services.Status.OK) {
      const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
      
      // 지도 이동
      map.setCenter(coords);
      
      // 마커 추가
      const marker = new kakao.maps.Marker({
        position: coords
      });
      marker.setMap(map);
      
      // 주소 정보
      const address = result[0].address_name;
      const roadAddress = result[0].road_address ? result[0].road_address.address_name : '';
      
      // 지도 정보 업데이트
      updateMapInfo(locationName, address, roadAddress);
      
      // ✅ 검색 성공 시 locationMapping에 추가 (메모리)
      if (!locationMapping[locationName]) {
        locationMapping[locationName] = {
          region: extractRegionFromAddress(address),
          province: extractRegionFromAddress(address),
          address: address,
          lat: result[0].y,
          lng: result[0].x
        };
        console.log('새로운 위치가 매핑에 추가됨:', locationName, locationMapping[locationName]);
      }
      
      showNotification(`'${locationName}' 위치를 찾았습니다!`, 'success');
      
    } else {
      // ❌ 주소 검색 실패 시 예외 처리
      console.warn(`주소 검색 실패: ${locationName}`, status);
      showNotification(`'${locationName}'의 위치를 찾을 수 없습니다.`, 'error');
      
      // 대체 지도 표시
      showAlternativeMap(locationName);
    }
  });
}

// 지도 정보 업데이트
function updateMapInfo(locationName, address, roadAddress = '') {
  const mapInfo = document.getElementById('mapInfo');
  if (mapInfo) {
    mapInfo.innerHTML = `
      <div class="address"><strong>${locationName}</strong></div>
      <div class="road-address">${address}</div>
      ${roadAddress ? `<div class="road-address">${roadAddress}</div>` : ''}
    `;
  }
}

// 대체 지도 표시 (검색 실패 시)
function showAlternativeMap(locationName) {
  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    mapContainer.innerHTML = `
      <div class="alternative-map-container">
        <i class="fas fa-map-marker-alt" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
        <h3>지도를 불러올 수 없습니다</h3>
        <p>입력된 위치: ${locationName}</p>
        <p>다른 키워드로 다시 시도해보세요.</p>
      </div>
    `;
  }
  
  const mapInfo = document.getElementById('mapInfo');
  if (mapInfo) {
    mapInfo.innerHTML = `
      <div class="address">위치를 찾을 수 없습니다</div>
      <div class="road-address">입력된 위치: ${locationName}</div>
    `;
  }
}

// 지도 닫기
function closeMap() {
  const mapContainer = document.getElementById('detailMapContainer');
  if (mapContainer) {
    mapContainer.style.display = 'none';
  }
  
  // 지도 초기화
  if (map) {
    map = null;
  }
}

// CSV 로딩 및 장소 매핑
async function loadLocationMapping() {
  try {
    console.log('장소 매핑 데이터 로딩 시작...');
    
    // 여러 경로에서 CSV 파일 시도
    const csvPaths = [
      '/data/location_mapping.csv',
      './data/location_mapping.csv',
      '../data/location_mapping.csv',
      'data/location_mapping.csv'
    ];
    
    let csvData = null;
    let loadedPath = null;
    
    for (const path of csvPaths) {
      try {
        console.log(`CSV 파일 로딩 시도: ${path}`);
        const response = await fetch(path);
        
        if (response.ok) {
          csvData = await response.text();
          loadedPath = path;
          console.log(`✅ CSV 파일 로딩 성공: ${path}`);
          break;
        } else {
          console.log(`❌ CSV 파일 로딩 실패: ${path} (${response.status})`);
        }
      } catch (error) {
        console.log(`❌ CSV 파일 로딩 오류: ${path}`, error);
      }
    }
    
    if (!csvData) {
      console.warn('⚠️ 모든 CSV 경로에서 로딩 실패, 빈 매핑으로 시작');
      locationMapping = {};
      return;
    }
    
    // CSV 파싱
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    console.log('CSV 헤더:', headers);
    
    locationMapping = {};
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      if (values.length < headers.length) continue;
      
      const locationName = values[0];
      const region = values[1] || '';
      const province = values[2] || '';
      const lat = values[3] || '';
      const lng = values[4] || '';
      
      locationMapping[locationName] = {
        region,
        province,
        lat,
        lng
      };
    }
    
    console.log(`✅ 장소 매핑 로딩 완료: ${Object.keys(locationMapping).length}개 항목`);
    console.log('로딩된 매핑:', locationMapping);
    
  } catch (error) {
    console.error('장소 매핑 로딩 오류:', error);
    locationMapping = {};
  }
}

// 장소 정보 찾기
function findLocationInfo(locationName) {
  if (!locationName || !locationMapping) return null;
  
  // 정확한 매칭
  if (locationMapping[locationName]) {
    return locationMapping[locationName];
  }
  
  // 부분 매칭 (대소문자 무시)
  const lowerLocationName = locationName.toLowerCase();
  for (const [key, value] of Object.entries(locationMapping)) {
    if (key.toLowerCase().includes(lowerLocationName) || 
        lowerLocationName.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return null;
}

// 장소 입력 시 실시간 카테고리 미리보기
function handleLocationInput(e) {
  const location = e.target.value.trim();
  const categoryInput = document.getElementById('categoryInput');
  
  if (!location) {
    categoryInput.placeholder = '예: 서울, 부산, 강릉';
    return;
  }
  
  // 기존 CSV 매핑 확인
  const locationInfo = findLocationInfo(location);
  if (locationInfo) {
    categoryInput.placeholder = `자동 매핑: ${locationInfo.region}`;
    return;
  }
  
  // 새로운 장소인 경우 Kakao 지도 검색으로 자동 매핑
  if (isKakaoLoaded()) {
    searchAndMapLocation(location);
  } else {
    categoryInput.placeholder = '카카오맵 로딩 중...';
  }
}

// Kakao 지도 검색으로 장소 자동 매핑
function searchAndMapLocation(locationName) {
  if (!locationName || !isKakaoLoaded()) return;
  
  const categoryInput = document.getElementById('categoryInput');
  categoryInput.placeholder = '검색 중...';
  
  const geocoder = new kakao.maps.services.Geocoder();
  
  geocoder.addressSearch(locationName, function(result, status) {
    if (status === kakao.maps.services.Status.OK) {
      const address = result[0].address_name;
      const region = extractRegionFromAddress(address);
      
      if (region) {
        // 새로운 장소를 locationMapping에 추가
        if (!locationMapping[locationName]) {
          locationMapping[locationName] = {
            region: region,
            province: region,
            address: address,
            lat: result[0].y,
            lng: result[0].x
          };
          
          console.log('새로운 장소 자동 매핑됨:', locationName, locationMapping[locationName]);
          
          // 카테고리 메뉴 새로고침 (사이드바 업데이트)
          renderCategoryMenu();
          
          // 카테고리 입력 필드에 자동 입력
          categoryInput.value = region;
          categoryInput.placeholder = `자동 매핑: ${region}`;
          
          showNotification(`"${locationName}"이(가) ${region} 지역으로 매핑되었습니다!`, 'success');
        } else {
          // 이미 등록된 장소
          categoryInput.value = locationMapping[locationName].region;
          categoryInput.placeholder = `기존 매핑: ${locationMapping[locationName].region}`;
        }
      } else {
        categoryInput.placeholder = '지역을 찾을 수 없습니다';
        showNotification('주소에서 지역을 추출할 수 없습니다.', 'warning');
      }
    } else {
      categoryInput.placeholder = '장소를 찾을 수 없습니다';
      showNotification('장소를 찾을 수 없습니다. 다른 키워드로 시도해보세요.', 'warning');
    }
  });
}

// 주소에서 지역 추출
function extractRegionFromAddress(addressName) {
  if (!addressName) return null;
  
  // 한국 주요 도시/지역 매핑
  const regionMapping = {
    '서울': '서울',
    '부산': '부산',
    '대구': '대구',
    '인천': '인천',
    '광주': '광주',
    '대전': '대전',
    '울산': '울산',
    '세종': '세종',
    '강릉': '강원도',
    '춘천': '강원도',
    '속초': '강원도',
    '영월': '강원도',
    '평창': '강원도',
    '홍천': '강원도',
    '양양': '강원도',
    '원주': '강원도',
    '수원': '경기도',
    '성남': '경기도',
    '용인': '경기도',
    '부천': '경기도',
    '안산': '경기도',
    '안양': '경기도',
    '평택': '경기도',
    '시흥': '경기도',
    '김포': '경기도',
    '하남': '경기도',
    '이천': '경기도',
    '안성': '경기도',
    '광주': '경기도',
    '여주': '경기도',
    '양평': '경기도',
    '고양': '경기도',
    '과천': '경기도',
    '구리': '경기도',
    '남양주': '경기도',
    '오산': '경기도',
    '의왕': '경기도',
    '의정부': '경기도',
    '파주': '경기도',
    '포천': '경기도',
    '가평': '경기도',
    '연천': '경기도',
    '천안': '충청남도',
    '공주': '충청남도',
    '보령': '충청남도',
    '아산': '충청남도',
    '서산': '충청남도',
    '논산': '충청남도',
    '계룡': '충청남도',
    '당진': '충청남도',
    '금산': '충청남도',
    '부여': '충청남도',
    '서천': '충청남도',
    '청양': '충청남도',
    '홍성': '충청남도',
    '예산': '충청남도',
    '태안': '충청남도',
    '청주': '충청북도',
    '충주': '충청북도',
    '제천': '충청북도',
    '보은': '충청북도',
    '옥천': '충청북도',
    '영동': '충청북도',
    '증평': '충청북도',
    '진천': '충청북도',
    '괴산': '충청북도',
    '음성': '충청북도',
    '단양': '충청북도',
    '전주': '전라북도',
    '군산': '전라북도',
    '익산': '전라북도',
    '정읍': '전라북도',
    '남원': '전라북도',
    '김제': '전라북도',
    '완주': '전라북도',
    '진안': '전라북도',
    '무주': '전라북도',
    '장수': '전라북도',
    '임실': '전라북도',
    '순창': '전라북도',
    '고창': '전라북도',
    '부안': '전라북도',
    '광주': '전라남도',
    '목포': '전라남도',
    '여수': '전라남도',
    '순천': '전라남도',
    '나주': '전라남도',
    '광양': '전라남도',
    '담양': '전라남도',
    '곡성': '전라남도',
    '구례': '전라남도',
    '고흥': '전라남도',
    '보성': '전라남도',
    '화순': '전라남도',
    '장흥': '전라남도',
    '강진': '전라남도',
    '해남': '전라남도',
    '영암': '전라남도',
    '무안': '전라남도',
    '함평': '전라남도',
    '영광': '전라남도',
    '장성': '전라남도',
    '완도': '전라남도',
    '진도': '전라남도',
    '신안': '전라남도',
    '포항': '경상북도',
    '경주': '경상북도',
    '김천': '경상북도',
    '안동': '경상북도',
    '구미': '경상북도',
    '영주': '경상북도',
    '영천': '경상북도',
    '상주': '경상북도',
    '문경': '경상북도',
    '경산': '경상북도',
    '군위': '경상북도',
    '의성': '경상북도',
    '청송': '경상북도',
    '영양': '경상북도',
    '영덕': '경상북도',
    '청도': '경상북도',
    '고령': '경상북도',
    '성주': '경상북도',
    '칠곡': '경상북도',
    '예천': '경상북도',
    '봉화': '경상북도',
    '울진': '경상북도',
    '울릉': '경상북도',
    '창원': '경상남도',
    '마산': '경상남도',
    '진주': '경상남도',
    '통영': '경상남도',
    '사천': '경상남도',
    '김해': '경상남도',
    '밀양': '경상남도',
    '거제': '경상남도',
    '양산': '경상남도',
    '의령': '경상남도',
    '함안': '경상남도',
    '창녕': '경상남도',
    '고성': '경상남도',
    '남해': '경상남도',
    '하동': '경상남도',
    '산청': '경상남도',
    '함양': '경상남도',
    '거창': '경상남도',
    '합천': '경상남도',
    '제주': '제주도',
    '서귀포': '제주도'
  };
  
  // 주소에서 지역명 찾기
  for (const [city, region] of Object.entries(regionMapping)) {
    if (addressName.includes(city)) {
      return region;
    }
  }
  
  // 시/도 단위로 찾기
  const provinces = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시'];
  const cities = ['강원도', '경기도', '충청남도', '충청북도', '전라남도', '전라북도', '경상남도', '경상북도', '제주특별자치도'];
  
  for (const province of provinces) {
    if (addressName.includes(province)) {
      return province.replace('특별시', '').replace('광역시', '');
    }
  }
  
  for (const city of cities) {
    if (addressName.includes(city)) {
      return city;
    }
  }
  
  return null;
}

// 전역 함수로 노출 (HTML에서 호출하기 위해)
window.showMap = showMap;
window.closeMap = closeMap;
window.filterByCategory = filterByCategory;
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.toggleCategoryMenu = toggleCategoryMenu;
window.handleDeletePhoto = handleDeletePhoto;
window.handleModifyPhoto = handleModifyPhoto;
window.toggleDetailOptions = toggleDetailOptions;
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.goToSlide = goToSlide;

