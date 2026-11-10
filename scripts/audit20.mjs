import fs from 'fs';

const qs = [
 "¿Cuál es la principal función de un árbitro director de competición en un torneo de ajedrez?",
 "¿Qué debe incluirse en las bases oficiales de un torneo FIDE Suizo?",
 "¿Cómo se valida la inscripción de un participante y qué datos son obligatorios?",
 "¿Qué hacer si un jugador tiene rating FIDE desactualizado en la lista de participantes?",
 "¿Cómo se generan los emparejamientos en la ronda 1 de un Suizo holandés?",
 "¿Qué criterios usa el sistema holandés para emparejar en rondas posteriores?",
 "¿Cómo se corrigen manualmente una pareja ya generada sin romper el sorteo?",
 "¿Qué resultados se pueden registrar (1-0, 0-1, ½-½, incomparecencia) y cómo afectan?",
 "¿Cómo manejar un resultado en desacuerdo entre los jugadores?",
 "¿Qué es un 'walkover' y cómo se puntúa en FIDE?",
 "¿Cómo se calcula la clasificación provisional y final?",
 "¿Qué desempates recomienda FIDE y en qué orden se aplican?",
 "¿Cómo funciona el Buchholz y cuándo usar Buchholz cortado 1?",
 "¿Cómo se prepara y valida un reporte FIDE para rating (TRF)?",
 "¿Qué datos debe contener el TRF para ser aceptado por FIDE?",
 "¿Qué debe hacer el árbitro si falta un jugador en la ronda 2?",
 "¿Cómo tratar una reclamación de tablas por triple repetición?",
 "¿Qué sanciones puede aplicar el árbitro por llegada tardía (art. 6.7)?",
 "¿Cómo publicar emparejamientos y resultados en el portal público?",
 "¿Cómo clonar o reutilizar la configuración de un torneo anterior?",
];

const out = [];
for (let i = 0; i < qs.length; i++) {
  const q = qs[i];
  try {
    const res = await fetch('http://localhost:4000/ai/fide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, lang: 'es' }),
    });
    const data = await res.json();
    out.push({ n: i + 1, q, res: data });
    console.log(`#${i+1} done`, res.status);
  } catch (e) {
    out.push({ n: i + 1, q, error: e.message });
    console.log(`#${i+1} error`, e.message);
  }
}
fs.writeFileSync('C:/Users/param/AppData/Local/Temp/opencode/test20.json', JSON.stringify(out, null, 2));
console.log('saved');
