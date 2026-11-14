# Mi colección de manga

PWA personal y offline-first para saber qué tomos tengo de cada serie y cuál toca comprar.
Vue 3 + TypeScript + Vite, Pinia, Dexie (IndexedDB) y `vite-plugin-pwa`. Sin backend ni APIs externas.

## Comandos

```bash
pnpm install
pnpm dev            # desarrollo (sin service worker)
pnpm test          # Vitest: huecos/siguiente tomo, export/import, migraciones
pnpm build         # typecheck + build de producción en dist/
pnpm preview       # sirve dist/ con el service worker real
pnpm icons         # regenera los iconos PWA desde public/logo.svg
```

## Probar en el móvil

El service worker necesita HTTPS o `localhost`. Dos opciones:

- **USB, sin desplegar**: `pnpm build && pnpm preview`, y con el móvil conectado
  `adb reverse tcp:4173 tcp:4173`. Abrir `http://localhost:4173` en Chrome del móvil.
- **Desplegado**: Cloudflare Pages o Netlify con comando `pnpm build` y directorio `dist`.
  No hacen falta reglas de redirección (el router usa hash y las rutas de assets son relativas).

Lista de comprobación en el móvil: instalar → modo avión → cerrar y reabrir → añadir/editar →
foto de portada → exportar.

## Estructura

```
src/
  db/           esquema Dexie (MIGRATIONS), tipos y repositorio
  stores/       Pinia: estado en memoria + derivados
  composables/  useBackup, useStoragePersistence, useInstallPrompt, useTheme, useToast
  components/   tarjeta, portada lazy, diálogos, navegación, aviso de actualización
  views/        SeriesList, SeriesDetail, SeriesForm, Shopping, Settings
  utils/        collection (huecos/siguiente), text, image, backup
tests/
```

El código (identificadores, comentarios, tests, campos de la base de datos y rutas) va en inglés;
los textos de la interfaz, en español.

## Cambiar el esquema de datos

- **IndexedDB**: añadir una entrada nueva al final de `MIGRATIONS` en `src/db/schema.ts`
  (nunca editar una ya publicada). El test de migraciones recorre todo el historial.
- **Formato de copia**: subir `BACKUP_VERSION` en `src/utils/backup.ts` y convertir las copias antiguas en `parseBackup`.
