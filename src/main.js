import { readExif } from './exif-read.js';
import { groupFields } from './exif-groups.js';
import { cleanAll, cleanSelected, removableKeys, cleanName } from './clean.js';
import { isJpeg } from './jpeg.js';

const $ = (id) => document.getElementById(id);
const dropzone = $('dropzone');
const input = $('file');
const statusEl = $('status');
const result = $('result');
const groupsEl = $('groups');
const metaEl = $('meta');
const preview = $('preview');
const btnAll = $('btn-all');
const btnSel = $('btn-sel');
const btnSens = $('btn-sens');
const orient = $('orient');
const orientWrap = $('orient-wrap');
const note = $('note');
const done = $('done');
const doneInfo = $('done-info');
const download = $('download');
const left = $('left');

const state = { file: null, removable: new Set(), jpeg: false, urls: { preview: null, out: null } };

function setStatus(text) {
  statusEl.textContent = text;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function swapUrl(slot, blob) {
  if (state.urls[slot]) URL.revokeObjectURL(state.urls[slot]);
  state.urls[slot] = URL.createObjectURL(blob);
  return state.urls[slot];
}

function selectedKeys() {
  return [...groupsEl.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.dataset.key);
}

function updateSelButton() {
  const n = selectedKeys().length;
  btnSel.textContent = `Hapus yang dicentang (${n})`;
  btnSel.disabled = n === 0 || !state.jpeg;
}

// selectable: tampilkan centang untuk field yang bisa dibuang satu per satu.
function renderGroups(container, groups, { selectable }) {
  container.replaceChildren();
  if (!groups.length) {
    container.append(el('p', 'empty', 'Tidak ada metadata EXIF yang terbaca.'));
    return;
  }
  const sensitive = groups.reduce((n, g) => n + g.fields.filter((f) => f.sensitive).length, 0);
  if (sensitive) {
    container.append(
      el('p', 'warn', `${sensitive} field sensitif (merah). Bisa membocorkan lokasi atau identitas.`),
    );
  }
  for (const g of groups) {
    const sec = el('section', 'group');
    sec.append(el('h2', '', `${g.label} (${g.fields.length})`));
    const dl = el('dl');
    for (const f of g.fields) {
      const row = el('div', f.sensitive ? 'row sensitive' : 'row');
      const dt = el('dt');
      if (selectable) {
        const cb = el('input');
        cb.type = 'checkbox';
        cb.dataset.key = f.key;
        cb.id = `cb-${f.key}`;
        cb.disabled = !state.removable.has(f.key);
        cb.addEventListener('change', updateSelButton);
        const lab = el('label', '', f.key);
        lab.htmlFor = cb.id;
        dt.append(cb, lab);
      } else {
        dt.textContent = f.key;
      }
      row.append(dt, el('dd', '', f.value));
      dl.append(row);
    }
    sec.append(dl);
    container.append(sec);
  }
}

async function handle(file) {
  if (!file) return;
  setStatus('Membaca metadata...');
  result.hidden = true;
  done.hidden = true;
  try {
    const [data, removable, head] = await Promise.all([
      readExif(file),
      removableKeys(file),
      file.slice(0, 4).arrayBuffer(),
    ]);
    state.file = file;
    state.removable = removable;
    state.jpeg = isJpeg(new Uint8Array(head));
    preview.src = swapUrl('preview', file);
    metaEl.replaceChildren(
      el('p', 'fname', file.name),
      el('p', 'fsize', `${(file.size / 1024 / 1024).toFixed(2)} MB`),
    );
    renderGroups(groupsEl, groupFields(data), { selectable: state.jpeg });
    orientWrap.hidden = !state.jpeg;
    btnSel.hidden = btnSens.hidden = !state.jpeg;
    note.textContent = state.jpeg
      ? 'Field XMP dan IPTC tidak bisa dicentang satu per satu. Pakai "Hapus semua" untuk membuangnya.'
      : 'Format ini hanya mendukung "Hapus semua" lewat gambar ulang. Hasil WebP bisa sedikit turun kualitas.';
    updateSelButton();
    result.hidden = false;
    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus('Gagal membaca file ini. Coba foto lain.');
  }
}

async function finish(res) {
  const url = swapUrl('out', res.blob);
  download.href = url;
  download.download = cleanName(state.file.name, res.ext);
  const sizeMb = (res.blob.size / 1024 / 1024).toFixed(2);
  doneInfo.textContent =
    `File baru ${sizeMb} MB. ` +
    (res.lossy
      ? 'Dibuat dengan gambar ulang, kualitas bisa sedikit turun.'
      : res.redrawn
        ? 'Dibuat dengan gambar ulang. PNG tetap tanpa kehilangan kualitas.'
        : 'Piksel foto tidak berubah.');
  const data = await readExif(res.blob);
  renderGroups(left, groupFields(data), { selectable: false });
  if (!groupFields(data).length) {
    left.replaceChildren(el('p', 'ok', 'Tidak ada metadata yang terbaca. Foto bersih.'));
  }
  done.hidden = false;
  done.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function run(job) {
  btnAll.disabled = btnSel.disabled = true;
  setStatus('Memproses...');
  try {
    await finish(await job());
    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Gagal memproses foto.');
  } finally {
    btnAll.disabled = false;
    updateSelButton();
  }
}

btnAll.addEventListener('click', () => run(() => cleanAll(state.file, { keepOrientation: orient.checked })));
btnSel.addEventListener('click', () => run(() => cleanSelected(state.file, selectedKeys())));
btnSens.addEventListener('click', () => {
  for (const row of groupsEl.querySelectorAll('.row.sensitive input[type=checkbox]')) {
    if (!row.disabled) row.checked = true;
  }
  updateSelButton();
});

input.addEventListener('change', () => handle(input.files[0]));
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    input.click();
  }
});
for (const ev of ['dragenter', 'dragover']) {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('over');
  });
}
for (const ev of ['dragleave', 'drop']) {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('over');
  });
}
dropzone.addEventListener('drop', (e) => handle(e.dataTransfer.files[0]));
