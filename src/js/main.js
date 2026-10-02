
document.addEventListener('DOMContentLoaded', () => {

    // GLOBAL AUTH LOGIC
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
      const token = localStorage.getItem('bb_token');
      const username = localStorage.getItem('bb_username');
      const role = localStorage.getItem('bb_role');

      if (token && username) {
        // User is logged in
        let roleBadge = '';
        if (role === 'teacher') roleBadge = '<span class="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 uppercase">Giáo viên</span>';
        else if (role === 'admin') roleBadge = '<span class="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 uppercase">Admin</span>';
        else roleBadge = '<span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 uppercase">Học sinh</span>';

        
        let adminBtn = '';
        if (role === 'admin') {
          adminBtn = '<a href="admin.html" class="hidden sm:inline-flex items-center justify-center px-4 py-1.5 bg-error text-white font-bold rounded-lg hover:bg-error-container transition-colors shadow-sm text-sm">Quản trị</a>';
        }

        authContainer.innerHTML = `
          ${adminBtn}
          <a href="profile.html" class="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface-container border border-surface-container-highest rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer" title="Hồ sơ cá nhân">
            <span class="font-headline-sm text-body-sm font-bold text-on-surface">${username}</span>
            ${roleBadge}
          </a>
          <button id="bb-chat-btn" class="relative hidden sm:inline-flex items-center justify-center p-2 border border-surface-container-high bg-surface-container-low text-on-surface hover:bg-surface-container hover:border-primary-container rounded-lg transition-colors" title="Tin nhắn">
            <span class="material-symbols-outlined text-[20px]">chat</span>
            <span id="bb-chat-badge" class="hidden absolute -top-1 -right-1 w-4 h-4 bg-[#FF5C00] text-white text-[9px] font-bold rounded-full flex items-center justify-center"></span>
          </button>
          <button id="logout-btn" class="hidden sm:inline-flex items-center justify-center p-2 border border-surface-container-high bg-surface-container-low text-error hover:bg-error-container hover:text-on-error-container hover:border-error-container rounded-lg transition-colors" title="Đăng xuất">
            <span class="material-symbols-outlined text-[20px]">logout</span>
          </button>
        `;

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('bb_token');
            localStorage.removeItem('bb_username');
            localStorage.removeItem('bb_role');
            window.location.reload();
          });
        }
        // Chat button handler
        const chatBtn = document.getElementById('bb-chat-btn');
        if (chatBtn) {
          chatBtn.addEventListener('click', () => {
            if (window.BBChat) window.BBChat.open();
          });
        }
      }
    }

    // HOME PAGE
    const scanBtn = document.getElementById('btn-scan');
    const scanResult = document.getElementById('scan-result');
    const gradeSelect = document.getElementById('grade-select');
    const subjectSelect = document.getElementById('subject-select');

    if (scanBtn && scanResult) {
      scanBtn.addEventListener('click', () => {
        scanBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Đang quét trang sách...</span>
        `;
        
        setTimeout(() => {
          scanBtn.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span>Quét Lại Sách Khác</span>
          `;
          scanResult.className = "p-3 bg-green-50 tech-border-all border-green-500 text-green-800 text-[11px] font-mono flex items-center justify-between";
          scanResult.innerHTML = `
            <span>✓ SÁCH CŨ HỢP CHUẨN GDPT 2018 (ĐỘ MỚI: 89%)</span>
            <a href="#view" class="font-bold underline text-[#FF5C00]">XEM PHÂN TÍCH</a>
          `;
        }, 1200);
      });
    }

    if (subjectSelect) {
      subjectSelect.addEventListener('change', (e) => {
        if (scanResult) {
          scanResult.innerHTML = `
            <span>ĐÃ ĐỔI: ${e.target.value.toUpperCase()}</span>
            <a href="#" class="font-bold underline text-[#FF5C00]">MỞ PDF GỐC</a>
          `;
        }
      });
    }

    // EXERCISE PAGE
    const fillSampleBtn = document.getElementById('fill-sample-btn');
    const lessonInput = document.getElementById('lesson-input');
    const generateBtn = document.getElementById('generate-btn');
    const toggleAnswersBtn = document.getElementById('toggle-answers');
    const answerBoxes = document.querySelectorAll('.answer-box');
    const mascotDialogue = document.getElementById('mascot-dialogue');
    const quickExtendBtn = document.getElementById('quick-extend-btn');
    const explainBtn = document.getElementById('explain-btn');
    const downloadPdf = document.getElementById('download-pdf');
    const downloadDoc = document.getElementById('download-doc');

    if (fillSampleBtn && lessonInput) {
      fillSampleBtn.addEventListener('click', function() {
        lessonInput.value = "Bài 3: Chuyển động thẳng biến đổi đều (Vật lý 10 - Chương trình GDPT mới). Yêu cầu tóm tắt định nghĩa gia tốc, phương trình v-t, s-t, hệ thức độc lập và 10 câu trắc nghiệm minh họa.";
      });
    }

    if (toggleAnswersBtn) {
      let shown = false;
      toggleAnswersBtn.addEventListener('click', function() {
        shown = !shown;
        answerBoxes.forEach(box => {
          if (shown) {
            box.classList.remove('hidden');
          } else {
            box.classList.add('hidden');
          }
        });
        toggleAnswersBtn.textContent = shown ? 'Ẩn đáp án & lời giải' : 'Hiện đáp án & lời giải chi tiết';
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', function() {
        const originalText = generateBtn.innerHTML;
        generateBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span><span>Sylvi AI đang tổng hợp kiến thức...</span>';
        generateBtn.classList.add('opacity-90');

        setTimeout(() => {
          generateBtn.innerHTML = originalText;
          generateBtn.classList.remove('opacity-90');
          if (mascotDialogue) {
            mascotDialogue.innerHTML = '"Đã làm mới thành công bài học! Tôi vừa kiểm tra đối chiếu dữ liệu với ngân hàng đề thi chuẩn BGD 2024."';
          }
        }, 900);
      });
    }

    if (quickExtendBtn && mascotDialogue) {
      quickExtendBtn.addEventListener('click', function() {
        mascotDialogue.innerHTML = '"Đã bổ sung 2 câu bài tập Đồ thị vận tốc (Vận dụng cao mức 9+) vào cuối danh sách bài học!"';
      });
    }

    if (explainBtn && mascotDialogue) {
      explainBtn.addEventListener('click', function() {
        mascotDialogue.innerHTML = '"Gia tốc (a): đại lượng đặc trưng cho độ biến thiên nhanh hay chậm của vận tốc theo thời gian. Đơn vị SI là mét trên giây bình phương (m/s²)."';
      });
    }

    if (downloadPdf) {
      downloadPdf.addEventListener('click', function() {
        alert('Hệ thống đang chuẩn bị tệp PDF chất lượng cao (300 DPI) để tải về thiết bị của bạn.');
      });
    }

    if (downloadDoc) {
      downloadDoc.addEventListener('click', function() {
        alert('Tệp Microsoft Word .docx đang được tạo sẵn bảng và công thức MathType tương thích.');
      });
    }

    // LIBRARY PAGE
    const booksGrid = document.getElementById('books-grid');
    const paginationControls = document.getElementById('pagination-controls');
    const paginationInfo = document.getElementById('pagination-info');

    if (booksGrid && paginationControls && paginationInfo) {
      const ITEMS_PER_PAGE = 4;
      let allBooks = [];
      let currentPage = 1;

      async function fetchAndRenderBooks() {
        try {
          const res = await fetch('http://127.0.0.1:8000/books');
          allBooks = await res.json();
          renderPage(1);
        } catch (error) {
          console.error("Error fetching books:", error);
          booksGrid.innerHTML = '<div class="text-error col-span-full text-center py-8">Lỗi khi tải dữ liệu sách</div>';
          paginationInfo.textContent = "LỖI TẢI DỮ LIỆU";
        }
      }

      function renderPage(page) {
        currentPage = page;
        const totalPages = Math.ceil(allBooks.length / ITEMS_PER_PAGE);
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const currentBooks = allBooks.slice(startIndex, endIndex);

        booksGrid.innerHTML = '';
        currentBooks.forEach(book => {
          const title = book['Tiêu đề sách'];
          const link = book['Link tham khảo'];
          
          booksGrid.innerHTML += `
            <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow">
              <div>
                <div class="relative w-full aspect-[3/4] bg-surface-container-low rounded-lg overflow-hidden mb-space-sm flex items-center justify-center p-space-sm">
                  <div class="w-full h-full bg-gradient-to-br from-surface-container to-surface-container-high rounded p-space-md flex flex-col justify-between">
                    <div class="flex items-center justify-between">
                      <span class="px-2 py-0.5 bg-primary-container text-on-primary font-label-code text-[10px] font-bold rounded">HỌC LIỆU</span>
                      <span class="font-headline-md font-bold text-tertiary opacity-40">12</span>
                    </div>
                    <div class="text-center my-auto">
                      <div class="font-headline-md text-sm sm:text-base text-on-surface leading-tight font-extrabold uppercase line-clamp-4">
                        ${title}
                      </div>
                    </div>
                    <div class="flex items-center justify-between text-[10px] font-label-code text-tertiary pt-2 border-t border-surface-container-highest">
                      <span class="">NXB GDVN</span>
                      <span class="">BGD&amp;ĐT</span>
                    </div>
                  </div>
                  <div class="absolute top-2 left-2 bg-on-surface/80 backdrop-blur text-surface px-1.5 py-0.5 rounded font-label-code text-[10px] flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px] text-primary-container">verified</span>
                    <span class="">BẢN QUYỀN</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <h3 class="font-headline-sm text-body-sm font-bold text-on-surface group-hover:text-primary-container transition-colors line-clamp-2" title="${title}">
                    ${title}
                  </h3>
                </div>
              </div>
              <div class="mt-space-md pt-space-sm border-t border-surface-container-high flex items-center gap-2">
                <a href="${link}" target="_blank" class="flex-1 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-body-sm rounded flex items-center justify-center gap-1 transition-colors">
                  <span class="material-symbols-outlined text-[18px]">menu_book</span>
                  <span class="">Đọc trực tuyến</span>
                </a>
                <a href="${link}" target="_blank" class="p-2 bg-surface-container-low hover:bg-primary-fixed hover:text-primary-container text-secondary rounded transition-colors" title="Tải PDF chuẩn BGD">
                  <span class="material-symbols-outlined text-[20px]">download</span>
                </a>
              </div>
            </div>
          `;
        });

        const totalItems = allBooks.length;
        const displayingEnd = Math.min(endIndex, totalItems);
        paginationInfo.textContent = `HIỂN THỊ ${startIndex + 1} - ${displayingEnd} TRÊN TỔNG SỐ ${totalItems} ĐẦU HỌC LIỆU XÁC NHẬN`;
        
        let paginationHTML = '';
        if (page > 1) {
            paginationHTML += `<button onclick="window.bbRenderPage(${page - 1})" class="px-3 py-1 bg-surface-container text-secondary font-label-mono text-body-sm rounded hover:bg-surface-container-high">&lt;</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            if (i === page) {
                paginationHTML += `<button class="px-3 py-1 bg-surface-container-high text-on-surface font-label-mono text-body-sm rounded font-bold">${i}</button>`;
            } else if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
                paginationHTML += `<button onclick="window.bbRenderPage(${i})" class="px-3 py-1 bg-surface-container text-secondary font-label-mono text-body-sm rounded hover:bg-surface-container-high">${i}</button>`;
            } else if (i === page - 2 || i === page + 2) {
                paginationHTML += `<span class="px-2 font-label-mono text-tertiary">...</span>`;
            }
        }
        if (page < totalPages) {
            paginationHTML += `<button onclick="window.bbRenderPage(${page + 1})" class="px-3 py-1 bg-surface-container text-secondary font-label-mono text-body-sm rounded hover:bg-surface-container-high">&gt;</button>`;
        }
        
        paginationControls.innerHTML = paginationHTML;
      }
      
      window.bbRenderPage = renderPage;
      fetchAndRenderBooks();
    }

    const gradePills = document.querySelectorAll('.grade-pill');
    gradePills.forEach(pill => {
      pill.addEventListener('click', () => {
        gradePills.forEach(p => {
          p.classList.remove('bg-primary-container', 'text-on-primary', 'font-bold', 'shadow-[1px_1px_0px_#1a1c1d]');
          p.classList.add('bg-surface-container', 'text-secondary');
        });
        pill.classList.remove('bg-surface-container', 'text-secondary');
        pill.classList.add('bg-primary-container', 'text-on-primary', 'font-bold', 'shadow-[1px_1px_0px_#1a1c1d]');
      });
    });

    const clearBtn = document.getElementById('clear-search');
    const searchInput = document.getElementById('sgk-search-input');
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
      });
    }
    
    // PAIRING PAGE (If any specific JS)
    const modeBorrowBtn = document.getElementById('mode-borrow-btn');
    const modeShareBtn = document.getElementById('mode-share-btn');
    if (modeBorrowBtn && modeShareBtn) {
      modeBorrowBtn.addEventListener('click', () => {
        modeBorrowBtn.classList.add('border-2', 'border-primary-container', 'bg-primary-fixed/20');
        modeBorrowBtn.classList.remove('border', 'border-surface-container-high', 'bg-surface-container-low', 'text-secondary');
        modeBorrowBtn.querySelector('div').classList.add('text-primary');
        
        modeShareBtn.classList.remove('border-2', 'border-primary-container', 'bg-primary-fixed/20');
        modeShareBtn.classList.add('border', 'border-surface-container-high', 'bg-surface-container-low', 'text-secondary');
        modeShareBtn.querySelector('div').classList.remove('text-primary');
      });
      modeShareBtn.addEventListener('click', () => {
        modeShareBtn.classList.add('border-2', 'border-primary-container', 'bg-primary-fixed/20');
        modeShareBtn.classList.remove('border', 'border-surface-container-high', 'bg-surface-container-low', 'text-secondary');
        modeShareBtn.querySelector('div').classList.add('text-primary');
        
        modeBorrowBtn.classList.remove('border-2', 'border-primary-container', 'bg-primary-fixed/20');
        modeBorrowBtn.classList.add('border', 'border-surface-container-high', 'bg-surface-container-low', 'text-secondary');
        modeBorrowBtn.querySelector('div').classList.remove('text-primary');
      });
    }

    // MOBILE SIDEBAR
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');

    if (mobileMenuBtn && closeSidebarBtn && mobileSidebar && mobileSidebarOverlay) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileSidebarOverlay.classList.remove('hidden');
        setTimeout(() => {
          mobileSidebarOverlay.classList.remove('opacity-0');
          mobileSidebar.classList.remove('-translate-x-full');
        }, 10);
      });

      const closeSidebar = () => {
        mobileSidebar.classList.add('-translate-x-full');
        mobileSidebarOverlay.classList.add('opacity-0');
        setTimeout(() => {
          mobileSidebarOverlay.classList.add('hidden');
        }, 300);
      };

      closeSidebarBtn.addEventListener('click', closeSidebar);
      mobileSidebarOverlay.addEventListener('click', closeSidebar);
    }


    
    // AI Lens Logic (Dynamic Chapter Input List)
    const addChapterBtn = document.getElementById('add-chapter-btn');
    const chaptersContainer = document.getElementById('ai-lens-chapters-container');
    const chapterCountBadge = document.getElementById('chapter-count-badge');
    const lensBookName = document.getElementById('ai-lens-book-name');
    const submitLens = document.getElementById('submit-ai-lens');
    const lensResults = document.getElementById('ai-lens-results');

    function updateChapterNumbers() {
        if (!chaptersContainer) return;
        const boxes = chaptersContainer.querySelectorAll('.chapter-box');
        boxes.forEach((box, index) => {
            const idxSpan = box.querySelector('.chapter-idx');
            if (idxSpan) idxSpan.textContent = index + 1;
        });
        if (chapterCountBadge) {
            chapterCountBadge.textContent = `${boxes.length} tiêu đề`;
        }
    }

    if (addChapterBtn && chaptersContainer) {
        addChapterBtn.addEventListener('click', () => {
            const count = chaptersContainer.querySelectorAll('.chapter-box').length + 1;
            const box = document.createElement('div');
            box.className = 'chapter-box group relative flex items-center gap-2 bg-surface-container-low p-2 rounded-lg border border-surface-container-high focus-within:border-primary-container transition-all';
            box.innerHTML = `
              <span class="chapter-idx flex items-center justify-center w-6 h-6 rounded bg-surface-container-highest text-secondary font-mono text-[11px] font-bold">${count}</span>
              <input type="text" class="chapter-title-input flex-1 bg-transparent border-none text-body-sm text-on-surface outline-none placeholder:text-gray-400 font-medium" placeholder="Nhập tiêu đề bài / chương...">
              <button type="button" class="remove-chapter-btn opacity-60 hover:opacity-100 text-tertiary hover:text-error transition-opacity p-1 rounded">
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            `;
            chaptersContainer.appendChild(box);
            updateChapterNumbers();
            const newInput = box.querySelector('.chapter-title-input');
            if (newInput) newInput.focus();
        });

        chaptersContainer.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-chapter-btn');
            if (removeBtn) {
                const box = removeBtn.closest('.chapter-box');
                const totalBoxes = chaptersContainer.querySelectorAll('.chapter-box').length;
                if (totalBoxes <= 1) {
                    alert('Phải giữ lại ít nhất 1 ô nhập tiêu đề bài học!');
                    return;
                }
                if (box) {
                    box.remove();
                    updateChapterNumbers();
                }
            }
        });
    }

    if (submitLens) {
        submitLens.addEventListener('click', async () => {
            const bookName = lensBookName ? lensBookName.value.trim() : "Vật lý 10";
            if (!bookName) {
                alert("Vui lòng nhập tên sách hoặc từ khoá!");
                return;
            }

            const chapterInputs = document.querySelectorAll('.chapter-title-input');
            const chapterTitles = Array.from(chapterInputs)
                .map(inp => inp.value.trim())
                .filter(val => val.length > 0);

            if (chapterTitles.length === 0) {
                alert("Vui lòng nhập ít nhất 1 tiêu đề bài học!");
                return;
            }

            // Show loading state in results area
            lensResults.innerHTML = `
              <div class="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                 <span class="material-symbols-outlined text-[48px] text-primary-container animate-spin mb-4">refresh</span>
                 <h3 class="font-headline-md text-headline-md text-on-surface">AI Đang Phân Tích & Đối Sánh...</h3>
                 <p class="text-body-sm text-tertiary mt-2">Đang phân tích semantic & cấu trúc ${chapterTitles.length} bài học nhập vào với CSDL Chương trình GDPT 2018.</p>
              </div>
            `;

            try {
                // Gọi API backend phân tích semantic AI thực tế
                const response = await fetch('http://127.0.0.1:8000/compare_titles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        book_name: bookName,
                        chapter_titles: chapterTitles
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // Render Success Results
                const isHighMatch = data.match_percentage >= 50;

                let rowsHtml = '';
                data.matches.forEach(m => {
                    // Color-code based on score
                    const icon = m.score >= 70 ? 'check_circle' : m.score >= 30 ? 'help' : 'cancel';
                    const iconColor = m.score >= 70 ? 'text-green-600' : m.score >= 30 ? 'text-amber-500' : 'text-red-400';
                    const badgeClass = m.score >= 70
                        ? 'text-green-700 bg-green-100'
                        : m.score >= 30
                            ? 'text-amber-700 bg-amber-100'
                            : 'text-red-600 bg-red-50';
                    const badgeText = m.score === 0 ? 'KHÔNG KHỚP' : `${m.score}% KHỚP`;

                    rowsHtml += `
                      <div class="p-space-sm bg-surface-container-low rounded-lg flex flex-col gap-2 mb-2 border border-surface-container">
                        <div class="flex items-start justify-between gap-2">
                           <div class="flex items-center gap-space-sm min-w-0 flex-1">
                             <span class="material-symbols-outlined ${iconColor} text-[20px] mt-0.5">${icon}</span>
                             <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 w-full">
                               <div class="min-w-0">
                                 <span class="block text-[10px] text-tertiary uppercase font-label-code mb-0.5">NỘI DUNG NHẬP VÀO</span>
                                 <p class="font-body-sm text-body-sm text-on-surface font-medium truncate" title="${m.found}">${m.found}</p>
                               </div>
                               <div class="min-w-0">
                                 <span class="block text-[10px] text-tertiary uppercase font-label-code mb-0.5">CSDL GDPT 2018 (${data.book_name})</span>
                                 <p class="font-body-sm text-body-sm text-on-surface font-medium truncate" title="${m.expected}">${m.expected}</p>
                               </div>
                             </div>
                           </div>
                           <span class="font-label-code text-[11px] ${badgeClass} px-2.5 py-1 rounded-md font-bold whitespace-nowrap">${badgeText}</span>
                        </div>
                      </div>
                    `;
                });

                const gaugeColor = isHighMatch ? 'bg-error-container text-on-error-container' : 'bg-amber-100 text-amber-800';
                const badgeClass = isHighMatch ? 'bg-surface-container-high text-on-surface' : 'bg-amber-100 text-amber-800';
                const statusTitle = isHighMatch ? 'Tương thích cao với GDPT 2018' : 'Tỉ lệ đối sánh thấp';
                const statusSub = `ĐÃ THẨM ĐỊNH KHỚP ${data.matched_items} / ${data.total_items} TIÊU ĐỀ BÀI HỌC`;
                const recommend = isHighMatch ? 'KHUYẾN NGHỊ: DÙNG ĐƯỢC' : 'KHÔNG KHUYẾN NGHỊ';

                lensResults.innerHTML = `
                  <div class="flex flex-col h-full justify-between">
                    <div>
                      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm pb-space-sm border-b border-surface-container-high mb-space-md">
                        <div class="flex items-center gap-space-sm">
                          <div class="w-12 h-12 rounded-lg ${gaugeColor} flex items-center justify-center font-headline-md font-bold">
                            ${data.match_percentage}%
                          </div>
                          <div>
                            <div class="font-headline-sm text-headline-sm text-on-surface">${statusTitle}</div>
                            <span class="font-label-code text-label-code text-secondary uppercase">${statusSub}</span>
                          </div>
                        </div>
                        <span class="px-2.5 py-1 ${badgeClass} font-label-mono text-label-code rounded font-bold">
                          ${recommend}
                        </span>
                      </div>
                      
                      <div class="font-label-code text-label-code text-tertiary uppercase mb-2">
                        BẢNG ĐỐI CHIẾU NỘI DUNG NHẬP VÀO vs CSDL (${data.book_name})
                      </div>
                      
                      <div class="flex flex-col overflow-y-auto max-h-[250px] no-scrollbar pr-1">
                        ${rowsHtml}
                      </div>
                    </div>
                    
                    <div class="mt-space-lg pt-space-md border-t border-surface-container-high flex flex-col sm:flex-row items-center justify-between gap-space-sm">
                      <span class="font-label-code text-[11px] text-tertiary">Đã xác thực bởi thuật toán BookBridge Semantic Match</span>
                      <div class="flex items-center gap-2 w-full sm:w-auto">
                        <button class="flex-1 sm:flex-none px-4 py-2 bg-surface-container text-on-surface text-body-sm font-headline-sm rounded hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2">
                          <span class="material-symbols-outlined text-[18px]">download</span> Xuất file (.PDF)
                        </button>
                        <button class="flex-1 sm:flex-none px-4 py-2 bg-primary-container text-on-primary text-body-sm font-headline-sm rounded hover:bg-surface-tint shadow-[2px_2px_0px_#1a1c1d] transition-all">
                          Đăng ký mượn bản mới
                        </button>
                      </div>
                    </div>
                  </div>
                `;
            } catch (err) {
                console.error(err);
            }
        });
    }

});
// ----------------------------------------------------
// NEW PAIRING LOGIC
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const schoolSelect = document.getElementById('school-select');
    const gradeSelect = document.getElementById('grade-select');
    const shiftSelect = document.getElementById('shift-select');
    const submitReqBtn = document.getElementById('submit-req-btn');
    const reqList = document.getElementById('pairing-requests-list');
    
    // Notification Bell Injection
    const authContainer = document.getElementById('auth-container');
    if (authContainer && localStorage.getItem('bb_token')) {
        const notiWrapper = document.createElement('div');
        notiWrapper.className = 'relative mr-3';
        notiWrapper.innerHTML = `
            <button id="noti-bell-btn" class="p-2 rounded-full hover:bg-surface-container relative text-secondary">
                <span class="material-symbols-outlined">notifications</span>
                <span id="noti-badge" class="hidden absolute top-0 right-0 w-3 h-3 bg-error rounded-full border-2 border-surface"></span>
            </button>
            <div id="noti-dropdown" class="hidden absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 z-50 flex-col overflow-hidden max-h-96 overflow-y-auto">
                <div class="p-3 border-b border-gray-100 font-bold text-sm bg-gray-50 flex justify-between items-center">
                    <span>Thông báo</span>
                    <button id="mark-read-btn" class="text-xs text-primary hover:underline">Đã đọc</button>
                </div>
                <div id="noti-items" class="flex flex-col divide-y divide-gray-50">
                    <div class="p-4 text-center text-xs text-gray-500">Chưa có thông báo</div>
                </div>
            </div>
        `;
        authContainer.insertBefore(notiWrapper, authContainer.firstChild);

        const notiBtn = document.getElementById('noti-bell-btn');
        const notiDropdown = document.getElementById('noti-dropdown');
        const notiBadge = document.getElementById('noti-badge');
        const notiItems = document.getElementById('noti-items');
        
        notiBtn.addEventListener('click', () => {
            notiDropdown.classList.toggle('hidden');
            notiDropdown.classList.toggle('flex');
        });

        document.getElementById('mark-read-btn').addEventListener('click', async () => {
            await fetch('http://127.0.0.1:8000/notifications/read', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('bb_token')}` }
            });
            notiBadge.classList.add('hidden');
            loadNotifications();
        });

        async function loadNotifications() {
            try {
                const res = await fetch('http://127.0.0.1:8000/notifications', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('bb_token')}` }
                });
                const notis = await res.json();
                const unread = notis.filter(n => !n.read).length;
                if (unread > 0) notiBadge.classList.remove('hidden');
                else notiBadge.classList.add('hidden');

                if (notis.length > 0) {
                    notiItems.innerHTML = notis.map(n => `
                        <div class="p-3 text-sm hover:bg-gray-50 ${n.read ? 'opacity-60' : 'bg-blue-50/30'}">
                            ${n.message}
                            <div class="text-[10px] text-gray-400 mt-1">${new Date(n.created_at).toLocaleString()}</div>
                        </div>
                    `).join('');
                }
            } catch(e) {}
        }
        
        loadNotifications();
        setInterval(loadNotifications, 10000); // Poll every 10s
    }

    // Only run pairing logic if we are on pairing.html (applyFilterBtn exists)
    if (applyFilterBtn) {
        
        // 1. Load options
        async function loadOptions() {
            try {
                const res = await fetch('http://127.0.0.1:8000/pairing_options');
                const data = await res.json();
                
                if(data.school && data.school.length) {
                    schoolSelect.innerHTML = data.school.map(v => `<option value="${v}">${v}</option>`).join('');
                }
                if(data.grade && data.grade.length) {
                    gradeSelect.innerHTML = data.grade.map(v => `<option value="${v}">${v}</option>`).join('');
                }
                if(data.mode && data.mode.length) {
                    shiftSelect.innerHTML = data.mode.map(v => `<option value="${v}">${v}</option>`).join('');
                }
            } catch(e) {}
        }
        loadOptions();

        // Fetch Profile and Update Radar
        async function loadProfileAndRadar() {
            if(!localStorage.getItem('bb_token')) return;
            try {
                const res = await fetch('http://127.0.0.1:8000/user/profile', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('bb_token')}` }
                });
                if(res.ok) {
                    const profile = await res.json();
                    
                    // Pre-fill selects if values exist
                    if(profile.school) schoolSelect.value = profile.school;
                    if(profile.grade) gradeSelect.value = profile.grade;
                    if(profile.mode) shiftSelect.value = profile.mode;

                    // Update Radar
                    const coreName = document.getElementById('radar-core-name');
                    if(coreName && profile.school) {
                        coreName.innerText = profile.school + ' (Gốc)';
                    }
                    
                    const node1Title = document.getElementById('radar-node-1-title');
                    const node1Desc = document.getElementById('radar-node-1-desc');
                    if(node1Title && profile.grade) {
                        node1Title.innerText = 'Cùng khối: ' + profile.grade;
                        node1Desc.innerText = 'Khoảng cách: 0m (Nội bộ)';
                    }

                    const node2Title = document.getElementById('radar-node-2-title');
                    if(node2Title && profile.mode) {
                        node2Title.innerText = profile.mode;
                    }
                }
            } catch(e) {}
        }
        loadProfileAndRadar();


        // 2. Save Filter Profile
        applyFilterBtn.addEventListener('click', async () => {
            if(!localStorage.getItem('bb_token')) return alert("Vui lòng đăng nhập!");
            const school = schoolSelect.value;
            const grade = gradeSelect.value;
            const mode = shiftSelect.value;
            applyFilterBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> ĐANG LƯU...';
            try {
                await fetch('http://127.0.0.1:8000/user/profile', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('bb_token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({school, grade, mode})
                });
                
                // Also update the radar locally
                const coreName = document.getElementById('radar-core-name');
                if(coreName) coreName.innerText = school + ' (Gốc)';
                
                const node1Title = document.getElementById('radar-node-1-title');
                const node1Desc = document.getElementById('radar-node-1-desc');
                if(node1Title) {
                    node1Title.innerText = 'Cùng khối: ' + grade;
                    node1Desc.innerText = 'Khoảng cách: 0m (Nội bộ)';
                }

                const node2Title = document.getElementById('radar-node-2-title');
                if(node2Title) node2Title.innerText = mode;

                applyFilterBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span> ĐÃ CẬP NHẬT';
                setTimeout(() => {
                    applyFilterBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">update</span> CẬP NHẬT';
                }, 2000);
            } catch(e) {
                alert("Lỗi kết nối");
            }
        });

        // 3. Track request type
        let reqType = 'borrow';
        document.getElementById('mode-borrow-btn').addEventListener('click', () => reqType = 'borrow');
        document.getElementById('mode-share-btn').addEventListener('click', () => reqType = 'share');

        // 4. Submit Request
        submitReqBtn.addEventListener('click', async () => {
            if(!localStorage.getItem('bb_token')) return alert("Vui lòng đăng nhập!");
            const studentId = document.getElementById('req-student-id').value;
            const classTime = document.getElementById('req-class-time').value;
            const bookType = document.getElementById('req-book-type').value;

            if(!studentId || !classTime || !bookType) {
                return alert("Vui lòng điền đầy đủ thông tin!");
            }

            document.getElementById('submit-req-text').innerText = 'ĐANG XỬ LÝ...';
            submitReqBtn.disabled = true;

            try {
                const res = await fetch('http://127.0.0.1:8000/pairing_requests', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('bb_token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({type: reqType, student_id: studentId, class_time: classTime, book_type: bookType})
                });
                if(res.ok) {
                    alert("Đăng tin ghép cặp thành công!");
                    document.getElementById('req-book-type').value = '';
                    loadPairingRequests();
                }
            } catch(e) {}
            finally {
                document.getElementById('submit-req-text').innerText = 'XÁC NHẬN & PHÁT TÍN HIỆU TÌM BẠN ĐỐI ỨNG';
                submitReqBtn.disabled = false;
            }
        });

        // 5. Load and Pair
        async function loadPairingRequests() {
            try {
                const res = await fetch('http://127.0.0.1:8000/pairing_requests');
                const reqs = await res.json();
                const currentUser = localStorage.getItem('bb_username');

                reqList.innerHTML = '';
                if(reqs.length === 0) {
                    reqList.innerHTML = '<div class="col-span-3 text-center text-gray-500 py-8">Chưa có yêu cầu ghép cặp nào đang hoạt động.</div>';
                    return;
                }

                reqs.forEach(r => {
                    const isOwner = currentUser === r.username;
                    const typeBadge = r.type === 'borrow' ? 
                        '<span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-sm uppercase">CẦN MƯỢN</span>' : 
                        '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-sm uppercase">CHO MƯỢN / TẶNG</span>';
                    
                    const actionBtn = isOwner ? 
                        `<button disabled class="mt-4 w-full py-2 bg-gray-100 text-gray-400 font-bold rounded text-xs">TIN CỦA BẠN</button>` :
                        `<button onclick="pairWith('${r._id}')" class="mt-4 w-full py-2 bg-primary-container text-on-primary hover:bg-[#e04f00] transition-colors font-bold rounded text-xs shadow-sm flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">handshake</span> GHÉP CẶP NGAY</button>`;

                    reqList.innerHTML += `
                        <div class="bg-surface-container-lowest rounded-xl border-2 ${r.type === 'borrow' ? 'border-blue-100' : 'border-green-100'} p-space-md shadow-[3px_3px_0px_#1a1c1d] flex flex-col justify-between relative group hover:-translate-y-1 transition-transform">
                            <div class="absolute -top-3 right-4 px-3 py-1 ${r.type === 'borrow' ? 'bg-blue-600' : 'bg-green-600'} text-white font-label-mono text-[10px] font-bold uppercase rounded-sm shadow-sm flex items-center gap-1">
                                <span class="material-symbols-outlined text-[12px]">${r.type === 'borrow' ? 'handshake' : 'volunteer_activism'}</span>
                                ${r.type === 'borrow' ? 'CẦN MƯỢN' : 'CHO MƯỢN / TẶNG'}
                            </div>
                            
                            <div>
                                <div class="flex items-center justify-between border-b border-surface-container-high pb-3 mb-3 mt-2">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-gray-200">
                                            <span class="material-symbols-outlined text-[20px] text-gray-600">account_circle</span>
                                        </div>
                                        <div>
                                            <div class="font-headline-sm text-sm text-on-surface font-bold leading-tight">${r.username}</div>
                                            <div class="font-label-code text-[10px] text-secondary">ID: ${r.student_id}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-surface-container-low p-space-sm rounded-lg mb-space-sm border border-gray-100">
                                    <div class="text-[11px] font-label-code text-secondary uppercase mb-1">Tài liệu ghép nối:</div>
                                    <div class="font-headline-sm text-sm text-on-surface font-bold break-words">${r.book_type}</div>
                                </div>
                                
                                <div class="flex flex-col gap-2 text-[12px] font-body-sm text-on-surface mb-2">
                                    <div class="flex items-start gap-2">
                                        <span class="material-symbols-outlined text-[16px] text-primary shrink-0">school</span>
                                        <span class="leading-tight"><strong>Trường:</strong> ${r.school}</span>
                                    </div>
                                    <div class="flex items-start gap-2">
                                        <span class="material-symbols-outlined text-[16px] text-primary shrink-0">schedule</span>
                                        <span class="leading-tight"><strong>Thời gian:</strong> ${r.class_time}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-space-md pt-space-sm border-t border-surface-container-high flex flex-col gap-2">
                                <div class="font-label-code text-[10px] text-tertiary flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[12px]">schedule</span> Đăng lúc: ${new Date(r.created_at).toLocaleString()}
                                </div>
                                ${actionBtn}
                            </div>
                        </div>
                    `;
                });
            } catch(e) {}
        }
        
        loadPairingRequests();
        setInterval(loadPairingRequests, 15000); // Poll every 15s

        window.pairWith = async function(id) {
            if(!localStorage.getItem('bb_token')) return alert("Vui lòng đăng nhập để ghép cặp!");
            if(!confirm("Bạn có chắc muốn gửi yêu cầu ghép cặp tới người này?")) return;
            try {
                const res = await fetch('http://127.0.0.1:8000/pair_action', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('bb_token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({target_request_id: id})
                });
                const data = await res.json();
                if(res.ok) alert("✅ Đã gửi tín hiệu ghép cặp thành công! Vui lòng chờ phản hồi.");
                else alert("Lỗi: " + data.detail);
            } catch(e) {
                alert("Lỗi kết nối");
            }
        };
    }
});
