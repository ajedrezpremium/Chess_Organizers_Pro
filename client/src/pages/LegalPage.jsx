import { useParams, Link } from 'react-router-dom';

const PAGES = {
  terms: {
    title: 'Términos y Condiciones',
    content: `
**1. Aceptación de los términos**
Al acceder y utilizar Chess Organizers Pro (en adelante, "la Plataforma"), el usuario acepta estar sujeto a los presentes Términos y Condiciones. Si no está de acuerdo con alguno de estos términos, deberá abstenerse de utilizar la Plataforma.

**2. Descripción del servicio**
Chess Organizers Pro es una plataforma de gestión de torneos de ajedrez que permite a organizadores crear, gestionar y promocionar eventos, así como a jugadores inscribirse y seguir resultados en tiempo real.

**3. Registro y cuenta**
El usuario debe registrarse proporcionando datos veraces y completos. La cuenta es personal e intransferible. El usuario es responsable de mantener la confidencialidad de sus credenciales y de todas las actividades realizadas bajo su cuenta.

**4. Uso permitido**
El usuario se compromete a utilizar la Plataforma exclusivamente para fines lícitos y de acuerdo con estos términos. Queda prohibido:
- Realizar actividades fraudulentas o engañosas
- Introducir malware, virus o cualquier código dañino
- Intentar acceder sin autorización a sistemas o datos de otros usuarios
- Utilizar la Plataforma para violar derechos de propiedad intelectual

**5. Propiedad intelectual**
Todo el contenido, diseño, logotipos y software de la Plataforma son propiedad de Chess Organizers Pro o sus licenciantes. El usuario no adquiere ningún derecho de propiedad sobre dicho contenido.

**6. Limitación de responsabilidad**
La Plataforma se proporciona "tal cual" sin garantías de ningún tipo. Chess Organizers Pro no será responsable por daños directos, indirectos, incidentales o consecuentes derivados del uso o la imposibilidad de uso del servicio.

**7. Modificaciones**
Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la Plataforma. El uso continuado del servicio tras dichas modificaciones constituye la aceptación de los nuevos términos.

**8. Ley aplicable**
Estos términos se rigen por la legislación española. Cualquier disputa será sometida a los tribunales de Madrid, España.

**9. Contacto**
Para consultas sobre estos términos, contáctenos en: legal@chessorganizers.com
    `,
  },
  privacy: {
    title: 'Política de Privacidad',
    content: `
**1. Responsable del tratamiento**
Chess Organizers Pro (en adelante, "el Responsable") es el responsable del tratamiento de los datos personales recabados a través de la Plataforma.

**2. Datos recopilados**
Recopilamos los siguientes datos personales:
- Datos de identificación: nombre, apellidos, correo electrónico
- Datos de perfil: fotografía, federación, rating FIDE, título
- Datos de uso: torneos creados, partidas jugadas, resultados
- Datos de navegación: dirección IP, tipo de navegador, páginas visitadas

**3. Finalidad del tratamiento**
Los datos se tratan con las siguientes finalidades:
- Prestar y gestionar los servicios de la Plataforma
- Permitir la inscripción en torneos y el seguimiento de resultados
- Enviar comunicaciones relacionadas con el servicio
- Mejorar la experiencia de usuario y la funcionalidad de la Plataforma
- Cumplir con obligaciones legales

**4. Base legal**
El tratamiento se basa en:
- La ejecución del contrato de servicios (RGPD art. 6.1.b)
- El consentimiento del usuario (RGPD art. 6.1.a)
- El interés legítimo del Responsable (RGPD art. 6.1.f)

**5. Conservación de datos**
Los datos se conservarán durante el tiempo necesario para cumplir con las finalidades del tratamiento y, en todo caso, durante los plazos legales establecidos.

**6. Derechos del usuario**
El usuario puede ejercer sus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose a: legal@chessorganizers.com

**7. Cesión de datos**
No cedemos datos personales a terceros salvo obligación legal o para la prestación del servicio (proveedores de hosting, pasarela de pago, etc.).

**8. Medidas de seguridad**
Implementamos medidas técnicas y organizativas adecuadas para proteger los datos personales contra accesos no autorizados, pérdida o destrucción.

**9. Transferencias internacionales**
Los datos pueden almacenarse en servidores ubicados en la Unión Europea y Estados Unidos (proveedores con certificación Privacy Shield).

**10. Modificaciones**
Esta política puede actualizarse periódicamente. Recomendamos revisarla con regularidad.
    `,
  },
  cookies: {
    title: 'Política de Cookies',
    content: `
**1. ¿Qué son las cookies?**
Las cookies son pequeños archivos de texto que se almacenan en el dispositivo del usuario al navegar por la Plataforma. Permiten recordar preferencias y mejorar la experiencia de navegación.

**2. Tipos de cookies utilizadas**

**Cookies técnicas (necesarias):**
Permiten la navegación básica y el funcionamiento de la Plataforma. No requieren consentimiento previo.
- Cookie de sesión (token de autenticación)
- Cookie de idioma

**Cookies analíticas:**
Recopilan información anónima sobre el uso de la Plataforma para mejorar su funcionamiento.
- Google Analytics (_ga, _gid, _gat): duración 1-2 años

**Cookies de preferencias:**
Recuerdan las preferencias del usuario para personalizar la experiencia.
- Preferencias de visualización (tema oscuro/claro)

**3. Gestión de cookies**
El usuario puede configurar su navegador para rechazar o eliminar cookies. A continuación, los enlaces para hacerlo en los navegadores más comunes:
- Chrome: Configuración → Privacidad y seguridad → Cookies
- Firefox: Opciones → Privacidad y seguridad → Cookies
- Safari: Preferencias → Privacidad → Cookies
- Edge: Configuración → Cookies y permisos

**4. Cookies de terceros**
La Plataforma puede incluir cookies de servicios de terceros (Google Analytics, Stripe, etc.) que están sujetas a sus propias políticas de privacidad.

**5. Consentimiento**
Al hacer clic en "Aceptar" en el aviso de cookies, el usuario consiente el uso de cookies según esta política. Puede retirar su consentimiento en cualquier momento.

**6. Actualizaciones**
Esta política de cookies puede actualizarse periódicamente. La fecha de la última actualización se indica al final del documento. Última actualización: Julio 2026.
    `,
  },
  notice: {
    title: 'Aviso Legal',
    content: `
**1. Identificación del titular**
Chess Organizers Pro
Correo electrónico: legal@chessorganizers.com

**2. Propiedad intelectual e industrial**
Todos los contenidos de la Plataforma (textos, imágenes, logotipos, diseño, código fuente) están protegidos por derechos de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución o modificación sin autorización expresa del titular.

**3. Exención de responsabilidad**
El titular no se hace responsable de:
- Los errores u omisiones en los contenidos de la Plataforma
- El uso indebido que los usuarios puedan hacer de la Plataforma
- Los daños derivados del acceso o la imposibilidad de acceso a la Plataforma
- Los contenidos de sitios web de terceros a los que se pueda acceder mediante enlaces

**4. Legislación aplicable**
Este aviso legal se rige por la legislación española. Para cualquier controversia relacionada con la Plataforma, las partes se someten a la jurisdicción de los tribunales de Madrid.

**5. Condiciones de uso**
El usuario se compromete a hacer un uso adecuado de la Plataforma y a no emplearla para actividades ilícitas o contrarias a la buena fe. El titular se reserva el derecho de suspender o cancelar el acceso a la Plataforma en caso de incumplimiento de estas condiciones.

**6. Enlaces externos**
La Plataforma puede contener enlaces a sitios web externos. El titular no asume ninguna responsabilidad sobre el contenido, políticas de privacidad o prácticas de dichos sitios.

**7. Redes sociales**
La interacción del usuario en las redes sociales oficiales de Chess Organizers Pro se rige por las políticas de privacidad y condiciones de uso de cada plataforma (X, Facebook, Instagram, etc.).

**8. Contacto**
Para cualquier consulta relacionada con este aviso legal, puede dirigirse a: legal@chessorganizers.com
    `,
  },
};

export default function LegalPage() {
  const { page } = useParams();
  const legal = PAGES[page] || PAGES.terms;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-fide-950">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-fide-600 dark:text-fide-400 hover:text-fide-800 dark:hover:text-fide-200 mb-8 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Volver al inicio
        </Link>

        <div className="bg-white dark:bg-fide-900 rounded-2xl shadow-sm border border-gray-200 dark:border-fide-800 p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">{legal.title}</h1>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            {legal.content.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <h2 key={i} className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-8 mb-4">{line.replace(/\*\*/g, '')}</h2>;
              }
              if (line.trim().startsWith('- ')) {
                return <li key={i} className="text-gray-600 dark:text-gray-400 ml-4 mb-1">{line.trim().substring(2)}</li>;
              }
              if (line.trim() === '') return <div key={i} className="h-2" />;
              return <p key={i} className="text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">{line.trim()}</p>;
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {Object.entries(PAGES).map(([key, p]) => (
            <Link
              key={key}
              to={`/legal/${key}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                key === page
                  ? 'bg-fide-700 text-white'
                  : 'bg-white dark:bg-fide-900 text-fide-600 dark:text-fide-400 border border-gray-200 dark:border-fide-800 hover:border-fide-400'
              }`}
            >
              {p.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
