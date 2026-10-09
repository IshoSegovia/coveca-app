"""Genera el SQL para importar productos y clientes de Loyverse a Supabase.
Los datos se toman tal cual (se editan después en la app). Se puede ejecutar más de una vez:
no duplica ni sobrescribe lo que ya exista.

Uso: python3 generar_sql_loyverse.py articulos.csv clientes.csv salida.sql
El SQL se pega en Supabase → SQL Editor (los datos de clientes NO se suben al repositorio público).
"""
import csv, re, sys, unicodedata
from datetime import datetime

art_csv, cli_csv, salida = sys.argv[1:4]
P = list(csv.DictReader(open(art_csv, encoding='utf-8')))
C = list(csv.DictReader(open(cli_csv, encoding='utf-8')))

def q(v):
    if v is None or v == '': return 'null'
    return "'" + str(v).replace("'", "''") + "'"

def num(x):
    try: return float(str(x).strip())
    except Exception: return None

def norm(s):
    return unicodedata.normalize('NFKD', (s or '').lower()).encode('ascii', 'ignore').decode().strip()

def fecha(s):
    try: return datetime.strptime(s.split(' ')[0], '%d-%m-%y').strftime('%Y-%m-%d')
    except Exception: return None

def rut(r):
    s = re.sub(r'[^0-9kK]', '', r or '')
    if len(s) < 2: return None
    cuerpo, dv = s[:-1], s[-1].upper()
    suma, m = 0, 2
    for d in reversed(cuerpo):
        suma += int(d) * m; m = 2 if m == 7 else m + 1
    calc = 11 - suma % 11
    calc = '0' if calc == 11 else 'K' if calc == 10 else str(calc)
    return f"{int(cuerpo):,}".replace(',', '.') + '-' + dv if calc == dv else None

COMUNAS = {'cauquenes': 'Cauquenes', 'retiro': 'Retiro', 'san carlos': 'San Carlos', 'parral': 'Parral',
           'pelluhue': 'Pelluhue', 'chanco': 'Chanco', 'buli': 'Buli', 'talquita': 'Talquita'}
RUTAS = ['Cauquenes', 'Retiro', 'San Carlos', 'Parral', 'Pelluhue', 'Chanco']   # rutas iniciales (editables en la app)

def comuna(c):
    for campo in (c['Ciudad'], c['Dirección']):
        n = norm(campo)
        for k, v in COMUNAS.items():
            if k in n: return v
    return None

L = ['-- Importación inicial desde Loyverse (generado automáticamente)', 'begin;', '']

# Categorías
cats = sorted({p['Categoria'].strip() for p in P if p['Categoria'].strip()})
L.append('insert into public.categorias (nombre) values ' + ', '.join(f'({q(c)})' for c in cats) + ' on conflict (nombre) do nothing;')

# Rutas
L.append('insert into public.rutas (nombre, orden) values ' +
         ', '.join(f'({q(r)}, {i})' for i, r in enumerate(RUTAS, 1)) + ' on conflict (nombre) do nothing;')
L.append('')

# Productos + stock inicial (solo si el producto es nuevo)
filas = []
for p in P:
    costo = int(num(p['Coste']) or 0)
    precio = num(p['Precio [COVECA]'])
    stock = num(p['En inventario [COVECA]']) if p['Seguir el Inventario'] == 'Y' else None
    minimo = num(p['Existencias bajas [COVECA]'])
    filas.append(f"({q(p['REF'])}, {q(p['Nombre'].strip())}, {q(p['Categoria'].strip())}, {costo}, "
                 f"{int(precio) if precio is not None else 0}, {q(p['Codigo de barras'].strip())}, "
                 f"{int(stock) if stock else 0}, {int(minimo) if minimo else 'null'}, {q(p['Descripción'].strip())})")
L.append('with datos (ref, nombre, categoria, costo, precio, codigo_barras, stock, stock_minimo, descripcion) as (values')
L.append(',\n'.join(filas))
L.append('''), nuevos as (
  insert into public.productos (ref, nombre, categoria_id, costo, precio, codigo_barras, stock_minimo, descripcion)
  select d.ref, d.nombre, c.id, d.costo, d.precio, d.codigo_barras, d.stock_minimo, d.descripcion
  from datos d left join public.categorias c on c.nombre = d.categoria
  on conflict (ref) do nothing
  returning id, ref
)
insert into public.movimientos_stock (producto_id, cantidad, motivo)
select n.id, d.stock, 'inicial' from nuevos n join datos d on d.ref = n.ref where d.stock <> 0;''')
L.append('')

# Clientes
filas = []
for c in C:
    com = comuna(c)
    direccion = c['Dirección'].strip()
    if norm(direccion) in COMUNAS: direccion = ''
    correo = c['Email'].strip()
    if correo.endswith('.ccom'): correo = correo[:-5] + '.com'
    codigo = c['Código de cliente'].strip()
    r = rut(codigo) if codigo else None
    nota = None if (r or not codigo) else f'Código de cliente en Loyverse: {codigo}'
    ruta = com if com in RUTAS else None
    filas.append(f"({q(c['ID del cliente'])}, {q(c['Nombre del cliente'].strip())}, {q(correo)}, "
                 f"{q(c['Número de teléfono'].strip())}, {q(direccion)}, {q(com)}, {q(r)}, {q(ruta)}, {q(nota)}, "
                 f"{q(fecha(c['Primera visita']))}::date, {q(fecha(c['Ultima visita']))}::date, "
                 f"{int(c['Total de visitas'] or 0)}, {int(float(c['Gasto total'] or 0))})")
L.append('insert into public.clientes (loyverse_id, nombre, correo, telefono, direccion, comuna, rut, ruta_id, notas,')
L.append('  loyverse_primera_compra, loyverse_ultima_compra, loyverse_compras, loyverse_total)')
L.append('select d.loyverse_id, d.nombre, d.correo, d.telefono, d.direccion, d.comuna, d.rut, r.id, d.notas,')
L.append('  d.primera, d.ultima, d.compras, d.total')
L.append('from (values')
L.append(',\n'.join(filas))
L.append(''') as d (loyverse_id, nombre, correo, telefono, direccion, comuna, rut, ruta, notas, primera, ultima, compras, total)
left join public.rutas r on r.nombre = d.ruta
on conflict (loyverse_id) do nothing;''')
L.append('')
L.append('commit;')
L.append('')
L.append("-- Resultado:")
L.append("select (select count(*) from public.productos) as productos, (select count(*) from public.clientes) as clientes,")
L.append("       (select count(*) from public.rutas) as rutas, (select count(*) from public.categorias) as categorias;")
open(salida, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('ok', len(P), 'productos', len(C), 'clientes')
