<script type="text/javascript">
	(function () {
	  'use strict';
	
	  const FEED_ID = '107032';
	  const BOX_ID = 'dy-completion-status-box';
	  const REFRESH_MS = 30000;
	  const STORAGE_KEY = 'dy-completion-box-position';
	
	  let closedUntilReload = false;
	
	  function ensureBox() {
	    if (!document.body) return null;
	
	    let box = document.getElementById(BOX_ID);
	    if (!box) {
	      box = document.createElement('div');
	      box.id = BOX_ID;
	
	      box.style.cssText = `
	        position: fixed;
	        bottom: 12px;
	        right: 12px;
	        z-index: 999999;
	        background: rgba(31, 36, 48, 0.96);
	        color: #fff;
	        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
	        font-size: 12px;
	        border-radius: 999px;
	        box-shadow: 0 2px 10px rgba(0,0,0,0.28);
	        line-height: 1;
	        overflow: hidden;
	        white-space: nowrap;
	      `;
	
	      document.body.appendChild(box);
	      applySavedPosition(box);
	      makeDraggable(box);
	    }
	
	    return box;
	  }
	
	  function applySavedPosition(box) {
	    try {
	      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
	      if (typeof saved.left === 'number' && typeof saved.top === 'number') {
	        box.style.left = saved.left + 'px';
	        box.style.top = saved.top + 'px';
	        box.style.right = 'auto';
	        box.style.bottom = 'auto';
	      }
	    } catch (e) {
	      console.warn('[DY Feed Completion] Could not load saved position', e);
	    }
	  }
	
	  function savePosition(left, top) {
	    try {
	      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top }));
	    } catch (e) {
	      console.warn('[DY Feed Completion] Could not save position', e);
	    }
	  }
	
	  function closeBox() {
	    closedUntilReload = true;
	    const box = document.getElementById(BOX_ID);
	    if (box) {
	      box.style.display = 'none';
	    }
	  }
	
	  function makeDraggable(box) {
	    let isDragging = false;
	    let offsetX = 0;
	    let offsetY = 0;
	
	    function onMouseDown(e) {
	      if (!e.target.closest('.dy-box-handle')) return;
	      if (e.target.closest('.dy-box-close')) return;
	
	      isDragging = true;
	
	      const rect = box.getBoundingClientRect();
	      offsetX = e.clientX - rect.left;
	      offsetY = e.clientY - rect.top;
	
	      box.style.left = rect.left + 'px';
	      box.style.top = rect.top + 'px';
	      box.style.right = 'auto';
	      box.style.bottom = 'auto';
	
	      document.body.style.userSelect = 'none';
	    }
	
	    function onMouseMove(e) {
	      if (!isDragging) return;
	
	      let newLeft = e.clientX - offsetX;
	      let newTop = e.clientY - offsetY;
	
	      const maxLeft = window.innerWidth - box.offsetWidth;
	      const maxTop = window.innerHeight - box.offsetHeight;
	
	      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
	      newTop = Math.max(0, Math.min(newTop, maxTop));
	
	      box.style.left = newLeft + 'px';
	      box.style.top = newTop + 'px';
	    }
	
	    function onMouseUp() {
	      if (!isDragging) return;
	
	      isDragging = false;
	      document.body.style.userSelect = '';
	
	      const rect = box.getBoundingClientRect();
	      savePosition(rect.left, rect.top);
	    }
	
	    box.addEventListener('mousedown', onMouseDown);
	    document.addEventListener('mousemove', onMouseMove);
	    document.addEventListener('mouseup', onMouseUp);
	
	    box.addEventListener('click', function (e) {
	      if (e.target.closest('.dy-box-close')) {
	        e.preventDefault();
	        e.stopPropagation();
	        closeBox();
	      }
	    });
	  }
	
	  function formatPercent(value) {
	    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
	    return (value > 1 ? value : value * 100).toFixed(0) + '%';
	  }
	
	  function getStatusColor(vit, text) {
	    const values = [vit, text].filter(v => typeof v === 'number');
	    if (!values.length) return '#64748b';
	
	    const min = Math.min(...values);
	    if (min >= 90) return '#16a34a';
	    if (min >= 60) return '#f59e0b';
	    return '#dc2626';
	  }
	
	  async function fetchPercent(field) {
	    const url = `/api/int/data_feeds/${FEED_ID}/completion_rate_by_field/${encodeURIComponent(field)}`;
	    const res = await fetch(url, { credentials: 'include' });
	
	    if (!res.ok) {
	      throw new Error(`${field}: HTTP ${res.status}`);
	    }
	
	    const data = await res.json();
	    return typeof data.percent === 'number' ? data.percent : null;
	  }
	
	  function renderCompact(contentHtml) {
	    const box = ensureBox();
	    if (!box || closedUntilReload) return;
	
	    box.style.display = 'block';
	
	    box.innerHTML = `
	      <div class="dy-box-handle" style="
	        display:flex;
	        align-items:center;
	        gap:8px;
	        padding: 7px 10px;
	        cursor: move;
	      ">
	        ${contentHtml}
	      </div>
	    `;
	  }
	
	  async function updateBox() {
	    if (closedUntilReload) return;
	
	    renderCompact(`
	      <span style="opacity:0.8;">DY</span>
	      <span style="opacity:0.5;">•</span>
	      <span>Loading...</span>
	      <button class="dy-box-close" style="
	        margin-left: 4px;
	        appearance: none;
	        border: 0;
	        background: transparent;
	        color: #fff;
	        font-size: 14px;
	        line-height: 1;
	        cursor: pointer;
	        padding: 0;
	        opacity: 0.7;
	      " title="Close">×</button>
	    `);
	
	    try {
	      const [vit, text] = await Promise.all([
	        fetchPercent('dy_internal_embedding_vit'),
	        fetchPercent('dy_internal_embedding_text')
	      ]);
	
	      const color = getStatusColor(vit, text);
	
	      renderCompact(`
	        <span style="
	          display:inline-block;
	          width:8px;
	          height:8px;
	          border-radius:50%;
	          background:${color};
	          flex: 0 0 auto;
	        "></span>
	        <span style="font-weight:600;">DY</span>
	        <span style="opacity:0.45;">${FEED_ID}</span>
	        <span style="opacity:0.5;">|</span>
	        <span>VIT ${formatPercent(vit)}</span>
	        <span style="opacity:0.5;">|</span>
	        <span>TXT ${formatPercent(text)}</span>
	        <button class="dy-box-close" style="
	          margin-left: 4px;
	          appearance: none;
	          border: 0;
	          background: transparent;
	          color: #fff;
	          font-size: 14px;
	          line-height: 1;
	          cursor: pointer;
	          padding: 0;
	          opacity: 0.7;
	        " title="Close">×</button>
	      `);
	    } catch (err) {
	      console.error('[DY Feed Completion] Fetch failed', err);
	
	      renderCompact(`
	        <span style="
	          display:inline-block;
	          width:8px;
	          height:8px;
	          border-radius:50%;
	          background:#dc2626;
	          flex: 0 0 auto;
	        "></span>
	        <span style="font-weight:600;">DY</span>
	        <span>Fetch failed</span>
	        <button class="dy-box-close" style="
	          margin-left: 4px;
	          appearance: none;
	          border: 0;
	          background: transparent;
	          color: #fff;
	          font-size: 14px;
	          line-height: 1;
	          cursor: pointer;
	          padding: 0;
	          opacity: 0.7;
	        " title="Close">×</button>
	      `);
	    }
	  }
	
	  function init() {
	    updateBox();
	    setInterval(updateBox, REFRESH_MS);
	  }
	
	  if (document.readyState === 'loading') {
	    document.addEventListener('DOMContentLoaded', init);
	  } else {
	    init();
	  }
	})();
</script>
