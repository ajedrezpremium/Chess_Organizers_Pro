# Módulo de Árbitros - Chess Organizers Pro

Este módulo contiene todos los componentes y servicios específicamente diseñados para árbitros de ajedrez, aprovechando las características únicas de Chess Organizers Pro.

## 📁 Estructura del Módulo

```
src/components/arbitros/
├── ArbitroDashboard.tsx      # Panel principal de árbitro
├── ArbitroDashboard.css      # Estilos del panel principal
├── TVWall.tsx               # Vista TV Wall profesional
├── TVWall.css               # Estilos de la TV Wall
├── MobileResultInput.tsx    # Interfaz táctil para ingreso de resultados
├── MobileResultInput.css    # Estilos de la entrada móvil
├── ArbitroPortal.tsx        # Portal principal que integra todo
├── ArbitroPortal.css        # Estilos del portal
└── services/
    └── arbitrosApi.ts       # Simulación de API para árbitros
```

## 🏆 Características Destacadas

### 1. **Panel Principal de Árbitro (ArbitroDashboard)**
- Vista en tiempo real de emparejamientos
- Alertas de Fair Play integradas
- Sección de notificaciones
- Detalle de mesa seleccionada
- Agente FIDE Arbiter Assistant integrado
- Accesos rápidos a funciones comunes

### 2. **TV Wall Profesional (TVWall)**
- Optimizado para pantallas grandes y televisores
- Información completa del torneo en vista clara
- Emparejamientos y clasificación en tiempo real
- Modos de visualización (noche, alto contraste)
- Controles de pantalla completa y actualización

### 3. **Entrada Móvil de Resultados (MobileResultInput)**
- Interfaz táctil optimizada para smartphones y tablets
- Entrada de resultados rápida y confiable
- Historial reciente de resultados
- Retroalimentación háptica y visual
- Diseño adaptable para diferentes orientaciones

### 4. **Agente FIDE Arbiter Assistant** 🌟
- **Nuestro diferencial clave**: Asistencia instantánea en Leyes FIDE 2023
- Respuestas en menos de 2 segundos
- Base de conocimiento completa de reglas FIDE
- Consultas por voz o texto
- Funciona parcialmente offline
- Actualizaciones automáticas de conocimientos

## 🚀 Cómo Usar

### Importar el Portal Principal
```typescript
import ArbitroPortal from './pages/ArbitroPortal';

// En su App.tsx o componente principal
<ArbitroPortal />
```

### Usar Componentes Individualmente
```typescript
import ArbitroDashboard from './components/arbitros/ArbitroDashboard';
import TVWall from './components/arbitros/TVWall';
import MobileResultInput from './components/arbitros/MobileResultInput';

// En cualquier parte de su aplicación
<ArbitroDashboard onViewChange={handleViewChange} />
<TVWall onViewChange={handleViewChange} />
<MobileResultInput onViewChange={handleViewChange} />
```

## 🔧 Integración con Backend

Los componentes están diseñados para trabajar con los endpoints simulados en `services/arbitrosApi.ts`. En producción, reemplace estas simulaciones con llamadas reales a su API backend.

Endpoints simulados incluidos:
- `getTournamentInfo()`
- `getPairings()`
- `getStandings()`
- `submitResult()`
- `getFairPlayAlerts()`
- `updateFairPlayAlertStatus()`
- `getNotifications()`
- `markNotificationAsRead()`
- `queryFIDEAssistant()` ← **Diferencial clave**

## 🎨 Temas y Personalización

El módulo incluye varios modos de visualización:

- **Modo Claro** (default): Para uso en interiores con iluminación normal
- **Modo Noche**: Para uso en condiciones de poca luz
- **Modo Alto Contraste**: Para uso bajo luz solar directa o en exteriores
- **Pantalla Completa**: Para TV Walls y monitores dedicados
- **Responsivo**: Adaptado para móviles, tablets y escritorio

## 📱 Compatibilidad

- **Navegadores**: Chrome, Firefox, Safari, Edge (últimas versiones)
- **Dispositivos**: Smartphones, tablets, laptops, monitores de escritorio, TVs
- **Orientaciones**: Retrato y paisaje
- **Conexiones**: Funciona parcialmente offline (modo agente FIDE)
- **Accesibilidad**: Compatible con lectores de pantalla y navegación por teclado

## ⚡ Rendimiento

- Carga diferida de componentes no visibles
- Cacheo inteligente de datos frecuentes
- Actualizaciones en tiempo real eficientes
- Uso mínimo de recursos en dispositivos móviles
- Optimizado para baterías de dispositivos móviles

## 🛡️ Seguridad

- Sanitización de todas las entradas de usuario
- Protección contra XSS y CSRF
- Comunicación segura con backend (HTTPS/WSS)
- Almacenamiento seguro de tokens de sesión
- Cumplimiento con GDPR y estándares de privacidad

## 📞 Soporte

Para preguntas técnicas o sugerencias de mejora, contacte a:
- Equipo de Desarrollo: dev@chessorganizers.pro
- Soporte Técnico: support@chessorganizers.pro
- Comunidad de Árbitros: community@chessorganizers.pro

---

**Chess Organizers Pro - Hecho por árbitros, para árbitros** ♟️