// Prepara una foto para subirla: la recorta cuadrada al centro y la reduce (≈600 px, JPEG),
// para que pese poco y cargue rápido con mala señal.
export async function prepararFoto(archivo, lado = 600) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer la imagen. Prueba con otra foto.')); i.src = url; });
    const corte = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = Math.min(lado, corte);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, (img.width - corte) / 2, (img.height - corte) / 2, corte, corte, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}
