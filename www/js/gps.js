// Ubicación GPS de clientes y recorrido optimizado de una ruta para abrir en Google Maps.
// El orden se calcula en el celular (sin servicios de pago): vecino más cercano + mejora 2-opt
// sobre distancia en línea recta. Funciona sin señal; solo Google Maps necesita internet.

export const PARADAS_POR_TRAMO = 4; // Google Maps en celular admite pocas paradas por enlace

// Ubicación actual del celular (pide permiso la primera vez).
export function miUbicacion({ precisa = true, espera = 20000 } = {}) {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal(new Error('Este celular no permite obtener la ubicación.'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy) }),
      (e) => mal(new Error(e.code === 1
        ? 'Permiso de ubicación denegado. Actívalo en Ajustes del celular > Apps > COVECA > Permisos.'
        : 'No se pudo obtener la ubicación. Revisa que el GPS esté encendido e intenta al aire libre.')),
      { enableHighAccuracy: precisa, timeout: espera, maximumAge: 10000 });
  });
}

// Lee coordenadas desde un enlace de Google Maps o texto "lat, lng".
export function leerCoordenadas(texto) {
  const t = decodeURIComponent((texto || '').trim());
  const patrones = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,            // enlace largo de lugar
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,                // .../@-35.97,-72.32,17z
    /[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/,  // "-35.97, -72.32"
  ];
  for (const re of patrones) {
    const m = t.match(re);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  if (/goo\.gl|maps\.app/.test(t)) throw new Error('Ese es un enlace corto. Ábrelo en Google Maps, mantén presionado el punto del local y copia las coordenadas que aparecen arriba (ej. -35.97, -72.32).');
  throw new Error('No encontré coordenadas. Pega un enlace de Google Maps o escribe "latitud, longitud".');
}

export const tieneGps = (c) => c.lat != null && c.lng != null;
export const coordTxt = (c) => `${Number(c.lat).toFixed(6)},${Number(c.lng).toFixed(6)}`;

// Distancia en km (línea recta).
export function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Orden de visita: vecino más cercano desde el inicio y luego mejora 2-opt.
export function optimizar(clientes, inicio = null) {
  const pts = clientes.filter(tieneGps);
  if (pts.length < 2) return pts;
  const restantes = [...pts];
  const orden = [];
  let actual = inicio || restantes.shift();
  if (!inicio) orden.push(actual);
  while (restantes.length) {
    let mejor = 0;
    restantes.forEach((p, i) => { if (km(actual, p) < km(actual, restantes[mejor])) mejor = i; });
    actual = restantes.splice(mejor, 1)[0];
    orden.push(actual);
  }
  const largo = (r) => r.reduce((s, p, i) => s + (i ? km(r[i - 1], p) : (inicio ? km(inicio, p) : 0)), 0);
  let mejoro = true, ruta = orden;
  while (mejoro) {
    mejoro = false;
    for (let i = 0; i < ruta.length - 1; i++) {
      for (let j = i + 1; j < ruta.length; j++) {
        const nueva = [...ruta.slice(0, i), ...ruta.slice(i, j + 1).reverse(), ...ruta.slice(j + 1)];
        if (largo(nueva) + 1e-9 < largo(ruta)) { ruta = nueva; mejoro = true; }
      }
    }
  }
  return ruta;
}

export const largoKm = (ruta, inicio = null) =>
  ruta.reduce((s, p, i) => s + (i ? km(ruta[i - 1], p) : (inicio ? km(inicio, p) : 0)), 0);

// Tramos de hasta PARADAS_POR_TRAMO clientes; cada tramo abre navegación desde tu ubicación actual.
export function tramos(ruta) {
  const t = [];
  for (let i = 0; i < ruta.length; i += PARADAS_POR_TRAMO) t.push(ruta.slice(i, i + PARADAS_POR_TRAMO));
  return t;
}
export function urlTramo(tramo) {
  const destino = tramo[tramo.length - 1];
  const intermedios = tramo.slice(0, -1).map(coordTxt).join('|');
  const p = new URLSearchParams({ api: '1', destination: coordTxt(destino), travelmode: 'driving', dir_action: 'navigate' });
  if (intermedios) p.set('waypoints', intermedios);
  return 'https://www.google.com/maps/dir/?' + p.toString().replace(/%2C/g, ',').replace(/%7C/g, '|');
}
export const urlPunto = (c) => `https://www.google.com/maps/search/?api=1&query=${coordTxt(c)}`;
