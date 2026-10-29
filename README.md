# Inventario de Campo · IDAF

App móvil (PWA instalable, Android/iOS/tablet) para que **técnicos externos** registren parcelas de inventario forestal en el Feature Service del proyecto **sin acceso al resto de la organización**. Formulario traducido del XLSForm de inventario de campo (Survey123), con sus cálculos, fotos como adjuntos, trabajo sin conexión y exportación a Excel.

Servicio: `services-eu1.arcgis.com/Aha5baNZi8JV5BWj/…/service_d0c61872f4324dde961c3f300c9995e1/FeatureServer` · Web map interno: `9dc9a92225f64ff3bb35b21c052afc54` (lee la misma capa, no hay que tocarlo).

## Estructura

```
inventario-campo/
├── index.html            App (cabecera, inicio, formulario por páginas, modal)
├── sw.js                 Modo sin conexión, caché de teselas y envío en segundo plano
├── manifest.webmanifest  Instalación como app
├── css/styles.css        Tema claro alto contraste · #004f29 / #77b72b
├── js/config.js          ← Archivo a editar (serviceUrl, campos opcionales, edición, GPS, rangos)
├── js/form-schema.js     Formulario traducido del XLSForm (páginas, campos, listas, repeats)
├── js/calc.js            Cálculos (Sup, Density, DensityTree) y comprobaciones
├── js/auth.js            Clave de acceso y servicio en Ajustes (como la app de instalaciones)
├── js/agol.js            REST de ArcGIS y traducción formulario ↔ campos
├── js/sync.js            Cola de envío (página y service worker)
├── js/db.js              Almacenamiento local (IndexedDB)
├── js/app.js             Interfaz
├── js/geo.js · photos.js · basemaps.js   UTM, compresión de fotos, mapas base
├── img/                  Logo IDAF (completo, marca clara para cabecera) e iconos
└── vendor/               Leaflet 1.9.4, SheetJS 0.18.5 (mini), Inter (licencias incluidas)
```

## Puesta en marcha (administrador)

### 1. Vista del proyecto (recomendado)
En AGOL, sobre la capa del survey: **Crear vista** → incluir la capa y las dos tablas (`InventarioTrees`, `InventarioGrass`).
En la vista: *Configuración › Edición* → **Agregar** y, si quieres edición, **Actualizar** (y **Eliminar** para poder quitar filas de especies al editar). Adjuntos activados.
Ventaja: la capa original y Survey123 de tus técnicos no cambian; la edición de externos se enciende/apaga en la vista.
Si una misma capa guardase varios proyectos, añade a la vista una **definición** que filtre el proyecto: la API key da acceso a todo lo que la vista muestre.

### 2. Clave de acceso (API key)
Igual que en la app de instalaciones (lo repite *Ajustes › Cómo conseguir la clave*):
1. Con la cuenta Creator: *Contenido › Nuevo elemento › Credenciales de desarrollador › Credenciales de clave de API*.
2. Privilegios: solo edición de entidades.
3. Acceso a elementos: solo la capa del proyecto («Técnico de campo 2»).
4. Caducidad corta (30 días) y genera la clave. Cópiala con el botón de copiar: solo se muestra completa una vez.
La API key tiene dos claves (primaria y secundaria): genera la segunda antes de que caduque la primera y repártela, así no hay corte.

### 2b. Servicio en `config.js`
`serviceUrl`: el servicio de la app (por defecto `service_d0c61872…`). Si creas una vista para externos, pon aquí la URL de la vista y da acceso a la API key solo a esa vista.

### 3. Campos recomendados (opcional)
Añadir al XLSForm como preguntas `hidden` y republicar (así Survey123 los conoce):
- `Operario` (text, 100): la app escribe el nombre que el técnico pone en Ajustes (opcional y declarado por él, no verificado). Sin el campo, **todos los externos con la misma API key ven y pueden editar todos los registros del proyecto**, y no hay trazabilidad (el editor en AGOL será el dueño de la API key).
- `Precision_GPS` (decimal): precisión en metros al fijar el punto.

### 4. Publicar la app
Cualquier hosting estático **HTTPS** (GitHub Pages, IIS, Azure Static Web Apps…). Subir la carpeta completa. Sin HTTPS no hay instalación, cámara fiable ni modo sin conexión.
En cada cambio publicado: subir `VERSION` en `sw.js`.

### 5. Entregar el token
Basta con enviar la clave para que la peguen en **Ajustes › Clave de acceso** y pulsen **Guardar y probar**.
La clave y el servicio se guardan siempre (también sin cobertura) y después se prueban; el resultado sale en una tabla (capa, geometría, crear, editar, adjuntos, GlobalID, tablas, campos). Si AGOL la rechaza se muestra su mensaje tal cual y se comprueba si la clave vale en ArcGIS Online (para separar «clave caducada» de «sin acceso a la capa»).

| Quiero… | Dónde |
|---|---|
| Dar acceso | API key con acceso al servicio/vista → clave en Ajustes |
| Fijar cuánto dura el acceso | Fecha de caducidad de la API key en AGOL |
| Renovar sin corte | Segunda clave de la API key → el técnico la pega en *Ajustes* antes de que caduque la primera |
| Cortar la edición a todos | Quitar «Actualizar» en la vista |
| Cortar el acceso a todos los de un proyecto | Revocar/regenerar la API key en AGOL |
| Cortar el acceso a un solo técnico | Solo dando un token distinto a cada técnico (una API key por técnico o por empresa) |

## Uso (técnico)
1. Primer uso: se abre **Ajustes** → pegar la clave de acceso (una vez) → **Guardar y probar**. El servicio viene puesto (`config.js`) y se puede cambiar ahí mismo. Nombre opcional. Sin clave se puede registrar igualmente: queda en el móvil. Instalar: menú de Chrome › *Añadir a pantalla de inicio*.
   Cuando la clave caduca (AGOL responde 498), la app avisa en el inicio (aviso rojo con el número de registros pendientes y botón a Ajustes). Al guardar la clave nueva, se envían.
2. **Nueva parcela** → 4 páginas: Datos generales · Caracterización · Estratos · Revisión. Todo se guarda solo como borrador.
3. **Ubicación**: se fija sola cuando el GPS baja de ±15 m (`gpsWarnAccuracy`); si no, tocar el mapa o arrastrar el marcador. Coordenadas en lat/lon y UTM ETRS89. Seis mapas base (ortofoto combinada Esri/PNOA, PNOA, Esri, híbrido, callejero Esri, callejero gris IGN).
4. **Fotos Norte y Sur** obligatorias (cámara o galería), reducidas a 1920 px.
5. **Estratos**: añadir tantas especies arbóreas/arbustivas como haga falta (tablas relacionadas, como los repeats de Survey123).
6. **Revisión**: métricas calculadas, avisos y lo que falta (con enlace a la pregunta) → **Enviar**.
7. Sin cobertura queda **Pendiente** y se envía solo al volver la conexión.
8. **Excel**: parcelas + especies con los cálculos, del móvil y/o del servidor.
9. **Enviados (editar)**: si la edición está activa, lista los registros del técnico en el servidor y permite editarlos.

## Cálculos (mismas fórmulas que el XLSForm)
| Campo | Fórmula | Unidad |
|---|---|---|
| `Sup` | π · Radio² / 10 000 | ha |
| `Density` | Ntrees / Sup | pies/ha |
| `DensityTree` | NPies / Sup (por especie) | pies/ha |

Añadidos en la app (no se guardan en la capa, sí en el Excel): superficie en m², Σ pies por especie, % de pies por especie, FCC total del matorral, aviso si Σ pies ≠ Nº árboles, avisos de rango (`ranges` en `config.js`; FCC 0–100 bloquea).

## Decisiones de diseño (y por qué)
- **PWA + REST en vez de ArcGIS Maps SDK.** El SDK de JavaScript no tiene edición sin conexión; el SDK nativo (Kotlin) sí, pero exige compilar, firmar y distribuir APK y revisar su licencia de despliegue. La PWA ya se validó contra AGOL en la app de instalaciones. Si el envío en segundo plano en iOS o la edición offline de datos descargados llegan a ser imprescindibles, el siguiente paso es Kotlin.
- **Token siempre en el cuerpo de un POST**, nunca en la URL (igual que la app de instalaciones v0.1.2). Incluye la lectura del servicio y la descarga de fotos al editar.
- **Una sola `applyEdits` de servicio** (`useGlobalIds`, `rollbackOnFailure`): parcela y filas de especies entran juntas o no entra nada. Si el servicio no la admite, envía por capa (parcela y luego filas con `parentglobalid`).
- **Sin duplicados**: GlobalID generado en el móvil; si se corta la respuesta, el siguiente intento consulta por GlobalID antes de repetir.
- **Fotos** como adjuntos de la parcela con `keywords` = `Foto_NS1`/`Foto_NS2` (igual que Survey123, se ven en Survey123 y en el web map). Al editar, la foto nueva se sube antes de borrar la antigua.
- **Acceso idéntico a la app de instalaciones v0.1.2**: Ajustes con «Clave de acceso (API key)» + «Servicio de entidades» + «Guardar y probar». Sin pantalla de inicio de sesión. La caducidad la controla AGOL; la app la detecta cuando el servidor rechaza la clave.
- **Registros ligados al servicio, no al token**: renovar el token no pierde pendientes.
- **Edición** solo si coinciden: `allowEdit` en `config.js` y operación «Actualizar» en la capa/vista.
- **Esquema leído en tiempo de ejecución**: si cambias campos en Survey123, la app se adapta; *Ajustes › Diagnóstico de la capa* lista las preguntas sin campo en la capa.
- **Tema claro** de alto contraste: legible a pleno sol; botones de 48 px mínimo.

## Seguridad (léelo)
- El token se guarda **en claro** en el móvil (lo necesita el envío en segundo plano) y viaja en claro en el mensaje con el que se envía. Quien lo copie entra en el proyecto hasta que caduque. Lo que limita el daño es su alcance: **solo la vista del proyecto** y solo las operaciones activadas en ella.
- Un token compartido por varios técnicos no identifica a nadie: el nombre lo escribe cada uno y en AGOL el editor será el dueño de la API key. Para trazabilidad o cortar a uno solo, un token por técnico o por empresa.
- La caducidad avisa al fallar, no antes: si caduca en mitad del campo, lo hecho queda pendiente en el móvil hasta pegar el nuevo token (con cobertura).
- Producción con revocación por persona y sin token en el móvil = **token broker** (pendiente).

## Errores detectados en el XLSForm
1. **`list_DNm` (m minúscula)** en la opción `12-20`: Survey123 distingue mayúsculas, la opción no aparece (en las capturas solo salen ≤12, 20-30, >30). La app la incluye; **corrígelo en el XLSForm** y añade el valor `2` al dominio de `DiamNomMed` si existe.
2. **`DiamBasalMed` es `select_multiple`** con dos clases excluyentes (≤3 / >3): permite marcar ambas. Debería ser `select_one`. La app mantiene el tipo para no romper el campo.
3. **`Pies_Menores`**: la pista dice «indicar número de pies menores» pero la pregunta es Sí/No. Decide si quieres un recuento (integer).
4. **`list_espec_bush`**: `Ulex spp`/`Aulaga` y `Asparagus acutifolius`/`Esparraguera silvestre` tienen nombre y etiqueta invertidos respecto al resto (nombre común → científico); y hay `name` con espacios («Jara blanca»), mala práctica en Survey123.
5. **`Ntrees` es `decimal`**: debería ser `integer`.
6. **Sin `required`** salvo las fotos (la app exige además la ubicación, porque es la geometría): monte, rodal y parcela pueden quedar vacíos (la app tampoco los exige, para respetar el XLSForm; activarlo es poner `required: true` en `form-schema.js`).
7. `Pino` (Pinus spp) y `Pino_carrasco` (P. halepensis) se solapan; `Labiernágo` lleva la tilde mal (Labiérnago). Retama, olivilla o coscoja figuran como arbóreas: confirmar criterio.

## Limitaciones conocidas
- **Envío en segundo plano con la app cerrada**: solo Chrome/Edge en Android (Background Sync). En iOS se envía al abrir la app con cobertura.
- **Mapas sin conexión**: solo las teselas ya vistas (hasta 4 000 en caché). No hay descarga previa de zona.
- Las fotos pierden los metadatos EXIF (incluida la posición GPS de la foto) al reducirlas.
- No borrar los datos del navegador con registros pendientes.
- Las teselas Esri se usan sin clave (válido para pruebas); en producción, pasarlas por la API key.
- Probado contra un FeatureServer simulado con el esquema típico de Survey123; **no** contra el servicio real (requiere token).

## Batería de pruebas (superada en simulación)
| # | Prueba | Esperado |
|---|---|---|
| 1 | Primer uso | Se abre Ajustes con el servicio puesto |
| 2 | Clave errónea | Se guarda, se prueba, mensaje de AGOL; aviso rojo en inicio |
| 3 | Clave válida + Guardar y probar | Tabla de diagnóstico |
| 4 | GPS ±6 m | Punto fijado solo |
| 5 | Radio 10, Nº árboles 25 | Densidad 795,8 pies/ha |
| 6 | Revisión sin Foto Sur | Bloquea y lleva a la pregunta |
| 7 | FCC 135 | Error, no deja enviar |
| 8 | Enviar con 2 arbóreas + 1 arbustiva | 1 applyEdits; filas con parentglobalid; 2 adjuntos con keywords |
| 9 | Sin conexión | Pendiente; se envía sola al volver |
| 10 | Corte tras guardar | Sin duplicados |
| 11 | Editar: nombre, quitar fila, cambiar foto | Cambios en servidor; foto vieja borrada |
| 12 | Quitar «Actualizar» en la capa | Edición oculta con motivo |
| 13 | Excel (móvil + servidor) | 3 hojas, una fila por parcela |
| 14 | Recargar sin red | La app abre |
| 15 | Quitar «Actualizar» y Guardar y probar | «Editar registros: Desactivado en AGOL» |
| 16 | Token caduca con un registro pendiente | Aviso rojo con pendientes; envía al guardar el nuevo |
| 17 | Cambiar nombre en Ajustes | Se guarda sin tocar la clave |

**Primera prueba real**: Ajustes › pega la clave › **Guardar y probar**, y pásame la tabla o el mensaje en rojo.
