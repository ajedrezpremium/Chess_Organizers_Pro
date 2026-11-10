const fs = require('fs');
const p = 'C:\\Users\\param\\Documents\\CHESS ORGANIZERS PRO\\api\\_src\\data\\arbiter-cases.js';
let s = fs.readFileSync(p, 'utf8');
const idx = s.lastIndexOf('];');
if (idx === -1) throw new Error('no');
const cases = `
  ,{ id: 'TD-01', cat: 'direccion', topic: 'Función del árbitro director', patterns: ['funcion del arbitro director', 'director de competicion', 'principal funcion arbitro', 'rol del director del torneo', 'objetivo arbitro director'], a: '(a) Regla/procedimiento: Leyes FIDE Art. 4 y B.01. (b) Pasos: garantizar aplicacion uniforme de leyes/bases, decisiones técnicas, resolver incidencias, publicar emparejamientos/resultados/clasificaciones y remitir TRF/rating. (c) Observaciones: no sustituye al Comite de Apelacion en recursos.', article: '4', title: 'Función del árbitro director' }
`;
s = s.slice(0, idx) + cases + s.slice(idx);
fs.writeFileSync(p, s, 'utf8');
console.log('done');
