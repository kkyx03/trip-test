// 전역 변수 및 상수
let photos = [];
let allPhotos = [];
let currentFilter = 'all';
let isLoggedIn = false;
let locationMapping = {};
let map; // 카카오 지도 인스턴스

const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const API_BASE_URL = isLocal ? "http://localhost:3000" : "https://trip-test.onrender.com";

const seasonNames = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };

// DOM 요소 캐싱
const DOMElements = {
    photoFeed: document.getElementById('photoFeed'),
    uploadModal: document.getElementById('uploadModal'),
    detailModal: document.getElementById('detailModal'),
    loginModal: document.getElementById('loginModal'),
    uploadForm: document.getElementById('uploadForm'),
    loginForm: document.getElementById('loginForm'),
    photoInput: document.getElementById('photoInput'),
    previewContainer: document.getElementById('previewContainer'),
    detailContent: document.getElementById('detailContent'),
    mainCategoryTitle: document.getElementById('mainCategoryTitle'),
    photoCount: document.getElementById('photoCount'),
    mainPhotoCount: document.getElementById('mainPhotoCount'),
    regionCategories: document.getElementById('regionCategories'),
    placeCategories: document.getElementById('placeCategories'),
    yearCategories: document.getElementById('yearCategories'),
    loginBtn: document.getElementById('loginBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    sidebar: document.getElementById('sidebar'),
    categoryMenu: document.getElementById('categoryMenu'),
    detailMapContainer: document.getElementById('detailMapContainer'),
    mapContainer: document.getElementById('map'),
    mapInfo: document.getElementById('mapInfo'),
};

// --- 초기화 ---
window.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    setupEventListeners();
    await loadLocationMapping();
    await loadPhotos();
    updateLoginUI();
}

// --- 이벤트 리스너 ---
function setupEventListeners() {
    DOMElements.loginForm.addEventListener('submit', handleLoginSubmit);
    DOMElements.uploadForm.addEventListener('submit', handleUploadSubmit);
    DOMElements.photoInput.addEventListener('change', handlePhotoPreview);

    document.addEventListener('click', (e) => {
        if (e.target.closest('.close-btn') || e.target.closest('.cancel-btn')) {
            closeAllModals();
        }
        // 드롭다운 외부 클릭 시 닫기
        if (!e.target.closest('.detail-options')) {
            document.querySelectorAll('.option-dropdown').forEach(d => d.style.display = 'none');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });
}

// --- API 호출 ---
async function fetchPhotos() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/photos`);
        if (!response.ok) throw new Error('사진 목록을 불러오는데 실패했습니다.');
        return await response.json();
    } catch (error) {
        console.error('사진 목록 조회 오류:', error);
        showNotification(error.message, 'error');
        return [];
    }
}

async function uploadRequest(formData, id = null) {
    const url = id ? `${API_BASE_URL}/api/photos/${id}` : `${API_BASE_URL}/api/photos`;
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, { method, body: formData });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '요청에 실패했습니다.');
        }
        return await response.json();
    } catch (error) {
        console.error('업로드/수정 오류:', error);
        throw error;
    }
}

async function deletePhotoAPI(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/photos/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '삭제에 실패했습니다.');
        }
        return await response.json();
    } catch (error) {
        console.error('삭제 오류:', error);
        throw error;
    }
}

// --- 데이터 관리 ---
async function loadPhotos() {
    allPhotos = await fetchPhotos();
    photos = [...allPhotos]; // 표시될 사진 목록 (필터링됨)
    renderAll();
}

function renderAll() {
    renderCategoryMenu();
    renderPhotoFeed();
    updateMainHeader();
    updateSidebarHeader();
}

function getFilteredPhotos() {
    if (currentFilter === 'all') return allPhotos;
    if (seasonNames[currentFilter]) {
        return allPhotos.filter(p => p.season === currentFilter);
    }
    if (/^\d{4}$/.test(currentFilter)) {
        return allPhotos.filter(p => p.date && p.date.startsWith(currentFilter));
    }
    return allPhotos.filter(p => p.category === currentFilter || p.location === currentFilter);
}

// --- 렌더링 ---
function renderPhotoFeed() {
    photos = getFilteredPhotos();
    DOMElements.photoFeed.innerHTML = '';
    if (photos.length === 0) {
        DOMElements.photoFeed.innerHTML = '<p class="empty-feed">표시할 사진이 없습니다.</p>';
        return;
    }
    photos.forEach((photo, index) => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.innerHTML = `
            <img src="${getPhotoUrl(photo)}" alt="${photo.title || photo.filename}" loading="lazy" onload="this.style.opacity=1;" onclick="openDetailModal(${index})">
            <div class="photo-info" onclick="openDetailModal(${index})">
                <h3>${photo.title || photo.filename}</h3>
                <p>${photo.location || '장소 정보 없음'}</p>
            </div>
        `;
        DOMElements.photoFeed.appendChild(card);
    });
}

function renderCategoryMenu() {
    const regions = new Set(allPhotos.map(p => p.category).filter(Boolean));
    const places = new Set(allPhotos.map(p => p.location).filter(Boolean));
    const years = new Set(allPhotos.map(p => p.date ? p.date.split('-')[0] : null).filter(Boolean));

    const renderList = (element, items, type) => {
        let html = '';
        if (items.size === 0) {
            html = `<li class="empty-category"><span>${type}별 추억</span><small>관련 사진이 없습니다</small></li>`;
        } else {
            items.forEach(item => {
                const count = allPhotos.filter(p => {
                    if (type === '지역') return p.category === item;
                    if (type === '장소') return p.location === item;
                    if (type === '연도') return p.date && p.date.startsWith(item);
                    return false;
                }).length;
                const name = type === '연도' ? `${item}년` : item;
                html += `<li><a href="#" onclick="filterByCategory('${item}', this)">${name} (${count})</a></li>`;
            });
        }
        element.innerHTML = html;
    };
    
    DOMElements.regionCategories.innerHTML = `<li><a href="#" onclick="filterByCategory('all', this)" class="active">�� 모든 추억 (${allPhotos.length})</a></li>`;
    renderList(DOMElements.regionCategories, regions, '지역');
    renderList(DOMElements.placeCategories, places, '장소');
    renderList(DOMElements.yearCategories, years, '연도');
}

function updateMainHeader() {
    let title = '전체 추억';
    if (currentFilter !== 'all') {
        title = seasonNames[currentFilter] || `${currentFilter.match(/^\d{4}$/) ? currentFilter + '년' : currentFilter} 추억`;
    }
    DOMElements.mainCategoryTitle.textContent = title;
    DOMElements.mainPhotoCount.textContent = `${photos.length}개`;
}

function updateSidebarHeader() {
    DOMElements.photoCount.textContent = `${allPhotos.length}개의 추억`;
}

// --- UI 상호작용 ---
function filterByCategory(category, el = null) {
    currentFilter = category;
    document.querySelectorAll('.category-list a').forEach(link => link.classList.remove('active'));
    if (el) el.classList.add('active');
    
    if (DOMElements.categoryMenu.classList.contains('collapsed')) {
        toggleCategoryMenu();
    }
    
    renderAll();
}

function toggleCategoryMenu() {
    DOMElements.categoryMenu.classList.toggle('collapsed');
    const icon = document.querySelector('.sidebar-toggle i');
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
}

function toggleCategory(category) {
    const element = document.getElementById(`${category}Categories`).parentElement;
    element.classList.toggle('open');
    const icon = element.querySelector('.toggle-icon');
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
}

function getPhotoUrl(photo) {
    if (!photo || !photo.filename) return '';
    return `${API_BASE_URL}/uploads/images/${photo.filename}`;
}

// --- 모달 ---
function openDetailModal(index) {
    const photo = photos[index];
    if (!photo) return;

    DOMElements.detailContent.innerHTML = `
        <div class="detail-image-container">
            <img src="${getPhotoUrl(photo)}" alt="${photo.title || photo.filename}" class="detail-image" onload="this.style.opacity=1">
        </div>
        <div class="detail-info">
            <h3 class="detail-title">${photo.title || '제목 없음'}</h3>
            <div class="detail-meta">
                <span class="detail-category"><i class="fas fa-tag"></i> ${photo.category || '미분류'}</span>
                <span class="detail-location"><i class="fas fa-map-marker-alt"></i> ${photo.location || '장소 없음'}</span>
                <span class="detail-date"><i class="fas fa-calendar-alt"></i> ${photo.date || '날짜 없음'}</span>
            </div>
            <p class="detail-description">${photo.description || '설명 없음'}</p>
            <div class="detail-actions">
                <button class="show-map-btn" onclick="showMap('${photo.location}')"><i class="fas fa-map-marked-alt"></i> 지도 보기</button>
                ${isLoggedIn ? `
                <div class="detail-options">
                    <button class="option-toggle-btn" onclick="toggleDetailOptions(event)"><i class="fas fa-ellipsis-v"></i></button>
                    <div class="option-dropdown">
                        <button onclick="handleModifyPhoto('${photo._id}')"><i class="fas fa-edit"></i> 수정</button>
                        <button onclick="handleDeletePhoto('${photo._id}')"><i class="fas fa-trash"></i> 삭제</button>
                    </div>
                </div>` : ''}
            </div>
        </div>`;
    DOMElements.detailModal.style.display = 'block';
}

function toggleDetailOptions(e) {
    e.stopPropagation();
    const dropdown = e.currentTarget.closest('.detail-options').querySelector('.option-dropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function openUploadModal() {
    DOMElements.uploadModal.style.display = 'block';
    resetUploadForm();
}

function closeAllModals() {
    DOMElements.detailModal.style.display = 'none';
    DOMElements.uploadModal.style.display = 'none';
    DOMElements.loginModal.style.display = 'none';
    closeMap();
}

// --- 폼 처리 ---
async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = DOMElements.loginForm.querySelector('#usernameInput').value;
    const password = DOMElements.loginForm.querySelector('#passwordInput').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '로그인 실패');
        
        isLoggedIn = true;
        updateLoginUI();
        closeAllModals();
        showNotification('로그인 성공!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function logout() {
    isLoggedIn = false;
    updateLoginUI();
    showNotification('로그아웃되었습니다.', 'info');
}

function updateLoginUI() {
    DOMElements.loginBtn.style.display = isLoggedIn ? 'none' : 'block';
    DOMElements.uploadBtn.style.display = isLoggedIn ? 'block' : 'none';
    DOMElements.logoutBtn.style.display = isLoggedIn ? 'block' : 'none';
    renderAll(); // Re-render to show/hide admin options
}

async function handleUploadSubmit(e) {
    e.preventDefault();
    const formData = new FormData(DOMElements.uploadForm);
    const id = DOMElements.uploadForm.getAttribute('data-edit-id');

    // FormData에 직접 값 추가 (input 필드와 매핑)
    formData.set('title', document.getElementById('titleInput').value);
    formData.set('location', document.getElementById('locationInput').value);
    formData.set('category', document.getElementById('categoryInput').value);
    formData.set('season', document.getElementById('seasonSelect').value);
    formData.set('date', document.getElementById('dateInput').value);
    formData.set('description', document.getElementById('descriptionInput').value);
    
    // 파일이 없는 수정의 경우 'photos' 필드 제거
    if (id && DOMElements.photoInput.files.length === 0) {
        formData.delete('photos');
    } else {
        // 새로 추가하는 경우 파일 체크
        if (!id && DOMElements.photoInput.files.length === 0) {
            showNotification('사진을 선택해주세요.', 'error');
            return;
        }
        // FormData는 이미 input name="photos"로 파일을 가지고 있음
    }

    try {
        const result = await uploadRequest(formData, id);
        showNotification(result.message, 'success');
        closeAllModals();
        await loadPhotos();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function handlePhotoPreview() {
    DOMElements.previewContainer.innerHTML = '';
    const files = DOMElements.photoInput.files;
    if (files.length > 0) {
        document.querySelector('.file-input-label span').textContent = `${files.length}개의 사진 선택됨`;
    }
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `<img src="${e.target.result}" alt="${file.name}"><span>${file.name}</span>`;
            DOMElements.previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function resetUploadForm() {
    DOMElements.uploadForm.reset();
    DOMElements.previewContainer.innerHTML = '';
    document.querySelector('.file-input-label span').textContent = '사진을 선택하세요 (여러 장 선택 가능)';
    DOMElements.uploadForm.removeAttribute('data-edit-id');
    DOMElements.photoInput.disabled = false;
    document.querySelector('#uploadModal .modal-header h2').textContent = '새로운 추억 추가';
    document.querySelector('#uploadForm .submit-btn').textContent = '추억 저장';
}

async function handleDeletePhoto(id) {
    if (!confirm('정말로 이 사진을 삭제하시겠습니까?')) return;
    try {
        await deletePhotoAPI(id);
        showNotification('사진이 삭제되었습니다.', 'success');
        closeAllModals();
        await loadPhotos();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function handleModifyPhoto(id) {
    const photo = allPhotos.find(p => p._id === id);
    if (!photo) return;

    openUploadModal();
    
    // Fill form
    DOMElements.uploadForm.setAttribute('data-edit-id', id);
    document.getElementById('titleInput').value = photo.title || '';
    document.getElementById('locationInput').value = photo.location || '';
    document.getElementById('categoryInput').value = photo.category || '';
    document.getElementById('seasonSelect').value = photo.season || '';
    document.getElementById('dateInput').value = photo.date || '';
    document.getElementById('descriptionInput').value = photo.description || '';

    // Update modal UI for editing
    document.querySelector('#uploadModal .modal-header h2').textContent = '추억 수정';
    document.querySelector('#uploadForm .submit-btn').textContent = '수정 완료';
    DOMElements.photoInput.disabled = true;
    document.querySelector('.file-input-label span').textContent = `파일명: ${photo.filename} (사진 변경 불가)`;
}

// --- 지도 ---
async function loadLocationMapping() {
    try {
        const response = await fetch(`${API_BASE_URL}/data/location_mapping.csv`);
        const text = await response.text();
        const rows = text.split('\n').slice(1);
        rows.forEach(row => {
            const [name, lat, lng, ...rest] = row.split(',');
            if (name && lat && lng) {
                locationMapping[name.trim()] = { lat: parseFloat(lat), lng: parseFloat(lng) };
            }
        });
    } catch (error) {
        console.error('위치 매핑 파일 로드 실패:', error);
    }
}

function showMap(locationName) {
    DOMElements.detailMapContainer.style.display = 'block';

    const localCoords = locationMapping[locationName];
    if (localCoords) {
        // 로컬 CSV에 좌표가 있는 경우
        if (!map) {
            map = new kakao.maps.Map(DOMElements.mapContainer, {
                center: new kakao.maps.LatLng(localCoords.lat, localCoords.lng),
                level: 3
            });
        }
        const position = new kakao.maps.LatLng(localCoords.lat, localCoords.lng);
        const marker = new kakao.maps.Marker({ position });
        marker.setMap(map);
        map.setCenter(position);
        DOMElements.mapInfo.innerHTML = `<div><strong>${locationName}</strong></div><div>(저장된 위치)</div>`;

    } else {
        // 로컬 CSV에 좌표가 없는 경우 API로 검색
        window.showKakaoMap(locationName, DOMElements.mapInfo);
    }
}

function closeMap() {
    DOMElements.detailMapContainer.style.display = 'none';
}

// --- 유틸리티 ---
function showNotification(message, type = 'info') {
    const container = document.body;
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.innerHTML = `<p>${message}</p><span class="close-icon">&times;</span>`;
    
    notification.querySelector('.close-icon').onclick = () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    };

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}