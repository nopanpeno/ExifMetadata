import { readExif } from './exif-read.js';
import { groupFields } from './exif-groups.js';

const $ = (id) => document.getElementById(id);
const dropzone = $('dropzone');
const input = $('file');
const statusEl = $('status');
const result = $('result');
const groupsEl = $('groups');
const metaEl = $('meta');
const preview = $('preview');

let previewUrl = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render(groups, file) {
  groupsEl.replaceChildren();
  metaEl.replaceChildren(
    el('p', 'fname', file.name),
    el('p', 'fsize', `${(file.size / 1024 / 1024).toFixed(2)} MB`),
  );
  if (!groups.length) {
    groupsEl.append(el('p', 'empty', 'Tidak ada metadata EXIF yang terbaca. Foto ini sudah bersih.'));
    return;
  }
  const sensitiveCount = groups.reduce(
    (n, g) => n + g.fields.filter((f) => f.sensitive).length,
    0,
  );
  if (sensitiveCount) {
    groupsEl.append(
      el('p', 'warn', `${sensitiveCount} field sensitif ditemukan (merah). Bisa membocorkan lokasi atau identitas.`),
    );
  }
  for (const g of groups) {
    const sec = el('section', 'group');
    sec.append(el('h2', '', `${g.label} (${g.fields.length})`));
    const dl = el('dl');
    for (const f of g.fields) {
      const row = el('div', f.sensitive ? 'row sensitive' : 'row');
      row.append(el('dt', '', f.key), el('dd', '', f.value));
      dl.append(row);
    }
    sec.append(dl);
    groupsEl.append(sec);
  }
}

async function handle(file) {
  if (!file) return;
  setStatus('Membaca metadata...');
  result.hidden = true;
  try {
    const data = await readExif(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    render(groupFields(data), file);
    result.hidden = false;
    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus('Gagal membaca file ini. Coba foto lain.');
  }
}

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
