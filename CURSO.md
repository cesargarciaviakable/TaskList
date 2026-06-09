# SAP CAP — Curso paso a paso

## 1. Extensiones VS Code instaladas

- SAP CDS Language Support
- SAP Fiori Tools

---

## 2. Permisos npm corregidos

macOS no permite installs globales en `/usr/local` sin sudo.

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

---

## 3. CAP CLI instalado

```bash
npm install -g @sap/cds-dk   # versión 9.9.2
```

---

## 4. Proyecto creado

```bash
cd ~/Desktop/01-Proyectos/SAP
cds init my-first-cap
```

**Error encontrado:** CAP 9.x ya no genera `package.json` por defecto → `npm install` fallaba con ENOENT.

**Fix:**
```bash
cd my-first-cap
cds add nodejs
```

---

## 5. Modelo de datos (`db/schema.cds`)

```cds
using { cuid, managed } from '@sap/cds/common';

namespace my.first;

entity Tasks : cuid, managed {
  title       : String(100);
  description : String(500);
  status      : String(20) default 'Open';
}
```

- `cuid` → UUID automático
- `managed` → `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` automáticos

---

## 6. Servicio OData (`srv/task-service.cds`)

```cds
using my.first as mf from '../db/schema';

service TaskService {
  entity Tasks as projection on mf.Tasks;
}
```

- Expone Tasks como endpoint OData V4 en `/odata/v4/task/Tasks`

---

## 7. Servidor corriendo

```bash
cds watch
```

- CAP crea SQLite en memoria, genera el schema y expone CRUD completo automáticamente

---

## 8. Datos de prueba (`db/data/my.first-Tasks.csv`)

Nombre del archivo = `{namespace}-{entity}.csv` — CAP lo detecta y carga automáticamente.

```csv
ID,title,description,status
e1f2a3b4-0001-0000-0000-000000000001,Aprender CAP,Entender modelos y servicios,Open
e1f2a3b4-0002-0000-0000-000000000002,Conectar HANA Cloud,Configurar credenciales BTP,Open
e1f2a3b4-0003-0000-0000-000000000003,Crear UI Fiori,Construir primer List Report,In Progress
```

---

## 9. UI Fiori Elements generada (`app/tasks/`)

Generada con **Fiori: Open Application Generator** en VS Code.

**Template Selection**
- List Report Page → genera una pantalla con tabla y filtros automáticamente desde el metadata OData. Es el más común en S/4HANA para mostrar listados de registros.

**Data Source**
- Use a Local CAP Project → detecta el proyecto CAP corriendo localmente sin necesitar una URL manual
- CAP Project: `my-first-cap` → seleccionado automáticamente
- OData Service: `TaskService` → seleccionado automáticamente

**Entity Selection**
- Main Entity: `Tasks`
- Automatically add table columns: Yes → Fiori Tools lee el metadata y genera las columnas sin definirlas manualmente
- Table Type: Responsive → se adapta a desktop, tablet y móvil

**Project Attributes**
- Module Name: `tasks`
- Application Title: `Task Manager`
- Application Namespace: `my.first`
- Enable TypeScript: No
- Use Virtual Endpoints for Local Preview: Yes → permite previsualizar con autenticación simulada sin BTP real
- Configure Advanced Options: No

**Fiori Launchpad Configuration**
- Semantic Object: `Tasks`
- Action: `display`
- Title: `Task Manager`

---

## 10. UI Fiori Elements explorada en el browser

- List Report muestra la tabla con las 3 filas del CSV
- Click en una fila abre el Object Page con title, description y status
- Botón de eliminar funciona out of the box

---

## 11. Anotaciones CDS — `@UI.HeaderInfo`

Agregada en `app/tasks/annotations.cds`. El Object Page muestra el title como header principal y status como subtítulo.

```cds
UI.HeaderInfo : {
  TypeName       : 'Task',
  TypeNamePlural : 'Tasks',
  Title          : { Value : title },
  Description    : { Value : status },
},
```

---

## 12. Anotaciones CDS — `@UI.SelectionField`

Agrega un filtro por status en la barra de búsqueda de la List Report.

```cds
UI.SelectionFields : [ status ],
```

---

## 13. Anotaciones CDS — `@Common.ValueList` con entidad de soporte

**Problema encontrado:** CAP no expone enums como endpoints OData automáticamente.

**Fix:** entidad `Statuses` separada como fuente de valores.

Cambios realizados:
- `schema.cds` → tipo `TaskStatus` con enum + entidad `Statuses`
- `task-service.cds` → `@readonly entity Statuses` expuesta dentro del service
- `db/data/my.first-Statuses.csv` → seed data con Open, In Progress, Done
- `annotations.cds` → `@Common.ValueList` apuntando a Statuses + `ValueListWithFixedValues: true`

El campo **status** ahora es un dropdown en lugar de texto libre.

---

## 14. Conexión a HANA Cloud

Contexto: CAP usa HDI containers — no conexión directa host/usuario/contraseña. La arquitectura es `CAP app → HDI Container → HANA Cloud`.

**Problema encontrado:** `.env` con credenciales directas no funciona con `@cap-js/hana` — requiere service binding.

**Driver instalado:**
```bash
cds add hana
npm install
```

Agrega `@cap-js/hana` en dependencies. En dev sigue usando SQLite, en producción usa HANA.

**CF CLI instalado:**
```bash
brew install cloudfoundry/tap/cf-cli@8
cf login -a https://api.cf.us10-001.hana.ondemand.com
```

**HDI Container creado:**
```bash
cf create-service hana hdi-shared my-first-cap-db
```

Requería que la instancia HANA Cloud estuviera mapeada al CF space correcto en BTP Cockpit (Instance Mapping → Environment Instance ID = space GUID, Environment Group = org GUID).

**Binding local:**
```bash
cds bind -2 my-first-cap-db
```

Genera `.cdsrc-private.json` con el binding al profile `hybrid`. Este archivo es local, no va a git.

**Schema deployado a HANA:**
```bash
cds deploy --to hana --profile hybrid
```

**App corriendo contra HANA Cloud:**
```bash
cds watch --profile hybrid
```

**Gotchas:**
- API endpoint del trial es `us10-001`, no `us10`
- Las instancias HANA Cloud trial se detienen automáticamente por inactividad — siempre verificar que esté corriendo antes de desarrollar
- Sin el Instance Mapping en BTP Cockpit, `cf create-service` falla con "no database available"

---

## 15. Autenticación — Proteger el servicio con `@requires`

Contexto: CAP soporta autorización declarativa mediante anotaciones CDS. No requiere código adicional.

**Cambio realizado en `srv/task-service.cds`:**

```cds
@requires: 'authenticated-user'
service TaskService {
  @requires: 'Tasks.Write'
  entity Tasks as projection on mf.Tasks;

  @readonly entity Statuses as select from mf.Statuses;
}
```

- `@requires: 'authenticated-user'` en el servicio → cualquier usuario autenticado puede acceder
- `@requires: 'Tasks.Write'` en la entidad → solo usuarios con ese scope pueden crear/modificar/eliminar
- `@readonly` en Statuses → lectura libre para cualquier usuario autenticado

Verificación local con `cds watch`: el browser mostró popup de usuario/contraseña (mock auth de CAP).

---

## 16. Autenticación — XSUAA: scopes y roles

XSUAA es el servicio de autenticación de BTP. Usa OAuth 2.0 con JWT.

```bash
cds add xsuaa
```

**`xs-security.json` configurado manualmente:**

```json
{
  "xsappname": "my-first-cap",
  "tenant-mode": "dedicated",
  "oauth2-configuration": {
    "redirect-uris": [
      "https://my-first-cap-approuter.cfapps.us10-001.hana.ondemand.com/**"
    ]
  },
  "scopes": [
    { "name": "$XSAPPNAME.Tasks.Read",  "description": "Read tasks" },
    { "name": "$XSAPPNAME.Tasks.Write", "description": "Create and update tasks" }
  ],
  "attributes": [],
  "role-templates": [
    {
      "name": "Viewer",
      "description": "Can read tasks",
      "scope-references": [ "$XSAPPNAME.Tasks.Read" ]
    },
    {
      "name": "Editor",
      "description": "Can read and write tasks",
      "scope-references": [ "$XSAPPNAME.Tasks.Read", "$XSAPPNAME.Tasks.Write" ]
    }
  ]
}
```

- `$XSAPPNAME` es un placeholder que XSUAA reemplaza automáticamente en runtime
- `tenant-mode: dedicated` es obligatorio para apps single-tenant (el trial usa `shared` por defecto)

---

## 17. Autenticación — Crear servicio XSUAA en CF y bindear localmente

```bash
cf create-service xsuaa application my-first-cap-xsuaa -c xs-security.json
cds bind -2 my-first-cap-xsuaa
npm install @sap/xssec
```

`.cdsrc-private.json` ahora contiene dos bindings bajo el profile `hybrid`:
- `db` → HDI Container (HANA)
- `auth` → XSUAA

**Verificación con `cds watch --profile hybrid`:**
- Log muestra `using auth strategy { kind: 'xsuaa' }`
- Acceder al endpoint OData sin token devuelve `401 Unauthorized` — correcto, XSUAA espera JWT, no Basic Auth

**Gotchas:**
- `@sap/xssec` no se instala automáticamente — hay que ejecutar `npm install @sap/xssec` manualmente
- No se puede cambiar `tenant-mode` con `cf update-service` si el servicio fue creado con `shared` → hay que borrarlo y recrearlo:

```bash
cf delete-service-key my-first-cap-xsuaa my-first-cap-xsuaa-key
cf delete-service my-first-cap-xsuaa
cf create-service xsuaa application my-first-cap-xsuaa -c xs-security.json
cds bind -2 my-first-cap-xsuaa
```

---

## 18. Deploy en BTP — Backend CAP

**`manifest.yml`** creado en la raíz del proyecto:

```yaml
---
applications:
  - name: my-first-cap
    path: gen/srv
    buildpacks:
      - nodejs_buildpack
    memory: 256M
    instances: 1
    services:
      - my-first-cap-db
      - my-first-cap-xsuaa
```

**Compilación y deploy:**

```bash
cds build --production
cf push
```

- `cds build --production` genera la carpeta `gen/srv/` con el proyecto compilado listo para CF
- `cf push` lee el `manifest.yml` y bindea los servicios automáticamente

URL del backend: `https://my-first-cap.cfapps.us10-001.hana.ondemand.com`

**Gotcha:**
- Si HANA Cloud trial está detenida, el deploy falla con `HANA Database instance is stopped` — verificar siempre que esté corriendo en BTP Cockpit antes de hacer `cf push`

---

## 19. Deploy en BTP — Application Router (Approuter)

Contexto: La UI Fiori Elements es un archivo estático. Necesita un **Application Router** (`@sap/approuter`) como punto de entrada único que:
1. Maneja el flujo OAuth 2.0 con XSUAA (login, callback, tokens)
2. Sirve los archivos estáticos de la UI
3. Hace proxy de los requests autenticados al backend CAP con el JWT

**Estructura creada:**

```
approuter/
  package.json
  xs-app.json
  resources/      ← archivos copiados de app/tasks/webapp/
```

**`approuter/package.json`:**
```json
{
  "name": "my-first-cap-approuter",
  "version": "1.0.0",
  "scripts": {
    "start": "node node_modules/@sap/approuter/approuter.js"
  },
  "dependencies": {
    "@sap/approuter": "*"
  }
}
```

**`approuter/xs-app.json`:**
```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/(.*)$",
      "target": "/odata/$1",
      "destination": "cap-backend",
      "authenticationType": "xsuaa"
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "localDir": "resources",
      "authenticationType": "xsuaa"
    }
  ]
}
```

**Archivos de la UI copiados:**
```bash
cp -r app/tasks/webapp/* approuter/resources/
```

**`manifest.yml` final** (el approuter reemplaza a `my-first-cap-ui`):

```yaml
---
applications:
  - name: my-first-cap
    path: gen/srv
    buildpacks:
      - nodejs_buildpack
    memory: 256M
    instances: 1
    services:
      - my-first-cap-db
      - my-first-cap-xsuaa

  - name: my-first-cap-approuter
    path: approuter
    buildpacks:
      - nodejs_buildpack
    memory: 128M
    instances: 1
    services:
      - my-first-cap-xsuaa
    env:
      destinations: >
        [{"name":"cap-backend","url":"https://my-first-cap.cfapps.us10-001.hana.ondemand.com","forwardAuthToken":true}]
```

- `forwardAuthToken: true` → el approuter adjunta el JWT en cada request al backend CAP

**Cambio requerido en `approuter/resources/manifest.json`:**
```json
"sap.fe": {
  "app": {
    "enableLazyLoading": false
  }
}
```

**Gotchas:**
- `enableLazyLoading: true` hace que Fiori Elements intente cargar componentes via FLP shell — que no existe en este deploy. Debe estar en `false`
- Las `redirect-uris` en `xs-security.json` son obligatorias — sin ellas XSUAA rechaza el callback OAuth con error de configuración

---

## 20. Asignación de roles al usuario en BTP Cockpit

Contexto: El JWT de XSUAA contiene los scopes del usuario. Sin asignarlos, CAP devuelve `403` aunque el usuario esté autenticado.

**Pasos en BTP Cockpit:**
1. Security → Role Collections → Crear role collection `TasksEditor`
2. Agregar los roles `Viewer` y `Editor` (definidos en `xs-security.json`)
3. Asignar la role collection al usuario

**Gotcha:**
- Después de asignar roles, la sesión activa del browser tiene un JWT viejo sin los nuevos scopes — abrir en ventana de incógnito para obtener un token fresco

**Resultado final:** App Fiori Elements corriendo en BTP con autenticación XSUAA real, roles funcionando y datos desde HANA Cloud.

URL pública: `https://my-first-cap-approuter.cfapps.us10-001.hana.ondemand.com`
