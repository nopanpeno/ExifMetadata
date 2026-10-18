// Pembantu tes: sisipkan segmen JPEG mentah setelah SOI.
export const enc = (s) => [...s].map((c) => c.charCodeAt(0));

export function withSegment(u8, marker, payload) {
  const len = payload.length + 2;
  const seg = Uint8Array.from([0xff, marker, len >> 8, len & 255, ...payload]);
  const out = new Uint8Array(u8.length + seg.length);
  out.set(u8.subarray(0, 2));
  out.set(seg, 2);
  out.set(u8.subarray(2), 2 + seg.length);
  return out;
}

export const XMP_PACKET = enc(
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Budi</rdf:li></rdf:Seq></dc:creator>' +
    '</rdf:Description></rdf:RDF></x:xmpmeta>',
);

// IPTC ObjectName "Hi" di dalam blok Photoshop 8BIM.
export const IPTC_BLOCK = [
  ...enc('Photoshop 3.0'), 0,
  ...enc('8BIM'), 0x04, 0x04, 0, 0, 0, 0, 0, 7,
  0x1c, 0x02, 0x05, 0x00, 0x02, 0x48, 0x69, 0,
];

// Foto dengan semua jenis wadah metadata umum disisipkan.
export function dirty(u8) {
  let o = withSegment(u8, 0xe1, [...enc('http://ns.adobe.com/xap/1.0/'), 0, ...XMP_PACKET]);
  o = withSegment(o, 0xed, IPTC_BLOCK);
  o = withSegment(o, 0xfe, enc('rahasia'));
  const tail = new Uint8Array(o.length + 5);
  tail.set(o);
  tail.set(enc('EXTRA'), o.length);
  return tail;
}
