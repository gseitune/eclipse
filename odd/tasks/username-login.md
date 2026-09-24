# username-login

**Objetivo**: Logear con nombre de usuario + contraseña (sin correo) para los organizadores.

**Problema/Why**: Gabriel y Andi no quieren escribir el email al entrar; "gabi" y "andi" + password alcanza.

**Scope**: schema User (username unique), auth lib, POST /api/auth/login, form OrganizerLogin.tsx, front api.login, scripts/create-organizer.ts. Sin registro público (sigue el script).

**Criterios de aceptación**:
- Login con username+password funciona; username normalizado (trim + lowercase), único.
- El login por email sigue funcionando por compatibilidad (identificador = username O email).
- Cuenta existente gabi → username "gabi" (backfill migration/script).
- Andi se crea después con username "andi" (password pendiente del usuario).
- Suite completa verde + lint + tsc.

**Checks**: npm test · npm run lint · npx tsc --noEmit

**Estado**: COMPLETADO ✅

**Commit**: `feat(auth): login by username or email`
**Evidencia**:
- `prisma/schema.prisma` → `username String @unique @default("")` agregado
- Migración `20260924153921_add_user_username` aplicada exitosamente
- Backfill: usuario gabi → username "gabi" verificado en DB
- `src/lib/auth.ts` → `login(identifier, password)` resuelve por username O email (username primero)
- `src/app/api/auth/login/route.ts` → acepta `{ identifier, password }`, responde `{ ok:true, email, username }`
- `src/app/organizador/OrganizerLogin.tsx` → campo "Usuario" con autoComplete="username"
- `src/lib/front/api.ts` → envía `{ identifier, password }`
- `src/lib/front/types.ts` → `LoginResponse` incluye `username`
- `scripts/create-organizer.ts` → 3 args: `email username password`
- `src/lib/auth.test.ts` → 6 tests nuevos (username, email, normalización, rechazo)
- **Verificación**: npm test → 111 tests (105 + 6 nuevos) todos pass · npm run lint → clean · npx tsc --noEmit → clean