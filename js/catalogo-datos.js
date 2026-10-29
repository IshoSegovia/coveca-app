// Datos curiosos del Catálogo (decisión de Francisco, 29-10-2026: fijos en la app; cambian con cada actualización).
// Orden de búsqueda: dato de la marca (se turna con el del tipo para no repetir en una hoja), dato por tipo de producto
// (palabra en el nombre, sin tildes ni mayúsculas) y, si no hay, uno de la categoría. Solo hechos conocidos y verificables.
// Para agregar uno: sumar la marca a MARCA o una fila a TIPO (el primer patrón que calza gana).

export const MARCA = {
  "Oreo": "Oreo nació en 1912 en Nueva York y es una de las galletas más vendidas del mundo.",
  "Halls": "Halls nació en 1893 en Inglaterra, en la fábrica de los hermanos Hall.",
  "Trident": "Trident salió en 1960 en Estados Unidos como uno de los primeros chicles sin azúcar.",
  "Milka": "Milka nació en Suiza en 1901 y su envoltorio lila es su sello desde el comienzo.",
  "Ritz": "Las galletas Ritz salieron en 1934 en Estados Unidos.",
  "Nescafé": "Nescafé se lanzó en Suiza en 1938: fue de los primeros cafés instantáneos.",
  "Bon o Bon": "Bon o Bon es un bombón de Arcor creado en Argentina en 1984.",
  "Maruchan": "Maruchan es la marca de sopas instantáneas de Toyo Suisan, empresa japonesa.",
  "Push Pop": "Push Pop salió en 1986: el dulce se empuja desde abajo y se guarda con la tapa.",
  "AXE": "AXE se lanzó en Francia en 1983 y hoy se vende en más de 90 países.",
  "Colombina": "Colombina es una empresa colombiana de dulces fundada en 1927.",
  "Sahne-Nuss": "Sahne-Nuss tiene nombre alemán: \"Sahne\" significa crema y \"Nuss\", nuez.",
  "Costa": "Costa es una marca chilena de chocolates y galletas con más de un siglo de historia.",
  "Lay's": "Lay's nació en Estados Unidos en 1932 y hoy es la marca de papas fritas más vendida del mundo.",
  "Gullón": "Gullón es una empresa española de galletas fundada en 1892.",
  "Nivea": "Nivea nació en Alemania en 1911 con su crema para la piel.",
};

// [patrón (inicio de palabra, sobre el nombre sin tildes), categorías donde vale, datos]
export const TIPO = [
  [/\b(?:energ)/, ['Bebidas'], [
    "Las bebidas energéticas nacieron en Asia y se masificaron en Europa a fines de los años 80.",
  ]],
  [/\b(?:boba)/, ['Bebidas'], [
    "Las popping boba son esferas de jugo con una capa muy fina que revienta al morderlas.",
    "Las popping boba se inspiran en el bubble tea, la bebida con perlas nacida en Taiwán en los años 80.",
  ]],
  [/\b(?:aloe)/, ['Bebidas'], [
    "Las bebidas de aloe vera llevan trocitos de la pulpa de la planta, que se sienten al tomarla.",
    "El aloe vera es una planta suculenta: guarda agua en sus hojas gruesas.",
  ]],
  [/\b(?:dubai)/, ['Chocolates'], [
    "El chocolate estilo Dubái, relleno de pistacho y masa kataifi, se hizo viral en redes sociales en 2024.",
    "El pistacho del chocolate Dubái crece sobre todo en Irán, Estados Unidos y Turquía.",
  ]],
  [/\b(?:avellana|nuttino)/, ['Chocolates'], [
    "Turquía produce cerca de dos tercios de las avellanas del mundo.",
  ]],
  [/\b(?:blanco)/, ['Chocolates'], [
    "El chocolate blanco se hace con manteca de cacao, leche y azúcar, sin la pasta oscura del cacao.",
  ]],
  [/\b(?:bombon)/, ['Chocolates'], [
    "La palabra bombón viene del francés \"bon bon\", que quiere decir \"bueno, bueno\".",
  ]],
  [/\b(?:alfajor)/, ['Chocolates', 'Galletas y obleas'], [
    "El alfajor llegó a América desde España y su nombre tiene origen árabe.",
  ]],
  [/\b(?:moneda)/, ['Chocolates'], [
    "Las monedas de chocolate son típicas de la Navidad en Europa, inspiradas en la tradición de San Nicolás.",
  ]],
  [/\b(?:tiffany|mani)/, ['Chocolates', 'Snacks salados'], [
    "El maní no es un fruto seco: es una legumbre, pariente de los porotos.",
  ]],
  [/\b(?:oreo)/, ['Galletas y obleas', 'Chocolates'], [
    "Cada año se venden más de 40 mil millones de galletas Oreo en el mundo.",
  ]],
  [/\b(?:oblea|super 8)/, ['Galletas y obleas', 'Chocolates'], [
    "La oblea es una masa muy delgada horneada entre dos planchas calientes, como un waffle fino.",
  ]],
  [/\b(?:stax)/, ['Snacks salados'], [
    "Las papas en tubo se hacen con masa de papa moldeada: por eso todas tienen la misma forma y calzan una sobre otra.",
  ]],
  [/^papas/, ['Snacks salados'], [
    "La papa es originaria de los Andes; solo en Chiloé se cultivan cientos de variedades nativas.",
    "Las papas fritas en hojuela se hicieron populares en Estados Unidos a fines del siglo XIX.",
  ]],
  [/\b(?:sopa|maruchan)/, ['Sopas instantáneas'], [
    "En el mundo se comen más de 100 mil millones de porciones de fideos instantáneos al año.",
    "Los fideos instantáneos se cuecen y luego se fríen o secan: por eso quedan listos en 3 minutos.",
    "Momofuku Ando inventó los fideos instantáneos en 1958 en Japón, en un cobertizo detrás de su casa.",
  ]],
  [/\b(?:sour|acido)/, ['Caramelos y chupetes', 'Gomitas y jaleas', 'Chicles', 'Dulces de fantasía', 'Chocolates'], [
    "El sabor ácido de los dulces \"sour\" viene de una capa de ácido cítrico o málico, el mismo de las frutas.",
    "Las cintas ácidas se hacen estirando la masa de gomita en tiras largas que luego se cubren de azúcar ácida.",
  ]],
  [/\b(?:chicle|bigtime|trident|splot)/, ['Chicles'], [
    "El chicle viene de la savia del árbol chicozapote: mayas y aztecas ya lo masticaban.",
    "Masticar chicle sin azúcar después de comer ayuda a producir saliva, que protege los dientes.",
    "Los chicles sin azúcar se endulzan con xilitol o sorbitol en vez de azúcar.",
  ]],
  [/\b(?:bon bon bum)/, ['Caramelos y chupetes'], [
    "Bon Bon Bum es un chupete con chicle en el centro: dos dulces en uno.",
    "Un caramelo duro se hace calentando azúcar a unos 150 °C y dejándolo enfriar como si fuera vidrio.",
  ]],
  [/\b(?:paleta|chupe|lollipop|pop|chupa|pico dulce|palo loco|bon bon bum)/, ['Caramelos y chupetes', 'Dulces de fantasía', 'Chocolates'], [
    "El chupete con palito se empezó a fabricar a máquina en Estados Unidos a comienzos del siglo XX.",
    "Un caramelo duro se hace calentando azúcar a unos 150 °C y dejándolo enfriar como si fuera vidrio.",
  ]],
  [/\b(?:halls|lyptus)/, ['Caramelos y chupetes'], [
    "El mentol, que da la sensación de frío en la garganta, se saca de la planta de menta.",
  ]],
  [/\b(?:caramelo|boca loca)/, ['Caramelos y chupetes'], [
    "Un caramelo duro se hace calentando azúcar a unos 150 °C y dejándolo enfriar como si fuera vidrio.",
  ]],
  [/\b(?:jalea)/, ['Gomitas y jaleas'], [
    "Las jaleas se hacen con gelatina o con pectina, una fibra que viene de las frutas.",
    "Una jalea con forma de animal o figura se vende por la entretención: el niño juega antes de comer.",
  ]],
  [/\b(?:gomita|huevo frito|peeled|tucrema|cinta)/, ['Gomitas y jaleas'], [
    "La gomita con forma de oso se inventó en Alemania en 1922.",
    "Las gomitas se moldean en bandejas llenas de almidón de maíz, que les da la forma.",
  ]],
  [/\b(?:xplot)/, ['Dulces de fantasía'], [
    "Los dulces que \"explotan\" en la boca llevan burbujas de gas atrapadas en el caramelo.",
  ]],
  [/\b(?:spray)/, ['Dulces de fantasía'], [
    "Los dulces en spray llevan el sabor líquido para rociarlo directo en la lengua.",
  ]],
  [/\b(?:fun dip)/, ['Dulces de fantasía'], [
    "Fun Dip se come mojando un palito de caramelo en un polvo de sabores.",
  ]],
  [/\b(?:calaveras|garras|zombi|ojos de miedo|halloween)/, ['Caramelos y chupetes', 'Gomitas y jaleas', 'Chicles', 'Dulces de fantasía', 'Chocolates'], [
    "Los dulces de Halloween se venden desde comienzos de octubre: conviene tenerlos en exhibición temprano.",
  ]],
  [/\b(?:sorpresa)/, ['Dulces de fantasía', 'Chocolates'], [
    "Los huevos de chocolate con juguete adentro se hicieron famosos en Italia en los años 70.",
  ]],
  [/\b(?:chubi)/, ['Dulces de fantasía', 'Chocolates'], [
    "Las grageas de colores se recubren girando en grandes bombos, capa por capa.",
  ]],
  [/\b(?:gel|noodles|toys|jeep|huevito)/, ['Dulces de fantasía'], [
    "Un dulce con juguete o personaje se vende por la experiencia: el niño compra el juego y el dulce.",
    "Los dulces con personajes de dibujos animados se renuevan cada temporada, según lo que ven los niños.",
  ]],
  [/\b(?:desodorante)/, ['Cuidado personal'], [
    "El primer desodorante comercial, Mum, salió a la venta en 1888 en Estados Unidos.",
  ]],
  [/\b(?:afeitadora)/, ['Cuidado personal'], [
    "La máquina de afeitar con hoja desechable se patentó en 1904 en Estados Unidos.",
    "Las máquinas con varias hojas reparten el corte: cada hoja corta un poco y se irrita menos la piel.",
  ]],
  [/\b(?:bolsas? (de )?basura)/, ['Aseo del hogar'], [
    "La bolsa de basura de plástico se inventó en Canadá en 1950.",
    "Una bolsa de basura gruesa evita derrames: es lo primero que mira el cliente.",
  ]],
  [/\b(?:esponja)/, ['Aseo del hogar'], [
    "Las esponjas de cocina de hoy son sintéticas; antes se usaban esponjas de mar.",
    "El lado verde de la esponja es para ollas; el lado suave, para la loza delicada.",
  ]],
  [/\b(?:microfibra)/, ['Aseo del hogar'], [
    "Cada hilo de microfibra es más delgado que un cabello humano: por eso atrapa mejor el polvo.",
  ]],
  [/\b(?:trapero)/, ['Aseo del hogar'], [
    "El trapero húmedo se usa y se bota: no se necesita balde para limpiar el piso.",
    "Cada hilo de microfibra es más delgado que un cabello humano: por eso atrapa mejor el polvo.",
  ]],
  [/\b(?:pila)/, ['Bazar'], [
    "La primera pila la creó Alessandro Volta en 1800; de su apellido viene la palabra \"voltio\".",
    "Una pila AA y una AAA dan el mismo voltaje (1,5 V); la AA dura más porque es más grande.",
  ]],
  [/\b(?:encendedor)/, ['Bazar'], [
    "El encendedor se inventó en 1823, antes que el fósforo moderno.",
  ]],
  [/\b(?:choritos)/, ['Despensa'], [
    "Chile es uno de los mayores productores de choritos del mundo, cultivados sobre todo en la Región de Los Lagos.",
    "Los choritos en conserva ya vienen cocidos: se pueden comer directo de la lata.",
  ]],
  [/\b(?:galleta|club social|chocman)/, ['Galletas y obleas'], [
    "La palabra galleta viene del francés \"galette\".",
    "Las galletas nacieron como comida de viaje para marineros: duraban meses sin echarse a perder.",
  ]],
  [/\b(?:chocolate|choco|tableton|trencito|winergy|sahne|lolly|nikolo|snack)/, ['Chocolates'], [
    "Se necesitan unas 400 semillas de cacao para hacer medio kilo de chocolate.",
    "La primera tableta de chocolate para comer se hizo en Inglaterra en 1847.",
    "El cacao es originario de América: mayas y aztecas lo tomaban como bebida.",
    "El chocolate se derrite a unos 34 °C, justo bajo la temperatura del cuerpo: por eso se deshace en la boca.",
  ]],
];

// Dato o consejo de venta por categoría: va en la portada de cada categoría.
export const CATEGORIA = {
  "Chocolates": "Bajo 25 °C y lejos del sol, el chocolate no se pone blanco ni se deforma: ubíquelo lejos de la vitrina soleada.",
  "Caramelos y chupetes": "Son compra de impulso: junto a la caja se venden mucho más que en el fondo del local.",
  "Gomitas y jaleas": "La gomita con forma de oso se inventó en Alemania en 1922.",
  "Chicles": "El chicle es el rey de la compra de impulso: un exhibidor a la vista de la caja hace la diferencia.",
  "Dulces de fantasía": "Los dulces con personajes rotan con las temporadas: Halloween, Navidad y el Día del Niño son sus fechas fuertes.",
  "Galletas y obleas": "Las galletas en paquete chico se venden solas en la hora de la colación escolar.",
  "Cuidado personal": "Tener lo básico de cuidado personal evita que su cliente vaya a otro local por una sola cosa.",
  "Aseo del hogar": "El aseo del hogar es compra de reposición: sus clientes vuelven cada semana por lo mismo.",
  "Snacks salados": "Los snacks salados se venden más junto a las bebidas frías.",
  "Bebidas": "Una bebida fría se vende más que una a temperatura ambiente: el refrigerador es su mejor vendedor.",
  "Sopas instantáneas": "La sopa instantánea la inventó Momofuku Ando en Japón, en 1958.",
  "Bazar": "Las pilas son compra de urgencia: con tenerlas a la vista basta para venderlas.",
  "Despensa": "Tener despensa básica convierte la pasada por un dulce en una compra más grande.",
};
const CATEGORIA_PRODUCTO = {
  "Aseo del hogar": "Los productos de aseo son de reposición: el cliente vuelve por la misma marca cada semana.",
  "Bebidas": "Una bebida fría se vende más que una a temperatura ambiente.",
  "Despensa": "La despensa básica convierte la pasada por un dulce en una compra más grande.",
};

const sinTildes = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Asigna un dato a cada producto, en el orden en que se muestran (así los turnos quedan repartidos en las hojas).
export function asignarDatos(lista) {
  const turno = new Map();
  const toca = (clave) => { const k = turno.get(clave) || 0; turno.set(clave, k + 1); return k; };
  for (const p of lista) {
    const n = sinTildes(p.nombre);
    const marca = MARCA[p.marca] ? p.marca : Object.keys(MARCA).find((m) => n.includes(sinTildes(m)));
    const tipo = TIPO.find(([re, cats]) => cats.includes(p.categoria) && re.test(n));
    p.dato = '';
    if (marca && (toca('m:' + marca) % 2 === 0 || !tipo)) p.dato = MARCA[marca];
    else if (tipo) p.dato = tipo[2][toca(tipo[0].source) % tipo[2].length];
    else p.dato = CATEGORIA_PRODUCTO[p.categoria] || CATEGORIA[p.categoria] || '';
  }
  return lista;
}
