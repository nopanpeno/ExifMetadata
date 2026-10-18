// Peta Leaflet, dimuat hanya saat pengguna menyalakannya.
// Satu-satunya permintaan jaringan: ubin OpenStreetMap (koordinat ubin, bukan foto).

export function formatCoords(lat, lon) {
  const ns = lat >= 0 ? 'U' : 'S'; // Utara, Selatan
  const ew = lon >= 0 ? 'T' : 'B'; // Timur, Barat
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lon).toFixed(5)}° ${ew}`;
}

// Kembalikan fungsi untuk mematikan peta.
export async function showMap(container, lat, lon, { accuracy = null } = {}) {
  const [{ default: L }] = await Promise.all([
    import('leaflet'),
    import('leaflet/dist/leaflet.css'),
  ]);
  const map = L.map(container, { attributionControl: true }).setView([lat, lon], 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
  if (accuracy) L.circle([lat, lon], { radius: accuracy, color: '#17695a', weight: 2, fillOpacity: 0.12 }).addTo(map);
  L.circleMarker([lat, lon], { radius: 9, color: '#b3261e', fillColor: '#b3261e', fillOpacity: 0.6 }).addTo(map);
  return () => map.remove();
}
