// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://othnmqwbuaytdmhdisju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90aG5tcXdidWF5dGRtaGRpc2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NzA5NzMsImV4cCI6MjEwODA0Njk3M30.OTt0Nm3XKmZzBlvaoKmAXSLcwC9vDlu6EIbvmfVqHgI';

// Avoid collision with window.supabase from the CDN script
const _supabase = (typeof window.supabase !== 'undefined' && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let currentUser = null;
let currentCategory = 'fact';
let currentItem = null;
let savedItems = [];

// --- BOOKMARK LOGIC ---

async function loadBookmarks() {
  if (currentUser && _supabase) {
    try {
      const { data, error } = await _supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        savedItems = data.map(row => ({
          id: row.id,
          title: row.title,
          text: row.body,
          category: row.category
        }));
      }
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
    }
  } else {
    savedItems = JSON.parse(localStorage.getItem('downward_spiral_saved') || '[]');
  }
  updateSavedCount();
}

function updateSavedCount() {
  const countEl = document.getElementById('saved-count');
  if (countEl) countEl.innerText = savedItems.length;
}

function applyTheme(category) {
  const drawerCard = document.querySelector('#result-drawer .drawer-content');
  if (drawerCard) {
    drawerCard.className = 'drawer-content theme-' + (category || 'fact');
  }
}

// --- DRAWER ACTIONS ---

window.openDrawer = function(category) {
  currentCategory = category;
  generateNext();
  applyTheme(category);
  const drawer = document.getElementById('result-drawer');
  if (drawer) drawer.classList.remove('hidden');
};

window.closeDrawer = function() {
  const drawer = document.getElementById('result-drawer');
  if (drawer) drawer.classList.add('hidden');
};

window.generateNext = async function() {
  const tagEl = document.getElementById('drawer-tag');
  const titleEl = document.getElementById('drawer-title');
  const bodyEl = document.getElementById('drawer-body');

  try {
    const response = await fetch(`/api/random?category=${currentCategory}`);
    if (!response.ok) throw new Error('HTTP status ' + response.status);

    const item = await response.json();
    currentItem = item;

    if (tagEl) tagEl.innerText = currentCategory.toUpperCase();
    if (titleEl) titleEl.innerText = item.title;
    if (bodyEl) bodyEl.innerHTML = item.text;

    applyTheme(currentCategory);
    updateSaveBtnState();
  } catch (err) {
    console.error('Could not fetch from server:', err);
    if (titleEl) titleEl.innerText = 'Offline';
    if (bodyEl) bodyEl.innerText = 'Could not reach server. Verify node server.js is running.';
  }
};

function updateSaveBtnState() {
  const btn = document.getElementById('save-btn');
  if (!btn || !currentItem) return;
  const isSaved = savedItems.some(i => i.title === currentItem.title);
  btn.innerText = isSaved ? 'Saved ✓' : 'Save for later';
}

window.toggleSaveCurrent = async function() {
  if (!currentItem) return;

  const existingIndex = savedItems.findIndex(i => i.title === currentItem.title);

  if (currentUser && _supabase) {
    if (existingIndex > -1) {
      const itemToDelete = savedItems[existingIndex];
      await _supabase.from('bookmarks').delete().eq('id', itemToDelete.id);
      savedItems.splice(existingIndex, 1);
    } else {
      const { data, error } = await _supabase.from('bookmarks').insert([{
        user_id: currentUser.id,
        title: currentItem.title,
        category: currentItem.category,
        body: currentItem.text
      }]).select();

      if (!error && data) {
        savedItems.unshift({
          id: data[0].id,
          title: data[0].title,
          text: data[0].body,
          category: data[0].category
        });
      }
    }
  } else {
    if (existingIndex > -1) {
      savedItems.splice(existingIndex, 1);
    } else {
      savedItems.push(currentItem);
    }
    localStorage.setItem('downward_spiral_saved', JSON.stringify(savedItems));
  }

  updateSaveBtnState();
  updateSavedCount();
};

// --- SAVED DRAWER CONTROLLERS ---

window.openSavedItem = function(index) {
  const item = savedItems[index];
  if (!item) return;

  currentItem = item;
  currentCategory = item.category || 'fact';

  const tagEl = document.getElementById('drawer-tag');
  const titleEl = document.getElementById('drawer-title');
  const bodyEl = document.getElementById('drawer-body');

  if (tagEl) tagEl.innerText = (item.category || 'SAVED').toUpperCase();
  if (titleEl) titleEl.innerText = item.title;
  if (bodyEl) bodyEl.innerHTML = item.text;

  applyTheme(item.category || 'fact');
  updateSaveBtnState();
  window.closeSavedDrawer();

  const resultDrawer = document.getElementById('result-drawer');
  if (resultDrawer) resultDrawer.classList.remove('hidden');
};

window.closeSavedDrawer = function() {
  const savedDrawer = document.getElementById('saved-drawer');
  if (savedDrawer) savedDrawer.classList.add('hidden');
};

window.deleteSavedItem = async function(event, index) {
  event.stopPropagation();
  const item = savedItems[index];

  if (currentUser && _supabase && item && item.id) {
    await _supabase.from('bookmarks').delete().eq('id', item.id);
  }

  savedItems.splice(index, 1);
  if (!currentUser) {
    localStorage.setItem('downward_spiral_saved', JSON.stringify(savedItems));
  }

  updateSavedCount();
  updateSaveBtnState();

  const listEl = document.getElementById('saved-list');
  if (!listEl) return;
  if (savedItems.length === 0) {
    listEl.innerHTML = '<p class="empty-msg">No items saved yet. Start tumbling down!</p>';
  } else {
    listEl.innerHTML = savedItems.map((item, i) => `
      <div class="saved-card-item theme-${item.category || 'fact'}" data-index="${i}">
        <div class="saved-item-header">
          <span class="saved-category-pill">${(item.category || 'ITEM').toUpperCase()}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="saved-delete-btn" title="Remove" onclick="window.deleteSavedItem(event, ${i})">&times;</button>
            <span class="saved-arrow">View &rarr;</span>
          </div>
        </div>
        <h4>${item.title}</h4>
      </div>
    `).join('');
  }
};

// Saved navigation tab click
const savedTabBtn = document.getElementById('saved-tab-btn');
if (savedTabBtn) {
  savedTabBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const listEl = document.getElementById('saved-list');
    if (!listEl) return;

    if (savedItems.length === 0) {
      listEl.innerHTML = '<p class="empty-msg">No items saved yet. Start tumbling down!</p>';
    } else {
      listEl.innerHTML = savedItems.map((item, index) => `
        <div class="saved-card-item theme-${item.category || 'fact'}" data-index="${index}">
          <div class="saved-item-header">
            <span class="saved-category-pill">${(item.category || 'ITEM').toUpperCase()}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="saved-delete-btn" title="Remove" onclick="window.deleteSavedItem(event, ${index})">&times;</button>
              <span class="saved-arrow">View &rarr;</span>
            </div>
          </div>
          <h4>${item.title}</h4>
        </div>
      `).join('');
    }

    const savedDrawer = document.getElementById('saved-drawer');
    if (savedDrawer) savedDrawer.classList.remove('hidden');
  });
}

// Event Delegation for clicking a saved card
const savedListContainer = document.getElementById('saved-list');
if (savedListContainer) {
  savedListContainer.addEventListener('click', (e) => {
    if (e.target.closest('.saved-delete-btn')) return;
    const card = e.target.closest('.saved-card-item');
    if (card) {
      const index = parseInt(card.getAttribute('data-index'), 10);
      if (!isNaN(index)) {
        window.openSavedItem(index);
      }
    }
  });
}

// --- AUTH CONTROLLERS ---

window.openAuthModal = function() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeAuthModal = function() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
};

window.handleMagicLinkLogin = async function() {
  const emailInput = document.getElementById('auth-email');
  const statusMsg = document.getElementById('auth-status-msg');
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email || !email.includes('@')) {
    if (statusMsg) statusMsg.innerText = 'Please enter a valid email address.';
    return;
  }

  if (statusMsg) statusMsg.innerText = 'Sending magic link...';

  if (!_supabase) {
    if (statusMsg) statusMsg.innerText = 'Supabase client failed to initialize.';
    return;
  }

  const { error } = await _supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin
    }
  });

  if (error) {
    if (statusMsg) statusMsg.innerText = error.message;
  } else {
    if (statusMsg) statusMsg.innerText = 'Check your email for the login link! ✉️';
  }
};

window.handleLogout = async function() {
  if (_supabase) await _supabase.auth.signOut();
  currentUser = null;
  updateAuthUI();
  await loadBookmarks();
  window.closeAuthModal();
};

function updateAuthUI() {
  const authBtn = document.getElementById('auth-btn');
  const loggedOutView = document.getElementById('auth-logged-out-view');
  const loggedInView = document.getElementById('auth-logged-in-view');
  const emailDisplay = document.getElementById('user-email-display');

  if (currentUser) {
    if (authBtn) authBtn.innerText = 'My Account';
    if (loggedOutView) loggedOutView.classList.add('hidden');
    if (loggedInView) loggedInView.classList.remove('hidden');
    if (emailDisplay) emailDisplay.innerText = currentUser.email;
  } else {
    if (authBtn) authBtn.innerText = 'Log in / Sign up';
    if (loggedOutView) loggedOutView.classList.remove('hidden');
    if (loggedInView) loggedInView.classList.add('hidden');
  }
}

// --- GLOBAL EVENT LISTENERS ---

window.addEventListener('keydown', (e) => {
  const resultDrawer = document.getElementById('result-drawer');
  const savedDrawer = document.getElementById('saved-drawer');
  const authModal = document.getElementById('auth-modal');

  const isResultOpen = resultDrawer && !resultDrawer.classList.contains('hidden');
  const isSavedOpen = savedDrawer && !savedDrawer.classList.contains('hidden');
  const isAuthOpen = authModal && !authModal.classList.contains('hidden');

  if (e.key === 'Escape') {
    if (isResultOpen) window.closeDrawer();
    if (isSavedOpen) window.closeSavedDrawer();
    if (isAuthOpen) window.closeAuthModal();
  } else if (e.key === ' ' && isResultOpen) {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      window.generateNext();
    }
  }
});

// Backdrop click dismissals
[
  document.getElementById('result-drawer'),
  document.getElementById('saved-drawer'),
  document.getElementById('auth-modal')
].forEach(drawer => {
  if (drawer) {
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) {
        drawer.classList.add('hidden');
      }
    });
  }
});

// Initialization
if (_supabase) {
  _supabase.auth.getSession().then(({ data: { session } }) => {
    currentUser = session ? session.user : null;
    updateAuthUI();
    loadBookmarks();
  });

  _supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    updateAuthUI();
    loadBookmarks();
  });
} else {
  loadBookmarks();
}