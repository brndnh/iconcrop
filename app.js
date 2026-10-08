(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const ed = $('#editor'), ctx = ed.getContext('2d');
  const out = document.createElement('canvas'); out.width = out.height = 512;
  const octx = out.getContext('2d');
  const MARGIN = 0.08; // editor frame inset, so you can see what's cropped away
  // Prefs key is versioned so changed defaults aren't masked by older saved settings
  const KEY_IMG = 'avatar-check:img', KEY_PREFS = 'avatar-check:prefs:v2';
  try { localStorage.removeItem('avatar-check:prefs'); } catch(e){}

  const st = { img:null, w:0, h:0, z:1, px:0, py:0, shape:'circle', fill:'none', custom:'#2F5BEA',
               name:'Username', handle:'username', bio:'Your bio goes here ✨', mode:'dark', gray:false, square:false, grid:false, view:'preview' };

  const SIZES = [[16,'Browser tab'],[20,'Mentions'],[24,'Reactions'],[32,'Comments'],
                 [40,'Chat headers'],[48,'Notifications'],[64,'Contact cards'],[96,'Profile header'],[160,'Profile page']];
  $('#ladder').innerHTML = SIZES.map(([s,l]) =>
    `<figure><img data-av class="av" style="--s:${s}px" alt=""><figcaption><b>${s}px</b>${l}</figcaption></figure>`).join('');

  // ---------- drawing ----------
  function clampPos(){
    if (!st.img) return;
    const half = Math.min(st.w, st.h) / (2 * st.z);
    st.px = Math.min(Math.max(st.px, half), st.w - half);
    st.py = Math.min(Math.max(st.py, half), st.h - half);
  }
  function fillColor(){ return st.fill === 'custom' ? st.custom : st.fill; }
  function drawImg(c, S, F){
    const f = fillColor();
    if (f !== 'none'){ c.fillStyle = f; c.fillRect(0,0,S,S); }
    if (!st.img) return;
    const k = F / Math.min(st.w, st.h) * st.z;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(st.img, S/2 - st.px*k, S/2 - st.py*k, st.w*k, st.h*k);
  }
  function shapePath(c, x, y, s, shape){
    if (shape === 'circle'){ c.moveTo(x+s, y+s/2); c.arc(x+s/2, y+s/2, s/2, 0, Math.PI*2); }
    else if (shape === 'rounded'){
      const r = s * .22;
      c.moveTo(x+r, y); c.arcTo(x+s, y, x+s, y+s, r); c.arcTo(x+s, y+s, x, y+s, r);
      c.arcTo(x, y+s, x, y, r); c.arcTo(x, y, x+s, y, r); c.closePath();
    } else c.rect(x, y, s, s);
  }
  function drawEditor(){
    const S = ed.width; if (!S) return;
    ctx.clearRect(0,0,S,S);
    const m = S * MARGIN, F = S - 2*m;
    drawImg(ctx, S, F);
    const shape = st.square ? 'square' : st.shape;
    ctx.beginPath(); ctx.rect(0,0,S,S); shapePath(ctx, m, m, F, shape);
    ctx.fillStyle = 'rgba(12,16,28,.58)'; ctx.fill('evenodd');
    if (st.grid) drawGrid(m, F, shape);
    ctx.beginPath(); shapePath(ctx, m, m, F, shape);
    ctx.lineWidth = Math.max(1.5, S/260); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
  }
  // Rule-of-thirds lines plus dashed centre lines, clipped to the crop shape
  function drawGrid(m, F, shape){
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    ctx.save();
    ctx.beginPath(); shapePath(ctx, m, m, F, shape); ctx.clip();
    ctx.lineWidth = Math.max(1, ed.width/400);
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    for (const t of [1/3, 2/3]){ line(m + F*t, m, m + F*t, m + F); line(m, m + F*t, m + F, m + F*t); }
    ctx.setLineDash([ctx.lineWidth * 4, ctx.lineWidth * 4]);
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    line(m + F/2, m, m + F/2, m + F); line(m, m + F/2, m + F, m + F/2);
    ctx.restore();
  }

  let curUrl = null, busy = false, dirty = false, raf = 0;
  function renderOut(){
    if (busy){ dirty = true; return; }
    busy = true;
    octx.clearRect(0,0,512,512);
    drawImg(octx, 512, 512);
    out.toBlob(b => {
      busy = false;
      if (b){
        const u = URL.createObjectURL(b);
        $$('img[data-av]').forEach(i => i.src = u);
        if (curUrl) setTimeout((old => () => URL.revokeObjectURL(old))(curUrl), 500);
        curUrl = u;
      }
      if (dirty){ dirty = false; renderOut(); }
    }, 'image/png');
  }
  function update(){
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { drawEditor(); renderOut(); });
    savePrefs();
  }

  new ResizeObserver(() => {
    const px = Math.round(ed.clientWidth * (window.devicePixelRatio || 1));
    if (px && ed.width !== px){ ed.width = ed.height = px; drawEditor(); }
  }).observe(ed);

  // ---------- persistence (this browser only) ----------
  let saveT = 0;
  function savePrefs(){
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(KEY_PREFS, JSON.stringify({
          z:st.z, fx: st.w ? st.px/st.w : .5, fy: st.h ? st.py/st.h : .5,
          shape:st.shape, fill:st.fill, custom:st.custom, name:st.name, handle:st.handle, bio:st.bio, mode:st.mode, gray:st.gray, square:st.square, grid:st.grid, view:st.view }));
      } catch(e){}
    }, 300);
  }
  function persistImage(im){
    try {
      const max = 1024, r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth*r); c.height = Math.round(im.naturalHeight*r);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      try { localStorage.setItem(KEY_IMG, c.toDataURL('image/png')); }
      catch(e){ localStorage.setItem(KEY_IMG, c.toDataURL('image/jpeg', .88)); }
    } catch(e){}
  }

  // ---------- loading ----------
  function showErr(msg){ const e = $('#err'); e.textContent = msg; e.hidden = !msg; }
  function loadSrc(src, opts = {}){
    const im = new Image();
    im.onload = () => {
      st.img = im; st.w = im.naturalWidth; st.h = im.naturalHeight;
      if (opts.fx != null){ st.px = opts.fx*st.w; st.py = opts.fy*st.h; }
      else { st.z = 1; st.px = st.w/2; st.py = st.h/2; }
      clampPos(); syncZoom();
      if (opts.persist) persistImage(im);
      if (opts.user) $('#hint').textContent = 'Drag to reposition. Pinch or scroll to zoom.';
      showErr('');
      resetHist(opts.user ? 'New Image' : 'Start');
      update();
    };
    im.onerror = () => showErr("That file couldn't be opened. Try a JPG, PNG or WebP.");
    im.src = src;
  }
  function useFile(f){
    if (!f) return;
    if (f.type && !f.type.startsWith('image/')) return showErr('That file isn’t an image. Choose a JPG, PNG or WebP.');
    loadSrc(URL.createObjectURL(f), { persist:true, user:true });
  }
  function sample(){
    const c = document.createElement('canvas'); c.width = c.height = 800;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0,0,0,800);
    sky.addColorStop(0,'#7FB3FF'); sky.addColorStop(1,'#FFD3A3');
    g.fillStyle = sky; g.fillRect(0,0,800,800);
    g.fillStyle = '#FFF3D1'; g.beginPath(); g.arc(520,300,120,0,Math.PI*2); g.fill();
    g.fillStyle = '#3D5A80'; g.beginPath();
    g.moveTo(0,620); g.lineTo(260,380); g.lineTo(470,600); g.lineTo(640,450); g.lineTo(800,590); g.lineTo(800,800); g.lineTo(0,800); g.fill();
    g.fillStyle = '#22324A'; g.beginPath();
    g.moveTo(0,720); g.quadraticCurveTo(400,600,800,700); g.lineTo(800,800); g.lineTo(0,800); g.fill();
    return c.toDataURL('image/png');
  }

  // ---------- gestures ----------
  const pts = new Map(); let pinch0 = null;
  const dist = () => { const [a,b] = [...pts.values()]; return Math.hypot(a.x-b.x, a.y-b.y) || 1; };
  function setZoom(z){ st.z = Math.min(6, Math.max(1, z)); syncZoom(); clampPos(); update(); }
  function syncZoom(){ $('#zoom').value = st.z; $('#zoomVal').textContent = st.z.toFixed(2) + '×'; }
  const zoomLabel = () => `Zoom ${st.z.toFixed(2)}×`;
  const scale = () => ed.clientWidth * (1 - 2*MARGIN) / Math.min(st.w, st.h) * st.z; // screen px per source px
  let gesture = null;
  ed.addEventListener('pointerdown', e => {
    ed.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (pts.size === 2) pinch0 = { d:dist(), z:st.z };
  });
  ed.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !st.img) return;
    const prev = pts.get(e.pointerId), cur = {x:e.clientX, y:e.clientY};
    pts.set(e.pointerId, cur);
    if (pts.size === 1){
      const k = scale();
      st.px -= (cur.x - prev.x) / k; st.py -= (cur.y - prev.y) / k;
      gesture ||= 'move';
      clampPos(); update();
    } else if (pts.size === 2 && pinch0){
      gesture = 'zoom';
      setZoom(pinch0.z * dist() / pinch0.d);
    }
  });
  const end = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null;
    if (!pts.size && gesture){ record(gesture === 'zoom' ? zoomLabel() : 'Move'); gesture = null; }
  };
  ed.addEventListener('pointerup', end); ed.addEventListener('pointercancel', end);

  // Wheel and key presses come in bursts, so they're saved as one history step once they settle
  let settleT = 0;
  const recordSoon = label => { clearTimeout(settleT); settleT = setTimeout(() => record(label()), 400); };
  ed.addEventListener('wheel', e => {
    e.preventDefault(); setZoom(st.z * Math.exp(-e.deltaY * 0.002)); recordSoon(zoomLabel);
  }, {passive:false});
  ed.addEventListener('keydown', e => {
    if (!st.img || e.ctrlKey || e.metaKey || e.altKey) return;
    const step = (e.shiftKey ? 10 : 1) / scale();
    const moves = { ArrowLeft:[1,0], ArrowRight:[-1,0], ArrowUp:[0,1], ArrowDown:[0,-1] };
    if (moves[e.key]){
      e.preventDefault();
      st.px += moves[e.key][0] * step; st.py += moves[e.key][1] * step;
      clampPos(); update(); recordSoon(() => 'Nudge');
    } else if (['Equal','NumpadAdd','Minus','NumpadSubtract'].includes(e.code)){
      // Matched by key position: on most layouts "+" already needs Shift, so Shift can't mean "bigger step" here
      e.preventDefault();
      const zin = e.code === 'Equal' || e.code === 'NumpadAdd';
      setZoom(zin ? st.z * 1.01 : st.z / 1.01); recordSoon(zoomLabel);
    }
  });

  const drop = $('#drop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragging'); useFile(e.dataTransfer.files[0]); });
  window.addEventListener('paste', e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) useFile(item.getAsFile());
  });

  // ---------- controls ----------
  $('#file').addEventListener('change', e => { useFile(e.target.files[0]); e.target.value = ''; });
  $('#zoom').addEventListener('input', e => setZoom(+e.target.value));
  $('#zoom').addEventListener('change', () => record(zoomLabel()));
  $('#reset').addEventListener('click', () => {
    if (!st.img) return;
    st.z = 1; st.px = st.w/2; st.py = st.h/2; syncZoom(); update(); record('Recenter');
  });

  function syncSeg(id, val){ $$(`#${id} button`).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === val)); }
  $('#shape').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    st.shape = b.dataset.v; syncSeg('shape', st.shape); $('#ladder').dataset.shape = st.shape; update();
    record(`Shape: ${b.textContent}`);
  });
  function syncFill(){
    $$('#fill .sw').forEach(b => b.setAttribute('aria-pressed',
      b.id === 'customWrap' ? st.fill === 'custom' : b.dataset.v === st.fill));
    $('#customWrap').style.background = st.custom;
  }
  $('#fill').addEventListener('click', e => {
    const b = e.target.closest('button.sw'); if (!b) return;
    st.fill = b.dataset.v; syncFill(); update();
    record(`Background: ${b.getAttribute('aria-label')}`);
  });
  $('#custom').addEventListener('input', e => { st.custom = e.target.value; st.fill = 'custom'; syncFill(); update(); });
  $('#custom').addEventListener('change', () => record(`Background: ${st.custom.toUpperCase()}`));

  function syncName(){
    $$('[data-name]').forEach(n => n.textContent = st.name.trim() || 'You');
    // A blank handle falls back to one made from the display name
    const handle = st.handle.replace(/^@+/, '').replace(/\s+/g, '')
      || st.name.toLowerCase().replace(/[^a-z0-9_.]/g, '') || 'you';
    $$('[data-handle]').forEach(n => n.textContent = handle);
  }
  $('#name').addEventListener('input', e => { st.name = e.target.value; syncName(); savePrefs(); });
  $('#handle').addEventListener('input', e => { st.handle = e.target.value; syncName(); savePrefs(); });

  function syncBio(){
    const bio = st.bio.trim();
    $$('[data-bio]').forEach(n => n.textContent = bio);
    $$('[data-bio-wrap]').forEach(w => w.hidden = !bio); // e.g. Discord hides "About Me" when empty
    $('#bioCount').textContent = `${st.bio.length}/150`;
  }
  $('#bio').addEventListener('input', e => { st.bio = e.target.value; syncBio(); savePrefs(); });

  // Card tabs (Discord Chat/Profile, X Notifications/Profile): each switches panes inside its own card
  $('#stage').addEventListener('click', e => {
    const tab = e.target.closest('.mtabs button'); if (!tab) return;
    const card = tab.closest('.mock');
    card.querySelectorAll('.mtabs button').forEach(b => b.setAttribute('aria-selected', b === tab));
    card.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== tab.dataset.tab);
  });

  $('#mode').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    st.mode = b.dataset.v; syncSeg('mode', st.mode); $('#stage').dataset.mode = st.mode; savePrefs();
  });
  // The canvas redraws at its new size on its own via the ResizeObserver
  function syncView(){ syncSeg('view', st.view); $('.layout').classList.toggle('focus', st.view === 'crop'); }
  $('#view').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.dataset.v === st.view) return;
    st.view = b.dataset.v; syncView(); savePrefs(); window.scrollTo(0, 0);
  });
  $('#gray').addEventListener('change', e => { st.gray = e.target.checked; $('#stage').classList.toggle('gray', st.gray); savePrefs(); });

  // ---------- full-screen viewer ----------
  // Opens from any of your avatars in the previews, keeping the shape it had where you clicked it
  const viewer = $('#viewer'), vImg = viewer.querySelector('img');
  $$('#stage img[data-av]').forEach(i => { i.tabIndex = 0; i.setAttribute('role', 'button'); i.setAttribute('aria-label', 'View profile picture full screen'); });
  function openViewer(from){
    const radius = getComputedStyle(from).borderRadius;
    vImg.style.borderRadius = radius.endsWith('%') ? radius : (parseFloat(radius) / from.offsetWidth * 100) + '%';
    viewer.classList.toggle('gray', st.gray);
    $('#viewerSize').textContent = `Opened from the ${from.offsetWidth}px preview`;
    viewer.showModal();
  }
  $('#stage').addEventListener('click', e => { const i = e.target.closest('img[data-av]'); if (i) openViewer(i); });
  $('#stage').addEventListener('keydown', e => {
    const i = e.target.closest('img[data-av]');
    if (i && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); openViewer(i); }
  });
  // Clicking anywhere except the picture and caption closes it, like a photo viewer
  viewer.addEventListener('click', e => { if (e.target === viewer || e.target.id === 'viewerClose') viewer.close(); });

  function syncSquare(){
    $('#stage').classList.toggle('square', st.square);
    $('#ladder').dataset.shape = st.square ? 'square' : st.shape;
    $$('#shape button').forEach(b => b.disabled = st.square);
  }
  $('#square').addEventListener('change', e => {
    st.square = e.target.checked; syncSquare(); update();
    record(st.square ? 'Square Avatars On' : 'Square Avatars Off');
  });
  $('#grid').addEventListener('change', e => { st.grid = e.target.checked; drawEditor(); savePrefs(); });

  // ---------- history ----------
  // Each step snapshots everything that changes the cropped image; a new image starts a fresh history
  const hist = { list:[], i:-1 }, HIST_MAX = 60;
  const snap = () => ({ z:st.z, px:st.px, py:st.py, shape:st.shape, fill:st.fill, custom:st.custom, square:st.square });
  const same = (a, b) => Object.keys(a).every(k => a[k] === b[k]);
  function record(label){
    const s = snap(), cur = hist.list[hist.i];
    if (cur && same(cur.s, s)) return;
    hist.list.splice(hist.i + 1);
    hist.list.push({ label, s });
    if (hist.list.length > HIST_MAX) hist.list.shift();
    hist.i = hist.list.length - 1;
    renderHist();
  }
  function resetHist(label){ hist.list = []; hist.i = -1; record(label); }
  function goTo(i){
    if (i < 0 || i >= hist.list.length || i === hist.i) return;
    clearTimeout(settleT);
    hist.i = i; Object.assign(st, hist.list[i].s);
    syncZoom(); syncSeg('shape', st.shape); $('#custom').value = st.custom; syncFill();
    $('#square').checked = st.square; syncSquare();
    update(); renderHist();
  }
  function renderHist(){
    const L = $('#hist');
    // Newest step first; data-i keeps each row tied to its real position in the history
    L.innerHTML = hist.list.map((h, i) =>
      `<li${i > hist.i ? ' class="future"' : ''}><button type="button" data-i="${i}"${i === hist.i ? ' aria-current="step"' : ''}>${i + 1}. ${h.label}</button></li>`).reverse().join('');
    $('#undo').disabled = hist.i <= 0;
    $('#redo').disabled = hist.i >= hist.list.length - 1;
    const cur = L.querySelector('[aria-current]');
    if (cur) L.scrollTop = cur.parentElement.offsetTop - L.clientHeight / 2;
  }
  $('#hist').addEventListener('click', e => { const b = e.target.closest('button'); if (b) goTo(+b.dataset.i); });
  $('#undo').addEventListener('click', () => goTo(hist.i - 1));
  $('#redo').addEventListener('click', () => goTo(hist.i + 1));
  window.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.target.matches('input[type=text], textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'z'){ e.preventDefault(); goTo(e.shiftKey ? hist.i + 1 : hist.i - 1); }
    else if (k === 'y'){ e.preventDefault(); goTo(hist.i + 1); }
  });

  // Export the crop at the source image's own resolution (capped), not the 512px preview
  $('#save').addEventListener('click', () => {
    if (!st.img) return;
    const size = Math.max(256, Math.min(2048, Math.round(Math.min(st.w, st.h) / st.z)));
    const c = document.createElement('canvas'); c.width = c.height = size;
    drawImg(c.getContext('2d'), size, size);
    c.toBlob(b => {
      if (!b) return showErr("Couldn't save the image. Try again.");
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `avatar-${size}px.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  });

  // ---------- init ----------
  let prefs = null, savedImg = null;
  try { prefs = JSON.parse(localStorage.getItem(KEY_PREFS) || 'null'); savedImg = localStorage.getItem(KEY_IMG); } catch(e){}
  if (prefs) Object.assign(st, {
    z: prefs.z || 1, shape: prefs.shape || 'circle', fill: prefs.fill || 'none', custom: prefs.custom || st.custom,
    name: typeof prefs.name === 'string' ? prefs.name : st.name,
    handle: typeof prefs.handle === 'string' ? prefs.handle : st.handle,
    bio: typeof prefs.bio === 'string' ? prefs.bio : st.bio, mode: prefs.mode || 'dark', gray: !!prefs.gray, square: !!prefs.square, grid: !!prefs.grid, view: prefs.view === 'crop' ? 'crop' : 'preview' });

  $('#name').value = st.name; $('#handle').value = st.handle; syncName();
  $('#bio').value = st.bio; syncBio();
  syncSeg('shape', st.shape); $('#ladder').dataset.shape = st.shape;
  syncSeg('mode', st.mode); $('#stage').dataset.mode = st.mode;
  syncView();
  $('#gray').checked = st.gray; $('#stage').classList.toggle('gray', st.gray);
  $('#square').checked = st.square; syncSquare();
  $('#grid').checked = st.grid;
  $('#custom').value = st.custom; syncFill();

  if (savedImg){
    $('#hint').textContent = 'Drag to reposition. Pinch or scroll to zoom.';
    loadSrc(savedImg, { fx: prefs?.fx ?? .5, fy: prefs?.fy ?? .5 });
  } else {
    loadSrc(sample());
  }
})();
