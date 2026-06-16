# MeleFlow — Presentation Deck

> Slides para presentar MeleFlow en entorno corporativo.
> Formato Markdown — compatible con [Marp](https://marp.app/) para VS Code.

---

## Slide 1 — Portada

# MeleFlow 🏄

**Self-hosted task management para equipos**

Plataforma web + Android APK con notificaciones push, calendario, hábitos y productividad.

---

## Slide 2 — El problema

### Gestión de tareas actual

- Herramientas externas = datos fuera de nuestro control
- Soluciones SaaS = costes recurrentes por usuario
- Ninguna herramienta cubre TODO: tareas, hábitos, fichaje, proyectos
- La información está dispersa (Slack, Trello, email, Excel)

### Nuestra visión

> Una plataforma unificada, autoalojada, que cubra desde la productividad personal hasta la gestión de equipos.

---

## Slide 3 — Qué es MeleFlow (hoy)

### Productividad personal

✅ **Tareas** — listas, etiquetas, prioridades, checklist, adjuntos  
✅ **Hábitos** — seguimiento visual con rachas, calendario, skip  
✅ **Calendario** — vista mensual y agenda con tareas + eventos ICS  
✅ **Pomodoro** — timer de enfoque integrado  
✅ **Kanban** — arrastrar tareas entre columnas  
✅ **Matriz Eisenhower** — priorizar por urgencia/importancia  
✅ **Estadísticas** — productividad semanal/mensual  

### Cross-platform

🌐 **Web** — navegador, funciona en cualquier dispositivo  
📱 **Android** — APK sideload, push notifications  
📧 **Email** — recordatorios configurables por SMTP  

---

## Slide 4 — Stack técnico

```
Frontend:    React 19 + TypeScript + Tailwind CSS v4
Backend:     Node.js 20 + Fastify 5 + Prisma ORM
Base datos:  PostgreSQL 16 + Redis 7
Apps:        Capacitor 7 (Android APK nativo)
Infra:       Docker Compose (cualquier servidor Linux/NAS)
```

**Seguridad:**
- JWT + Refresh Tokens
- 2FA (TOTP)
- CSP, rate limiting, SQL injection protegido (ORM)
- CORS configurable

---

## Slide 5 — Demo en vivo

### Arrancar la app

```
http://localhost:3001
```

### Recorrido rápido (5 min)

1. **Dashboard** — vista general con tareas + hábitos
2. **Crear tarea rápida** — NLP input: _"Revisión presupuesto el viernes a las 10:00 #urgente"_
3. **Listas y etiquetas** — organizar por proyectos / áreas
4. **Kanban** — arrastrar tareas entre columnas
5. **Hábitos** — calendario visual, marcar completado/skip/fallado
6. **Calendario** — vista mensual con tareas y eventos ICS
7. **Notificaciones** — programar recordatorio, comprobar correo y push
8. **Estadísticas** — productividad semanal
9. **Panel administrador** — configurar SMTP, usuarios, logo

---

## Slide 6 — Notificaciones

### Triple canal configurable

```
📧 Email          →  SMTP propio (Gmail, Outlook, servidor corporativo)
📱 Push (APK)     →  Firebase Cloud Messaging (incluso app cerrada)
🌐 Navegador      →  Web Notification API (con pestaña abierta)
```

Cada usuario elige qué canales quiere activar desde su perfil.

**Ejemplo práctico:**
- Te asignan una tarea → recibes push al móvil
- Si no la marcas a tiempo → correo de recordatorio
- Mientras trabajas en el navegador → notificación en pantalla

---

## Slide 7 — Despliegue

### Requisitos mínimos

| Recurso | Mínimo |
|---------|--------|
| CPU | 2 cores |
| RAM | 2 GB |
| Disco | 10 GB |
| SO | Linux (NAS Synology, VPS, servidor) |

### Instalación (10 minutos)

```bash
git clone <repo> meleflow && cd meleflow
cp .env.example .env
docker compose up -d
```

➡️ App lista en `http://servidor:3001`

---

## Slide 8 — El APK Android

### Características

- **Tamaño:** 5.7 MB
- **Android 12+** (Pixel, Samsung, Xiaomi, etc.)
- **Notificaciones push** via Firebase Cloud Messaging
- **Sin Google Play** — sideload directo desde GitHub Releases
- **URL configurable** — cada usuario pone la IP de su empresa al iniciar

### Demo rápida

1. Descargar `meleflow-v1.0.0.apk` de GitHub Releases
2. Instalar en el móvil (permitir "orígenes desconocidos")
3. Abrir la app → configurar URL del servidor
4. Iniciar sesión → las notificaciones push se activan solas

---

## Slide 9 — Roadmap corporativo

### Fase 1 — Hoy (MeleFlow personal)

✅ Web + Android APK  
✅ Tareas, hábitos, calendario, pomodoro  
✅ Kanban, Eisenhower, estadísticas  
✅ Notificaciones multi-canal  
✅ 2FA, roles, panel admin  
✅ Docker Compose, GitHub Releases  

### Fase 2 — Próximo (MeleFlow Corp)

🔄 **Proyectos y equipos**  
🔄 **Tareas colaborativas** (asignación, comentarios)  
🔄 **Time tracking** (fichaje laboral)  
🔄 **Paneles de equipo** (carga de trabajo, Gantt)  
🔄 **Permisos por proyecto**  

### Fase 3 — Futuro

⏳ Integración con Slack / Teams  
⏳ iOS app  
⏳ API pública para integraciones  

---

## Slide 10 — Por qué apostar por MeleFlow

### Ventajas frente a alternativas

| | **MeleFlow** | Trello | Notion | Jira | Asana |
|---|---|---|---|---|---|
| **Autoalojado** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Sin coste por usuario** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **APK Android** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Hábitos personales** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Código abierto** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Push notifications** | ✅ | ❌ | ❌ | ❌ | ❌ |

### Datos para la empresa

- $0 en licencias
- Sin límite de usuarios
- Datos en tu propio servidor
- Personalizable al 100%
- Soporte técnico interno

---

## Slide 11 — Cierre

### MeleFlow hoy

✅ Producto funcional listo para usar  
✅ Código abierto (GitHub)  
✅ Demo disponible en 10 minutos  

### Lo que necesitamos para el siguiente paso

🗣️ **Feedback del equipo** — ¿qué funciones añadiríais?  
👥 **Usuarios beta** — cuantos más, mejor para priorizar  
💡 **Ideas** — este proyecto es vuestro  

---

## Slide 12 — Contacto

**Repositorio:** https://github.com/lamelero/MeleFlow  
**Documentación:** README.md incluido en el repo  
**APK:** GitHub Releases (v1.0.0)

### Preguntas
