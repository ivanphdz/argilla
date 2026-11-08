# Anotador UI

Una pantalla de revisión amigable para historiadores, construida sobre la API
de Argilla 2.8. Reemplaza la página de anotación de Argilla por un flujo más
sencillo para personas que no están acostumbradas a herramientas técnicas: leer
la página, confirmar o corregir las marcas (PERSONA, LUGAR, FECHA), elegir cómo
quedó la página y enviarla.

Es una app web estática (React + Vite + TypeScript). **No** modifica Argilla ni
el backend de `annotation-review`: se comunica con la API REST de Argilla que ya
está corriendo.

## Pantallas

| Pantalla | Qué hace | Datos |
| --- | --- | --- |
| Inicio | Pide solo el nombre de quien revisa | Solo navegador |
| Documentos | Una fila por página (registro), con estado y conteos | Argilla |
| Revisar página | Marcar o corregir entidades, elegir decisión, notas, borrador o envío | Argilla |
| Agregar documento | Subir `.txt` / `.json` o pegar texto | Solo modo de prueba (ver abajo) |
| Lista de entidades | Todas las marcas de todas las páginas, filtros, "agrupar como la misma" | Argilla + navegador |
| Reglas sugeridas | Aprobar o descartar ideas de reglas | Solo navegador (reglas de ejemplo) |

## Acuerdo con `annotation-review`

El backend sella la configuración del dataset (preguntas, etiquetas, colores,
guía) y se niega a continuar si cambia. Por eso esta interfaz:

- **Lee** espacios de trabajo, datasets, preguntas, registros y sugerencias.
- **Escribe solo la respuesta del usuario actual** en un registro:
  - `POST /api/v1/records/{record_id}/responses` la primera vez,
  - `PUT /api/v1/responses/{response_id}` las siguientes,
  - cuerpo: `{"values": {"entities": {"value": [...]}, "decision": {"value": "..."}, "notes": {"value": "..."}}, "status": "draft" | "submitted"}`.
- **Nunca** escribe la configuración del dataset, los campos, los metadatos ni
  las sugerencias.
- Conserva las posiciones de las marcas tal como están guardadas: caracteres
  sobre el campo `text` original, fin exclusivo. Las entidades HTML del texto
  (`&amp;`, `&lt;`, ...) se decodifican solo para mostrarlas; las posiciones no
  se mueven.
- Usa los valores de decisión de `text.DECISIONS`:
  `complete_with_entities`, `complete_without_entities`,
  `needs_adjudication`, `not_annotatable`.
- Antes de enviar aplica las mismas reglas que `collect.py`: la decisión es
  obligatoria, "sin entidades" exige cero marcas, "Terminada" exige al menos
  una marca, y las dos decisiones de "ayuda / no revisable" piden una nota.

El campo review (`Documento (carpeta): ...\nArchivo: ...\n\n<candidatos>`) se
usa para el título de la página y se muestra debajo de la transcripción como
"Candidatos del modelo para revisar".

## Cómo correrla

Requiere Node 18 o superior.

```bash
cd anotador-ui
npm ci
npm run dev        # http://localhost:5173/anotador/
```

Sin ninguna configuración arranca en **modo de prueba** con las páginas de
ejemplo de los diseños (guardadas en el localStorage del navegador).

Para usar un Argilla encendido durante el desarrollo, el servidor de desarrollo
redirige `/api` a `http://127.0.0.1:6900` (se cambia con `ARGILLA_PROXY_TARGET`).
Abre **Ayuda → Cambiar conexión**, pega `ARGILLA_API_KEY` del archivo
`annotation-review/.env`, deja vacía la dirección del servidor y presiona
**Conectar**.

## Cómo incluirla en la imagen de Argilla

Argilla sirve en la raíz del sitio todos los archivos que estén en
`argilla_server/static/`, así que la app compilada queda disponible en
`http://127.0.0.1:6900/anotador/`, en el mismo origen que la API (sin CORS y
sin un servicio extra).

1. Compilar: `npm ci && npm run build` → `anotador-ui/dist/`.
2. Ubicar la carpeta static dentro de la imagen:

   ```bash
   docker compose -f annotation-review/compose.yaml --env-file annotation-review/.env \
     exec argilla python -c "import argilla_server, os; print(os.path.dirname(argilla_server.__file__))"
   ```

   Normalmente es `/opt/venv/lib/python3.13/site-packages/argilla_server`.
3. Copiarla en la extensión local de la imagen (`annotation-review/docker/Dockerfile`):

   ```dockerfile
   COPY --chown=argilla:argilla anotador-dist/ /opt/venv/lib/python3.13/site-packages/argilla_server/static/anotador/
   ```

   o montarla desde `compose.yaml` (servicio `argilla`):

   ```yaml
   volumes:
     - argilla:/var/lib/argilla
     - ../anotador-ui/dist:/opt/venv/lib/python3.13/site-packages/argilla_server/static/anotador:ro
   ```

4. Darle a la app su configuración de conexión con un archivo `config.json`
   junto a `index.html` (en la misma carpeta). Copia `public/config.example.json`,
   pega la clave de la API y deja `apiUrl` vacío. **No lo subas al repo**: contiene
   la clave (`public/config.json` está en `.gitignore`). Argilla copia la carpeta
   static al arrancar, así que hay que reiniciar el servicio `argilla` después de
   cambiarlo.

La interfaz original de Argilla sigue funcionando en `http://127.0.0.1:6900/`.

## Lo que todavía no está conectado al backend

Estas partes funcionan en la interfaz, pero solo guardan datos en el navegador.
Necesitan una decisión del backend para poder compartirse entre personas:

- **Agregar páginas desde la interfaz.** En modo Argilla, la ventana explica que
  las páginas se agregan con `history-review prepare` + `publish`. Haría falta un
  endpoint que aplique las mismas protecciones del corpus.
- **Nombre de quien revisa.** Argilla tiene un solo usuario local (`historiador`);
  el nombre escrito se recuerda por página en el navegador y se muestra como
  "Última revisión".
- **Grupos** en "Lista de entidades" y **reglas sugeridas**.
- **Marcas "Posible, por confirmar" en el texto.** El modo de prueba muestra los
  candidatos subrayados en rojo. En modo Argilla se muestran como texto del campo
  `review`, porque ese campo no trae posiciones. Si `history-ws` publicara las
  posiciones de los candidatos (por ejemplo, como una segunda sugerencia o en los
  metadatos), se podrían subrayar en rojo en su lugar.
- **Exportar JSON** descarga una vista rápida; la exportación oficial sigue siendo
  `history-review collect`.

## Estructura del proyecto

```
anotador-ui/
├── index.html
├── public/config.example.json   # plantilla de conexión
├── src/
│   ├── data/
│   │   ├── types.ts             # tipos compartidos (reflejan el esquema de annotation-review)
│   │   ├── argilla.ts           # conexión con la API REST de Argilla 2.8 (lectura + respuestas)
│   │   ├── demo.ts              # páginas de ejemplo del modo de prueba
│   │   ├── config.ts            # elección de la conexión
│   │   ├── local.ts             # reglas y grupos guardados en el navegador
│   │   └── text.ts              # palabras, posiciones, etiquetas y textos en español
│   ├── screens/                 # Inicio, Documentos, Revisión, Entidades, Reglas
│   ├── components/              # Estructura, ventanas modales, íconos
│   ├── store.tsx                # estado de la app
│   └── styles.css               # tokens de diseño y estilos
└── vite.config.ts               # base /anotador/, redirección a Argilla en desarrollo
```

Los nombres de variables y funciones del código se dejaron en inglés, como es
costumbre en programación; los comentarios y la documentación están en español.
