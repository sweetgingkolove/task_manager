/**
 * Kanso (簡素) Minimalist To-Do List Engine
 * Features: User-Defined Categories, Swipeable Notebook Pages,
 * Contextual Task Assignment, LocalStorage Persistence & Zero Dependencies.
 */

(() => {
  'use strict';

  const STORAGE_TASKS_KEY = 'kanso_tasks_v1';
  const STORAGE_CATS_KEY = 'kanso_categories_v1';

  const DEFAULT_CATEGORIES = [
    { id: 'c_now', name: 'Now', isDefault: false },
    { id: 'c_later', name: 'Later', isDefault: false },
    { id: 'all', name: 'All', isDefault: true }
  ];

  const INITIAL_TASKS = [
    { id: 1, title: 'Morning pour-over & quiet reading', categoryId: 'c_now', tags: ['ritual', 'daily'], completed: true, createdAt: Date.now() - 3600000 },
    { id: 2, title: 'Review architectural specification', categoryId: 'c_now', tags: ['focus', 'architecture'], completed: false, createdAt: Date.now() - 1800000 },
    { id: 3, title: 'Afternoon walking meditation in the park', categoryId: 'c_later', tags: ['wellness'], completed: false, createdAt: Date.now() - 900000 },
    { id: 4, title: 'Draft design system guidelines', categoryId: 'c_later', tags: ['design', 'studio'], completed: false, createdAt: Date.now() }
  ];

  // State
  let categories = loadCategories();
  let tasks = loadTasks();
  let activeCategoryIndex = 0;
  let activeTagFilter = null; // null or 'tagname'
  let activeInlineTagTaskId = null; // taskId currently showing inline tag field
  let editingTaskId = null;
  let isScrollingProgrammatically = false;

  // DOM Elements
  const progressBarEl = document.getElementById('progress-bar');

  const categoryTabsEl = document.getElementById('category-tabs');
  const toggleAddBtn = document.getElementById('toggle-add-btn');
  const closeAddBtn = document.getElementById('close-add-btn');

  const addFormEl = document.getElementById('add-form');
  const taskInputEl = document.getElementById('task-input');
  const tagBarScrollEl = document.getElementById('tag-bar-scroll');
  const clearDoneBtn = document.getElementById('clear-done-btn');

  const pagesCarouselEl = document.getElementById('pages-carousel');

  // Google Drive Sync Elements
  const driveSyncBtn = document.getElementById('drive-sync-btn');
  const driveSyncIndicator = document.getElementById('drive-sync-indicator');
  const driveStatusLabel = document.getElementById('drive-status-label');
  const syncPopover = document.getElementById('sync-popover');
  const syncUserAvatar = document.getElementById('sync-user-avatar');
  const syncUserName = document.getElementById('sync-user-name');
  const syncUserEmail = document.getElementById('sync-user-email');
  const syncPopoverStatus = document.getElementById('sync-popover-status');
  const syncNowBtn = document.getElementById('sync-now-btn');
  const syncSettingsBtn = document.getElementById('sync-settings-btn');
  const syncSignoutBtn = document.getElementById('sync-signout-btn');

  const driveSettingsModal = document.getElementById('drive-settings-modal');
  const driveClientIdInput = document.getElementById('drive-client-id-input');
  const saveDriveClientIdBtn = document.getElementById('save-drive-client-id-btn');
  const cancelDriveModalBtn = document.getElementById('cancel-drive-modal-btn');
  const closeDriveModalBtn = document.getElementById('close-drive-modal-btn');

  // Initialization
  let isInitialized = false;
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    setupEventListeners();
    setupCarouselInteractions();
    renderAll();
    setupDriveSync();
  }

  // Open / Close collapsible Add Task Form
  function openAddForm() {
    if (!addFormEl) return;
    addFormEl.style.display = 'block';
    if (toggleAddBtn) {
      toggleAddBtn.classList.add('active');
      toggleAddBtn.setAttribute('title', 'Close (Escape)');
    }
    taskInputEl.focus();
  }

  function closeAddForm() {
    if (!addFormEl) return;
    addFormEl.style.display = 'none';
    if (toggleAddBtn) {
      toggleAddBtn.classList.remove('active');
      toggleAddBtn.setAttribute('title', 'Add intention (+ or /)');
    }
    taskInputEl.value = '';
  }

  function toggleAddForm() {
    if (!addFormEl) return;
    if (addFormEl.style.display === 'none' || !addFormEl.style.display) {
      openAddForm();
    } else {
      closeAddForm();
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Toggle / Close Add Task Form
    if (toggleAddBtn) {
      toggleAddBtn.addEventListener('click', () => {
        toggleAddForm();
      });
    }

    if (closeAddBtn) {
      closeAddBtn.addEventListener('click', () => {
        closeAddForm();
      });
    }

    // Add task
    addFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawText = taskInputEl.value.trim();
      if (!rawText) return;

      addTask(rawText);
      taskInputEl.value = '';
      closeAddForm();
    });

    // Clear completed
    if (clearDoneBtn) {
      clearDoneBtn.addEventListener('click', () => {
        clearCompleted();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Focus/open input on '/' or '+'
      if (
        (e.key === '/' || (e.key === '+' && !e.ctrlKey && !e.metaKey)) &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA' &&
        !editingTaskId &&
        !activeInlineTagTaskId
      ) {
        e.preventDefault();
        openAddForm();
      }

      // Escape key cancels modal, popover, edit, tag input, or closes add form
      if (e.key === 'Escape') {
        if (driveSettingsModal && driveSettingsModal.style.display !== 'none') {
          closeDriveSettingsModal();
        } else if (syncPopover && syncPopover.style.display !== 'none') {
          closeSyncPopover();
        } else if (activeInlineTagTaskId) {
          activeInlineTagTaskId = null;
          renderPages();
        } else if (editingTaskId) {
          cancelEdit();
        } else if (addFormEl && addFormEl.style.display !== 'none') {
          closeAddForm();
        } else if (document.activeElement === taskInputEl) {
          taskInputEl.blur();
        }
      }

      // Page Navigation with Alt + Left/Right arrows
      if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        if (e.key === 'ArrowRight' && activeCategoryIndex < categories.length - 1) {
          scrollToCategoryIndex(activeCategoryIndex + 1);
        } else if (e.key === 'ArrowLeft' && activeCategoryIndex > 0) {
          scrollToCategoryIndex(activeCategoryIndex - 1);
        }
      }
    });

    // Task Drag and Drop Handling (Desktop HTML5 + Mobile Touch)
    setupTaskDragAndDrop();
  }

  // Drag and Drop Logic
  let draggedTaskId = null;
  let touchDraggedTaskId = null;
  let touchLastTargetItem = null;
  let touchLastInsertBefore = false;

  function clearDragOverClasses() {
    document.querySelectorAll('.task-item').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  }

  function reorderTasks(draggedId, targetId, insertBefore) {
    if (!draggedId || !targetId || draggedId === targetId) return;

    const draggedIndex = tasks.findIndex(t => t.id === draggedId);
    if (draggedIndex === -1) return;

    const [draggedTask] = tasks.splice(draggedIndex, 1);

    const targetIndex = tasks.findIndex(t => t.id === targetId);
    if (targetIndex === -1) {
      tasks.push(draggedTask);
    } else {
      const insertAt = insertBefore ? targetIndex : targetIndex + 1;
      tasks.splice(insertAt, 0, draggedTask);
    }

    saveTasks();
    renderPages();
  }

  function setupTaskDragAndDrop() {
    // Desktop HTML5 Drag and Drop
    pagesCarouselEl.addEventListener('dragstart', (e) => {
      // Don't drag if interactive child elements were clicked
      if (e.target.closest('button, input, select, .task-category-chip, .task-tag-chip')) {
        e.preventDefault();
        return;
      }

      const item = e.target.closest('.task-item');
      if (!item || item.classList.contains('editing')) return;

      draggedTaskId = Number(item.dataset.id);

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(draggedTaskId));
      }

      requestAnimationFrame(() => {
        item.classList.add('is-dragging');
      });
    });

    pagesCarouselEl.addEventListener('dragover', (e) => {
      if (!draggedTaskId) return;
      const item = e.target.closest('.task-item');
      if (!item) return;

      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const targetId = Number(item.dataset.id);
      if (targetId === draggedTaskId) {
        clearDragOverClasses();
        return;
      }

      const rect = item.getBoundingClientRect();
      const isTopHalf = (e.clientY - rect.top) < (rect.height / 2);

      clearDragOverClasses();
      if (isTopHalf) {
        item.classList.add('drag-over-top');
      } else {
        item.classList.add('drag-over-bottom');
      }
    });

    pagesCarouselEl.addEventListener('dragleave', (e) => {
      const item = e.target.closest('.task-item');
      if (item && !item.contains(e.relatedTarget)) {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });

    pagesCarouselEl.addEventListener('drop', (e) => {
      if (!draggedTaskId) return;
      const item = e.target.closest('.task-item');
      if (!item) {
        clearDragOverClasses();
        draggedTaskId = null;
        return;
      }

      e.preventDefault();
      const targetId = Number(item.dataset.id);
      const rect = item.getBoundingClientRect();
      const insertBefore = (e.clientY - rect.top) < (rect.height / 2);

      clearDragOverClasses();
      const fromId = draggedTaskId;
      draggedTaskId = null;

      if (fromId && targetId && fromId !== targetId) {
        reorderTasks(fromId, targetId, insertBefore);
      }
    });

    pagesCarouselEl.addEventListener('dragend', () => {
      draggedTaskId = null;
      document.querySelectorAll('.task-item').forEach(el => {
        el.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom');
      });
    });

    // Mobile / Touch Drag and Drop via .drag-handle
    pagesCarouselEl.addEventListener('touchstart', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const item = handle.closest('.task-item');
      if (!item || item.classList.contains('editing')) return;

      touchDraggedTaskId = Number(item.dataset.id);
      item.classList.add('is-dragging');
    }, { passive: true });

    pagesCarouselEl.addEventListener('touchmove', (e) => {
      if (!touchDraggedTaskId) return;
      const touch = e.touches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const item = targetEl ? targetEl.closest('.task-item') : null;

      clearDragOverClasses();

      if (item && Number(item.dataset.id) !== touchDraggedTaskId) {
        const rect = item.getBoundingClientRect();
        const isTopHalf = (touch.clientY - rect.top) < (rect.height / 2);
        if (isTopHalf) {
          item.classList.add('drag-over-top');
        } else {
          item.classList.add('drag-over-bottom');
        }
        touchLastTargetItem = item;
        touchLastInsertBefore = isTopHalf;
      }
    }, { passive: true });

    pagesCarouselEl.addEventListener('touchend', () => {
      if (!touchDraggedTaskId) return;
      const fromId = touchDraggedTaskId;
      const targetItem = touchLastTargetItem;
      const insertBefore = touchLastInsertBefore;

      touchDraggedTaskId = null;
      touchLastTargetItem = null;

      document.querySelectorAll('.task-item').forEach(el => {
        el.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom');
      });

      if (targetItem) {
        const targetId = Number(targetItem.dataset.id);
        if (fromId && targetId && fromId !== targetId) {
          reorderTasks(fromId, targetId, insertBefore);
        }
      }
    });

    pagesCarouselEl.addEventListener('touchcancel', () => {
      touchDraggedTaskId = null;
      touchLastTargetItem = null;
      document.querySelectorAll('.task-item').forEach(el => {
        el.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom');
      });
    });
  }

  // Carousel Touch & Mouse Drag Handling
  function setupCarouselInteractions() {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    // Mouse drag for desktop users without touch/trackpad
    pagesCarouselEl.addEventListener('mousedown', (e) => {
      // Ignore if clicking on interactive elements
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.task-item')) return;

      isDown = true;
      hasMoved = false;
      pagesCarouselEl.classList.add('is-dragging');
      startX = e.pageX - pagesCarouselEl.offsetLeft;
      scrollLeft = pagesCarouselEl.scrollLeft;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      hasMoved = true;
      const x = e.pageX - pagesCarouselEl.offsetLeft;
      const walk = (x - startX) * 1.3;
      pagesCarouselEl.scrollLeft = scrollLeft - walk;
    });

    window.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      pagesCarouselEl.classList.remove('is-dragging');

      if (hasMoved) {
        // Snap to nearest page
        const width = pagesCarouselEl.clientWidth || 1;
        const targetIdx = Math.round(pagesCarouselEl.scrollLeft / width);
        scrollToCategoryIndex(Math.max(0, Math.min(categories.length - 1, targetIdx)));
      }
    });

    // Scroll listener to sync active tab
    pagesCarouselEl.addEventListener('scroll', () => {
      if (isScrollingProgrammatically) return;

      const width = pagesCarouselEl.clientWidth || 1;
      const newIdx = Math.round(pagesCarouselEl.scrollLeft / width);
      if (newIdx !== activeCategoryIndex && newIdx >= 0 && newIdx < categories.length) {
        activeCategoryIndex = newIdx;
        updateActiveCategoryUI();
      }
    });
  }

  function scrollToCategoryIndex(index) {
    if (index < 0 || index >= categories.length) return;
    activeCategoryIndex = index;
    isScrollingProgrammatically = true;

    const width = pagesCarouselEl.clientWidth;
    pagesCarouselEl.scrollTo({
      left: index * width,
      behavior: 'smooth'
    });

    updateActiveCategoryUI();

    // Reset lock after animation
    setTimeout(() => {
      isScrollingProgrammatically = false;
    }, 450);
  }

  // State Storage
  function loadCategories() {
    try {
      const stored = localStorage.getItem(STORAGE_CATS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 3) {
          const ids = parsed.map(c => c.id);
          if (ids[0] === 'c_now' && ids[1] === 'c_later' && ids[2] === 'all') {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read categories from localStorage', e);
    }
    try {
      localStorage.setItem(STORAGE_CATS_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    } catch (e) {}
    return DEFAULT_CATEGORIES;
  }

  function saveCategories() {
    try {
      localStorage.setItem(STORAGE_CATS_KEY, JSON.stringify(categories));
      localStorage.setItem('kanso_last_local_update', String(Date.now()));
    } catch (e) {
      console.warn('Could not write categories to localStorage', e);
    }
    if (window.DriveSync && window.DriveSync.isConnected()) {
      window.DriveSync.queueSync({ tasks, categories, updatedAt: Date.now() });
    }
  }

  function loadTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_TASKS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Migration: Map old categories ('c_ritual', 'c_work', 'c_studio', etc.) to 'c_now' or 'c_later'
          return parsed.map(t => {
            let catId = t.categoryId;
            if (catId !== 'c_now' && catId !== 'c_later') {
              if (catId === 'c_studio') {
                catId = 'c_later';
              } else {
                catId = 'c_now';
              }
            }
            return {
              ...t,
              categoryId: catId,
              tags: Array.isArray(t.tags) ? t.tags : []
            };
          });
        }
      }
    } catch (e) {
      console.warn('Could not read tasks from localStorage', e);
    }
    return INITIAL_TASKS;
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
      localStorage.setItem('kanso_last_local_update', String(Date.now()));
    } catch (e) {
      console.warn('Could not write tasks to localStorage', e);
    }
    if (window.DriveSync && window.DriveSync.isConnected()) {
      window.DriveSync.queueSync({ tasks, categories, updatedAt: Date.now() });
    }
  }

  // Task Operations
  function addTask(rawText) {
    let cleanTitle = rawText;
    let targetCatId = categories[activeCategoryIndex]?.id || 'c_now';
    const extractedTags = [];

    // Extract all hashtags: e.g. "Order matcha #Later #urgent #daily"
    const hashMatches = Array.from(rawText.matchAll(/#([\w\u4e00-\u9faf-]+)/g));
    if (hashMatches.length > 0) {
      hashMatches.forEach(m => {
        const word = m[1];
        // Check if matches an existing category ("Now" or "Later")
        const catMatch = categories.find(c => c.id !== 'all' && c.name.toLowerCase() === word.toLowerCase());
        if (catMatch) {
          targetCatId = catMatch.id;
        } else {
          const cleanTag = word.toLowerCase();
          if (!extractedTags.includes(cleanTag)) {
            extractedTags.push(cleanTag);
          }
        }
        cleanTitle = cleanTitle.replace(m[0], '').trim();
      });
    }

    if (targetCatId === 'all') {
      targetCatId = 'c_now';
    }

    const newTask = {
      id: Date.now(),
      title: cleanTitle || rawText,
      categoryId: targetCatId,
      tags: extractedTags,
      completed: false,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks();
    renderAll();
  }

  function toggleTask(id) {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasks();
    renderAll();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderAll();
  }

  function startEdit(id) {
    editingTaskId = id;
    renderPages();
    const editInput = document.getElementById(`edit-input-${id}`);
    if (editInput) {
      editInput.focus();
      editInput.select();
    }
  }

  function saveEdit(id, newTitle, newCategoryId, tagsInputVal) {
    const trimmed = newTitle.trim();
    if (trimmed) {
      let catId = newCategoryId;
      let finalTitle = trimmed;
      let tagsList = null;

      if (typeof tagsInputVal === 'string') {
        tagsList = tagsInputVal
          .split(/[,#\s]+/)
          .map(t => t.trim().toLowerCase())
          .filter(t => t.length > 0);
        tagsList = Array.from(new Set(tagsList));
      }

      // Inline hashtag check during edit: e.g. "Draft spec #Work"
      const hashMatch = trimmed.match(/#([\w\u4e00-\u9faf-]+)/);
      if (hashMatch) {
        const tagName = hashMatch[1];
        finalTitle = trimmed.replace(hashMatch[0], '').trim();
        const found = categories.find(c => c.name.toLowerCase() === tagName.toLowerCase());
        if (found) {
          catId = found.id;
        } else {
          // If not category, add to tags
          if (tagsList === null) {
            tagsList = tasks.find(t => t.id === id)?.tags ? [...tasks.find(t => t.id === id).tags] : [];
          }
          if (!tagsList.includes(tagName.toLowerCase())) {
            tagsList.push(tagName.toLowerCase());
          }
        }
      }

      tasks = tasks.map(t => {
        if (t.id === id) {
          return {
            ...t,
            title: finalTitle || trimmed,
            categoryId: catId || t.categoryId,
            tags: tagsList !== null ? tagsList : (t.tags || [])
          };
        }
        return t;
      });
      saveTasks();
    } else {
      deleteTask(id);
    }
    editingTaskId = null;
    renderAll();
  }

  function setTaskCategory(taskId, newCategoryId) {
    tasks = tasks.map(t => t.id === taskId ? { ...t, categoryId: newCategoryId } : t);
    saveTasks();
    renderAll();
  }

  // Tag Operations
  function addTagToTask(taskId, tagString) {
    const cleanTag = tagString.trim().toLowerCase().replace(/^#/, '');
    if (!cleanTag) return;
    tasks = tasks.map(t => {
      if (t.id === taskId) {
        const existingTags = t.tags || [];
        if (!existingTags.includes(cleanTag)) {
          return { ...t, tags: [...existingTags, cleanTag] };
        }
      }
      return t;
    });
    saveTasks();
    renderAll();
  }

  function removeTagFromTask(taskId, tagString) {
    tasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          tags: (t.tags || []).filter(tag => tag.toLowerCase() !== tagString.toLowerCase())
        };
      }
      return t;
    });
    saveTasks();
    renderAll();
  }

  function filterByTag(tagString) {
    const clean = tagString.toLowerCase().replace(/^#/, '');
    if (activeTagFilter === clean) {
      activeTagFilter = null; // Toggle off if already active
    } else {
      activeTagFilter = clean;
    }
    renderAll();
  }

  function clearTagFilter() {
    activeTagFilter = null;
    renderAll();
  }

  // Floating Category Picker
  let activePickerTaskId = null;
  const categoryPickerEl = document.getElementById('category-picker');
  const pickerListEl = document.getElementById('picker-list');

  function openCategoryPicker(taskId, event) {
    event.stopPropagation();
    activePickerTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !categoryPickerEl || !pickerListEl) return;

    const availableCats = categories.filter(c => c.id !== 'all');
    pickerListEl.innerHTML = availableCats.map(c => {
      const isSelected = c.id === task.categoryId;
      return `
        <button
          type="button"
          class="picker-item ${isSelected ? 'active' : ''}"
          onclick="window.Kanso.assignCategory('${c.id}')"
        >
          <span>${escapeHtml(c.name)}</span>
          ${isSelected ? '<span class="picker-check">✓</span>' : ''}
        </button>
      `;
    }).join('');

    categoryPickerEl.style.display = 'block';

    const rect = event.currentTarget.getBoundingClientRect();
    const popoverWidth = 150;
    let leftPos = rect.left;
    if (leftPos + popoverWidth > window.innerWidth - 12) {
      leftPos = rect.right - popoverWidth;
    }

    categoryPickerEl.style.top = `${rect.bottom + window.scrollY + 6}px`;
    categoryPickerEl.style.left = `${Math.max(12, leftPos)}px`;
  }

  function closeCategoryPicker() {
    activePickerTaskId = null;
    if (categoryPickerEl) {
      categoryPickerEl.style.display = 'none';
    }
  }

  // Close picker on outside click or escape
  document.addEventListener('click', (e) => {
    if (categoryPickerEl && categoryPickerEl.style.display === 'block') {
      if (!categoryPickerEl.contains(e.target) && !e.target.closest('.task-category-chip')) {
        closeCategoryPicker();
      }
    }
  });

  function cancelEdit() {
    editingTaskId = null;
    renderPages();
  }

  function clearCompleted() {
    const currentCat = categories[activeCategoryIndex];
    if (currentCat.id === 'all') {
      tasks = tasks.filter(t => !t.completed);
    } else {
      tasks = tasks.filter(t => !(t.categoryId === currentCat.id && t.completed));
    }
    saveTasks();
    renderAll();
  }

  // Rendering
  function renderAll() {
    renderCategoryTabs();
    renderTagBar();
    renderPages();
    updateProgressAndCounts();
    updateActiveCategoryUI();
  }

  function renderCategoryTabs() {
    categoryTabsEl.innerHTML = categories.map((cat, idx) => {
      let catTasks = tasks;
      if (cat.id !== 'all') {
        catTasks = tasks.filter(t => t.categoryId === cat.id);
      }
      if (activeTagFilter) {
        catTasks = catTasks.filter(t => (t.tags || []).some(tag => tag.toLowerCase() === activeTagFilter));
      }
      const count = catTasks.length;

      const titleAttr = cat.id !== 'all'
        ? `${cat.name} Intentions`
        : 'All Intentions';

      return `
        <button
          type="button"
          class="category-tab ${idx === activeCategoryIndex ? 'active' : ''}"
          onclick="window.Kanso.goToPage(${idx})"
          id="cat-tab-${cat.id}"
          title="${titleAttr}"
        >
          <span>${escapeHtml(cat.name)}</span>
          <span class="tab-badge">${count}</span>
        </button>
      `;
    }).join('');
  }

  function renderTagBar() {
    if (!tagBarScrollEl) return;
    const tagCounts = {};
    tasks.forEach(t => {
      (t.tags || []).forEach(tag => {
        const clean = tag.toLowerCase();
        tagCounts[clean] = (tagCounts[clean] || 0) + 1;
      });
    });

    const tagEntries = Object.entries(tagCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

    const isAllActive = !activeTagFilter;
    let html = `
      <button
        type="button"
        class="tag-filter-btn ${isAllActive ? 'active' : ''}"
        onclick="window.Kanso.clearTagFilter()"
        title="Show all intentions"
      >
        <span>All</span>
        <span class="tag-filter-count">${tasks.length}</span>
      </button>
    `;

    if (tagEntries.length === 0) {
      html += `<span class="tag-bar-empty-hint">No tags yet — add with #tag or ＋tag</span>`;
    } else {
      html += tagEntries.map(([tag, count]) => {
        const isActive = activeTagFilter === tag;
        return `
          <button
            type="button"
            class="tag-filter-btn ${isActive ? 'active' : ''}"
            onclick="window.Kanso.filterByTag('${escapeHtml(tag)}', event)"
            title="Filter by #${escapeHtml(tag)}"
          >
            <span>#${escapeHtml(tag)}</span>
            <span class="tag-filter-count">${count}</span>
          </button>
        `;
      }).join('');
    }

    tagBarScrollEl.innerHTML = html;
  }

  function updateActiveCategoryUI() {
    const activeCat = categories[activeCategoryIndex] || categories[0];

    // Update Category Tabs active state
    document.querySelectorAll('.category-tab').forEach((tab, idx) => {
      tab.classList.toggle('active', idx === activeCategoryIndex);
    });

    // Ensure active tab is scrolled into view in horizontal nav
    const activeTabEl = document.getElementById(`cat-tab-${activeCat.id}`);
    if (activeTabEl) {
      activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Contextual Placeholder
    if (activeCat.id === 'all') {
      taskInputEl.placeholder = 'Write intention or task... (e.g. #Later)';
    } else {
      taskInputEl.placeholder = `Add intention to ${activeCat.name}...`;
    }
  }

  function renderPages() {
    const prevScrollLeft = pagesCarouselEl.scrollLeft;
    pagesCarouselEl.innerHTML = categories.map((cat, catIdx) => {
      // Filter tasks for this category
      let catTasks = tasks;
      if (cat.id !== 'all') {
        catTasks = tasks.filter(t => t.categoryId === cat.id);
      }

      // Filter by active tag if set
      if (activeTagFilter) {
        catTasks = catTasks.filter(t => (t.tags || []).some(tag => tag.toLowerCase() === activeTagFilter));
      }

      let contentHTML = '';

      if (catTasks.length === 0) {
        let emptyPrompt = 'All intentions fulfilled.';
        let emptySub = 'Quiet mind, clear horizon.';
        if (activeTagFilter) {
          emptyPrompt = `No intentions tagged #${escapeHtml(activeTagFilter)} in ${escapeHtml(cat.name)}.`;
          emptySub = 'Click "All" in the tag bar above, or swipe to another page.';
        } else if (cat.id === 'all') {
          emptyPrompt = 'All intentions fulfilled.';
          emptySub = 'Quiet mind, clear horizon.';
        } else {
          emptyPrompt = `"${escapeHtml(cat.name)}" is clear.`;
          emptySub = 'Add an intention above to begin.';
        }

        contentHTML = `
          <div class="empty-state">
            <p class="empty-prompt">${emptyPrompt}</p>
            <span class="empty-sub">${emptySub}</span>
          </div>
        `;
      } else {
        const listItemsHTML = catTasks.map(t => {
          const isEditing = editingTaskId === t.id;
          const taskCat = categories.find(c => c.id === t.categoryId);
          const catName = taskCat ? taskCat.name : 'Now';
          const taskTags = t.tags || [];
          const isInlineTagOpen = activeInlineTagTaskId === t.id;

          if (isEditing) {
            return `
              <li class="task-item editing" data-id="${t.id}">
                <div class="task-edit-container">
                  <div class="task-edit-row">
                    <input
                      type="text"
                      class="task-edit-input"
                      id="edit-input-${t.id}"
                      value="${escapeHtml(t.title)}"
                      placeholder="Task title..."
                      aria-label="Edit task title"
                    />
                    <select class="task-edit-select" id="edit-select-${t.id}" aria-label="Select chapter">
                      ${categories.filter(c => c.id !== 'all').map(c => `
                        <option value="${c.id}" ${c.id === t.categoryId ? 'selected' : ''}>
                          ${escapeHtml(c.name)}
                        </option>
                      `).join('')}
                    </select>
                    <button type="button" class="task-edit-save-btn" onclick="window.Kanso.submitEdit(${t.id})">
                      Save
                    </button>
                  </div>
                  <div class="task-edit-tags-row">
                    <span class="edit-tags-label font-serif">Tags:</span>
                    <input
                      type="text"
                      class="task-edit-tags-input"
                      id="edit-tags-${t.id}"
                      value="${taskTags.join(', ')}"
                      placeholder="e.g. urgent, reading, deep-work (comma-separated)..."
                      aria-label="Edit tags"
                    />
                  </div>
                </div>
              </li>
            `;
          }

          const tagsHTML = `
            <div class="task-tags-row" onclick="event.stopPropagation()">
              ${taskTags.map(tag => `
                <span class="task-tag-chip" onclick="window.Kanso.filterByTag('${escapeHtml(tag)}', event)" title="Filter by #${escapeHtml(tag)}">
                  #${escapeHtml(tag)}
                  <span class="tag-del" onclick="window.Kanso.removeTag(${t.id}, '${escapeHtml(tag)}', event)" title="Remove tag">×</span>
                </span>
              `).join('')}
              ${isInlineTagOpen ? `
                <form onsubmit="event.preventDefault(); window.Kanso.saveInlineTag(${t.id}, document.getElementById('inline-tag-${t.id}').value);" class="inline-tag-form" onclick="event.stopPropagation()">
                  <input
                    type="text"
                    id="inline-tag-${t.id}"
                    class="inline-tag-input"
                    placeholder="tag..."
                    maxlength="20"
                    autofocus
                    onkeydown="if(event.key==='Escape'){event.preventDefault();event.stopPropagation();window.Kanso.cancelInlineTag(event);}"
                  />
                  <button type="submit" class="inline-tag-save-btn">✓</button>
                  <button type="button" class="inline-tag-cancel-btn" onclick="window.Kanso.cancelInlineTag(event)">✕</button>
                </form>
              ` : `
                <button type="button" class="add-tag-inline-btn" onclick="window.Kanso.startInlineTag(${t.id}, event)" title="Add tag">
                  ＋tag
                </button>
              `}
            </div>
          `;

          return `
            <li class="task-item ${t.completed ? 'completed' : ''}" data-id="${t.id}" draggable="true">
              <div class="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
                <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                  <circle cx="2.5" cy="2.5" r="1.2" />
                  <circle cx="7.5" cy="2.5" r="1.2" />
                  <circle cx="2.5" cy="7" r="1.2" />
                  <circle cx="7.5" cy="7" r="1.2" />
                  <circle cx="2.5" cy="11.5" r="1.2" />
                  <circle cx="7.5" cy="11.5" r="1.2" />
                </svg>
              </div>
              <div class="task-left" onclick="window.Kanso.toggle(${t.id})" role="checkbox" aria-checked="${t.completed}" tabindex="0">
                <div class="kanso-checkbox">
                  <svg class="check-icon" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div class="task-content-group">
                  <div class="task-title" ondblclick="window.Kanso.edit(${t.id}, event)">
                    ${escapeHtml(t.title)}
                  </div>
                  ${tagsHTML}
                </div>
              </div>
              <div class="task-actions">
                <button
                  type="button"
                  class="task-category-chip"
                  onclick="window.Kanso.openPicker(${t.id}, event)"
                  title="Change chapter"
                  aria-label="Change chapter"
                >
                  <span>${escapeHtml(catName)}</span>
                  <span class="chip-caret">▾</span>
                </button>
                <button
                  type="button"
                  class="delete-btn"
                  onclick="window.Kanso.remove(${t.id}, event)"
                  aria-label="Delete task"
                  title="Delete task"
                >
                  ✕
                </button>
              </div>
            </li>
          `;
        }).join('');

        contentHTML = `<ul class="task-list" role="list">${listItemsHTML}</ul>`;
      }

      return `
        <div class="category-page" id="page-${cat.id}" data-category-id="${cat.id}">
          ${contentHTML}
        </div>
      `;
    }).join('');

    // Attach inline edit handlers if active
    if (editingTaskId) {
      const input = document.getElementById(`edit-input-${editingTaskId}`);
      const select = document.getElementById(`edit-select-${editingTaskId}`);
      const tagsInput = document.getElementById(`edit-tags-${editingTaskId}`);

      const handleKey = (e) => {
        if (e.key === 'Enter') {
          saveEdit(
            editingTaskId,
            input.value,
            select ? select.value : undefined,
            tagsInput ? tagsInput.value : undefined
          );
        } else if (e.key === 'Escape') {
          cancelEdit();
        }
      };

      if (input) input.addEventListener('keydown', handleKey);
      if (tagsInput) tagsInput.addEventListener('keydown', handleKey);
    }

    // Restore carousel scroll position
    if (pagesCarouselEl && prevScrollLeft !== undefined && pagesCarouselEl.scrollLeft !== prevScrollLeft) {
      pagesCarouselEl.scrollLeft = prevScrollLeft;
    }
  }

  function updateProgressAndCounts() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (progressBarEl) {
      progressBarEl.style.width = `${pct}%`;
    }
  }

  // Security Helper
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Global window API for inline callbacks
  window.Kanso = {
    toggle: (id) => toggleTask(id),
    remove: (id, e) => {
      if (e) e.stopPropagation();
      deleteTask(id);
    },
    edit: (id, e) => {
      if (e) e.stopPropagation();
      startEdit(id);
    },
    submitEdit: (id) => {
      const input = document.getElementById(`edit-input-${id}`);
      const select = document.getElementById(`edit-select-${id}`);
      const tagsInput = document.getElementById(`edit-tags-${id}`);
      if (input) {
        saveEdit(
          id,
          input.value,
          select ? select.value : undefined,
          tagsInput ? tagsInput.value : undefined
        );
      }
    },
    openPicker: (id, e) => openCategoryPicker(id, e),
    toggleCategory: (id, e) => {
      if (e) e.stopPropagation();
      const task = tasks.find(t => t.id === id);
      if (task) {
        const nextCat = task.categoryId === 'c_now' ? 'c_later' : 'c_now';
        setTaskCategory(id, nextCat);
      }
    },
    assignCategory: (catId) => {
      if (activePickerTaskId) {
        setTaskCategory(activePickerTaskId, catId);
        closeCategoryPicker();
      }
    },
    goToPage: (idx) => scrollToCategoryIndex(idx),
    filterByTag: (tag, e) => {
      if (e) e.stopPropagation();
      filterByTag(tag);
    },
    removeTag: (id, tag, e) => {
      if (e) e.stopPropagation();
      removeTagFromTask(id, tag);
    },
    startInlineTag: (id, e) => {
      if (e) e.stopPropagation();
      activeInlineTagTaskId = id;
      renderPages();
      const inp = document.getElementById(`inline-tag-${id}`);
      if (inp) {
        inp.focus();
      }
    },
    saveInlineTag: (id, val) => {
      addTagToTask(id, val);
      activeInlineTagTaskId = null;
    },
    cancelInlineTag: (e) => {
      if (e) e.stopPropagation();
      activeInlineTagTaskId = null;
      renderPages();
    },
    clearTagFilter: () => clearTagFilter()
  };

  // ========================================================
  // Google Drive Cloud Sync Integration
  // ========================================================
  function setupDriveSync() {
    if (!window.DriveSync) return;

    window.DriveSync.init({
      onStatusChange: handleDriveStatusChange,
      onRemoteData: handleRemoteDriveData
    });

    if (driveSyncBtn) {
      driveSyncBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clientId = window.DriveSync ? window.DriveSync.getClientId() : '';
        if (!clientId) {
          openDriveSettingsModal();
        } else {
          toggleSyncPopover();
        }
      });
    }

    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', () => {
        const status = window.DriveSync.getStatus();
        if (status === 'unconfigured') {
          closeSyncPopover();
          openDriveSettingsModal();
        } else if (status === 'disconnected') {
          closeSyncPopover();
          window.DriveSync.connect();
        } else {
          window.DriveSync.syncNow();
        }
      });
    }

    if (syncSettingsBtn) {
      syncSettingsBtn.addEventListener('click', () => {
        closeSyncPopover();
        openDriveSettingsModal();
      });
    }

    if (syncSignoutBtn) {
      syncSignoutBtn.addEventListener('click', () => {
        closeSyncPopover();
        window.DriveSync.disconnect();
      });
    }

    // Modal Events
    if (closeDriveModalBtn) {
      closeDriveModalBtn.addEventListener('click', closeDriveSettingsModal);
    }

    if (cancelDriveModalBtn) {
      cancelDriveModalBtn.addEventListener('click', closeDriveSettingsModal);
    }

    if (saveDriveClientIdBtn) {
      saveDriveClientIdBtn.addEventListener('click', () => {
        const id = driveClientIdInput ? driveClientIdInput.value.trim() : '';
        if (id) {
          window.DriveSync.setClientId(id);
          closeDriveSettingsModal();
          window.DriveSync.connect();
        }
      });
    }

    if (driveSettingsModal) {
      driveSettingsModal.addEventListener('click', (e) => {
        if (e.target === driveSettingsModal) {
          closeDriveSettingsModal();
        }
      });
    }

    // Close popover on click outside
    document.addEventListener('click', (e) => {
      if (syncPopover && syncPopover.style.display !== 'none') {
        if (!syncPopover.contains(e.target) && !driveSyncBtn.contains(e.target)) {
          closeSyncPopover();
        }
      }
    });
  }

  function handleDriveStatusChange({ status, detail, user, lastSync, clientId }) {
    if (!driveSyncBtn) return;

    driveSyncBtn.classList.remove('synced', 'syncing', 'error');

    if (status === 'unconfigured') {
      driveSyncIndicator.style.backgroundColor = 'var(--text-subtle)';
      driveStatusLabel.textContent = 'Drive';
      driveSyncBtn.setAttribute('title', 'Connect Google Drive (Click to configure)');
      if (syncPopoverStatus) syncPopoverStatus.textContent = 'Setup required: enter Google OAuth Client ID.';
      if (syncSignoutBtn) syncSignoutBtn.style.display = 'none';
      if (syncNowBtn) syncNowBtn.textContent = 'Setup Drive';
    } else if (status === 'disconnected') {
      driveSyncIndicator.style.backgroundColor = 'var(--text-subtle)';
      driveStatusLabel.textContent = 'Connect';
      driveSyncBtn.setAttribute('title', 'Click to connect Google Drive');
      if (syncPopoverStatus) syncPopoverStatus.textContent = 'Disconnected. Tasks saved locally.';
      if (syncSignoutBtn) syncSignoutBtn.style.display = 'none';
      if (syncNowBtn) syncNowBtn.textContent = 'Connect Drive';
    } else if (status === 'connecting' || status === 'syncing') {
      driveSyncBtn.classList.add('syncing');
      driveStatusLabel.textContent = 'Syncing...';
      driveSyncBtn.setAttribute('title', 'Syncing with Google Drive...');
      if (syncPopoverStatus) syncPopoverStatus.textContent = 'Syncing tasks with Google Drive...';
    } else if (status === 'synced') {
      driveSyncBtn.classList.add('synced');
      driveStatusLabel.textContent = 'Synced';
      const syncTimeStr = lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now';
      driveSyncBtn.setAttribute('title', `Synced to Google Drive (${syncTimeStr})`);
      if (syncPopoverStatus) syncPopoverStatus.textContent = `All tasks saved in Google Drive (${syncTimeStr}).`;
      if (syncSignoutBtn) syncSignoutBtn.style.display = 'block';
      if (syncNowBtn) syncNowBtn.textContent = 'Sync Now';
    } else if (status === 'error') {
      driveSyncBtn.classList.add('error');
      driveStatusLabel.textContent = 'Error';
      driveSyncBtn.setAttribute('title', detail || 'Google Drive sync error');
      if (syncPopoverStatus) syncPopoverStatus.textContent = detail ? `Sync error: ${detail}` : 'Could not reach Google Drive.';
    } else if (status === 'offline') {
      driveSyncIndicator.style.backgroundColor = 'var(--accent-highlight)';
      driveStatusLabel.textContent = 'Offline';
      driveSyncBtn.setAttribute('title', 'Offline. Changes saved locally.');
      if (syncPopoverStatus) syncPopoverStatus.textContent = 'Device is offline. Changes saved locally.';
    }

    // Update User info in popover
    if (user && user.email) {
      if (syncUserName) syncUserName.textContent = user.name || 'Google Account';
      if (syncUserEmail) syncUserEmail.textContent = user.email;
      if (syncUserAvatar) {
        if (user.picture) {
          syncUserAvatar.innerHTML = `<img src="${user.picture}" alt="${escapeHtml(user.name)}" />`;
        } else {
          syncUserAvatar.textContent = (user.name || user.email || 'G').charAt(0).toUpperCase();
        }
      }
    } else {
      if (syncUserName) syncUserName.textContent = 'Google Drive';
      if (syncUserEmail) syncUserEmail.textContent = clientId ? 'Not connected' : 'Not configured';
      if (syncUserAvatar) syncUserAvatar.textContent = 'G';
    }
  }

  function handleRemoteDriveData(remoteData) {
    if (!remoteData || !Array.isArray(remoteData.tasks)) return;

    const remoteTasks = remoteData.tasks;
    if (remoteTasks.length > 0) {
      const localUpdate = Number(localStorage.getItem('kanso_last_local_update')) || 0;
      const remoteUpdate = Number(remoteData.updatedAt) || 0;

      // Only override if remote is newer or local is initial default
      if (remoteUpdate >= localUpdate || tasks === INITIAL_TASKS) {
        tasks = remoteTasks;
        if (Array.isArray(remoteData.categories) && remoteData.categories.length === 3) {
          categories = remoteData.categories;
          try {
            localStorage.setItem(STORAGE_CATS_KEY, JSON.stringify(categories));
          } catch (e) {}
        }
        try {
          localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
        } catch (e) {}
        renderAll();
      }
    } else if (tasks.length > 0) {
      // Remote was empty, upload local tasks
      window.DriveSync.queueSync({ tasks, categories, updatedAt: Date.now() });
    }
  }

  function toggleSyncPopover() {
    if (!syncPopover) return;
    if (syncPopover.style.display === 'none' || !syncPopover.style.display) {
      syncPopover.style.display = 'block';
    } else {
      closeSyncPopover();
    }
  }

  function closeSyncPopover() {
    if (syncPopover) syncPopover.style.display = 'none';
  }

  function openDriveSettingsModal() {
    if (!driveSettingsModal) return;
    closeSyncPopover();
    if (driveClientIdInput) {
      driveClientIdInput.value = window.DriveSync ? window.DriveSync.getClientId() : '';
    }
    driveSettingsModal.style.display = 'flex';
    if (driveClientIdInput) {
      setTimeout(() => driveClientIdInput.focus(), 50);
    }
  }

  function closeDriveSettingsModal() {
    if (driveSettingsModal) driveSettingsModal.style.display = 'none';
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
