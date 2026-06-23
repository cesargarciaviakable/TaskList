# Guía completa: crear este proyecto desde cero

Esta guía asume que **nunca usaste SAP BTP** y que recién creaste (o estás por crear) tu cuenta de **BTP Free Trial**. Vas a construir, paso a paso, la misma app que existe en este repositorio: dos apps Fiori Elements (**Task Manager** y **Task Approvals**) sobre un backend SAP CAP, con base de datos HANA Cloud, autenticación XSUAA, y publicación en SAP Build Work Zone.

> Para el historial de errores reales encontrados durante el desarrollo original (con mensajes de error exactos), ver `CURSO.md`. Esta guía documenta la **arquitectura final** — el camino directo, sin los callejones sin salida.

## Índice

1. [Qué vamos a construir](#0-qué-vamos-a-construir)
2. [Crear la cuenta BTP Trial](#1-crear-la-cuenta-btp-trial)
3. [Verificar entitlements](#2-verificar-entitlements)
4. [Crear la instancia de SAP HANA Cloud](#3-crear-la-instancia-de-sap-hana-cloud)
5. [Preparar el Cloud Foundry Space](#4-preparar-el-cloud-foundry-space)
6. [Instalar herramientas locales](#5-instalar-herramientas-locales)
7. [Iniciar el proyecto CAP](#6-iniciar-el-proyecto-cap)
8. [Modelo de datos — `db/schema.cds`](#7-modelo-de-datos--dbschemacds)
9. [Datos semilla — `db/data` vs `test/data`](#8-datos-semilla--dbdata-vs-testdata)
10. [Servicio de Tareas — `srv/task-service.*`](#9-servicio-de-tareas--srvtask-service)
11. [Servicio de Aprobaciones — `srv/approval-service.*`](#10-servicio-de-aprobaciones--srvapproval-service)
12. [Motor de Workflow — `srv/workflow-engine.js`](#11-motor-de-workflow--srvworkflow-enginejs)
13. [Seguridad — `xs-security.json`](#12-seguridad--xs-securityjson)
14. [Generar las UIs Fiori Elements](#13-generar-las-uis-fiori-elements)
15. [Empaquetado MTA — `mta.yaml`](#14-empaquetado-mta--mtayaml)
16. [Crear el servicio XSUAA en Cloud Foundry](#15-crear-el-servicio-xsuaa-en-cloud-foundry)
17. [Build y Deploy](#16-build-y-deploy)
18. [Role Collections — dar permisos a tu usuario](#17-role-collections--dar-permisos-a-tu-usuario)
19. [SAP Build Work Zone, Standard Edition](#18-sap-build-work-zone-standard-edition)
20. [Publicar las apps en Work Zone](#19-publicar-las-apps-en-work-zone)
21. [Verificación end-to-end](#20-verificación-end-to-end)
22. [Problemas conocidos](#21-problemas-conocidos)

---

## 0. Qué vamos a construir

```javascript
┌──────────────────┐     ┌─────────────────────┐
│  Task Manager    │     │  Task Approvals     │  ← 2 apps Fiori Elements (List Report + Object Page)
│  (Fiori Elements)│     │  (Fiori Elements)   │
└─────────┬────────┘     └──────────┬──────────┘
          │ OData V4                │ OData V4
          ▼                         ▼
┌──────────────────────────────────────────────┐
│            SAP CAP (Node.js) — srv           │
│   TaskService          ApprovalService       │
└──────────────────────┬───────────────────────┘
                       │ HDI Container
                       ▼
              ┌──────────────────┐
              │  SAP HANA Cloud  │
              └──────────────────┘
```

- **Backend**: SAP CAP (Cloud Application Programming Model), Node.js. Define el modelo de datos y dos servicios OData V4.
- **Frontend**: dos apps **SAP Fiori Elements** (List Report + Object Page) generadas casi sin código, solo anotaciones declarativas.
- **Base de datos**: SQLite en local (desarrollo), SAP HANA Cloud en producción (vía HDI Container).
- **Autenticación**: XSUAA (OAuth2 + JWT) en producción, mock auth en desarrollo local.
- **Publicación**: SAP Build Work Zone, Standard Edition — el launchpad corporativo donde el usuario final abre las apps.
- **Empaquetado**: todo se despliega como una sola unidad (MTA — Multi-Target Application).

El flujo de negocio: una tarea (`Task`) pasa de `Open` → `InProgress` → `Done`. Al llegar a `Done`, automáticamente se crea una solicitud de aprobación (`ApprovalRequest`) y la tarea pasa a `PendingApproval`. Un aprobador la **aprueba** (tarea vuelve a `Done`, definitivo) o la **rechaza** con un comentario (tarea pasa a `Rejected`, visible, y el dueño la reabre manualmente a `Open` para corregirla y reenviarla).

---

## 1. Crear la cuenta BTP Trial

1. Entrá a la página de signup de **SAP BTP Trial** y creá una cuenta nueva (necesitás un email válido; SAP te va a pedir verificarlo).
2. Elegí una región — por ejemplo **US East (VA) — us10**. Esto importa: todos los endpoints (API de Cloud Foundry, URLs de apps) van a tener ese sufijo de región (ej. `cfapps.us10-001.hana.ondemand.com`). Anotá la región que elegiste, la vas a necesitar todo el tiempo.
3. SAP provisiona automáticamente:
   - Un **Global Account** (la cuenta padre).
   - Un **Subaccount** trial dentro de ese global account.
   - Un **entorno Cloud Foundry** ya habilitado, con una **Org** (`<tu-id>trial`) y un **Space** llamado `dev` por defecto.

Esto tarda unos minutos. Cuando termine, vas a poder entrar al **BTP Cockpit** (`https://cockpit.<región>.hana.ondemand.com` o el link que te llega por email).

---

## 2. Verificar entitlements

Los **entitlements** son las "cuotas" de servicios que tu subaccount puede usar. El trial viene con un set generoso ya asignado, pero conviene verificar antes de seguir.

En el Cockpit, dentro de tu subaccount:

1. Ir a **Entitlements** (menú lateral izquierdo).
2. Confirmar (o agregar si falta, con **Configure Entitlements → Add Service Plans**) que están disponibles:
   - **SAP HANA Cloud** — acá tenés que agregar **dos planes por separado**, son cosas distintas:
     - `tools` (Suscripción): habilita la interfaz de administración, **SAP HANA Cloud Central**. Sin este plan no podés ni llegar al wizard para crear la base.
     - `hana` o `hana-free` (Instancia): es la base de datos en memoria en sí — el servicio que realmente vas a usar desde CAP vía HDI container.
     - **Opcionales — omitilos a menos que el proyecto los necesite:**
     - - `relational-data-lake-free`: almacenamiento en disco para datos fríos, no para la operación normal de la app.
       - `hana-cloud-connection-free`: conexión hacia un sistema on-premise. No aplica a este proyecto, que es 100% cloud.
   - **SAP HANA Schemas & HDI Containers** (plan `hdi-shared`)
   - **Authorization and Trust Management Service (XSUAA)** (plan `application`)
   - **HTML5 Application Repository Service** (planes `app-host` y `app-runtime`)
   - **Destination service** (plan `lite`)
   - **Connectivity service** (plan `lite`)
   - **SAP Build Work Zone, Standard Edition** (plan `standard` o `free`)
   - **Cloud Identity Services** (plan `default`) — lo vas a necesitar para Work Zone, ver paso 18.

En cuentas trial nuevas, casi todo esto ya viene preasignado. Si algo falta, "Configure Entitlements" te deja agregarlo de la lista de servicios disponibles para tu licencia trial.

---

## 3. Crear la instancia de SAP HANA Cloud

A diferencia de los demás servicios (que se crean solos al hacer el deploy), **la base de datos HANA Cloud es una instancia de infraestructura real** que tenés que aprovisionar una sola vez, manualmente, desde el Cockpit. Tarda entre 20 y 40 minutos.

Esto requiere tres pasos separados — no es solo "crear la instancia": primero la suscripción de administración, después permisos para tu usuario, y recién ahí la instancia de base de datos.

### 3.1 Habilitar la suscripción de administración

1. En el Cockpit, ir a **Instances and Subscriptions** → **Create**.
2. Buscar **SAP HANA Cloud** y seleccionar el plan **tools** (la suscripción de administración, no la instancia de base de datos).
3. Confirmar. Esto sube la **subscription** que te da acceso a **SAP HANA Cloud Central**, la interfaz desde la que vas a crear y administrar la instancia real más adelante.

### 3.2 Asignar permisos y actualizar sesión

1. Cockpit → tu subaccount → **Security → Users**.
2. Seleccionar tu usuario → **Assign Role Collection** → asignar **SAP HANA Cloud Administrator**.
3. **Este paso es obligatorio y se suele pasar por alto:** el JWT de tu sesión actual ya tiene los roles viejos cacheados, así que el rol nuevo no se ve hasta que renueves el token. Usá una **ventana de incógnito**, limpiá el caché del navegador, o entrá con **otro navegador** para volver a iniciar sesión y regenerar el access token con el rol ya incluido. Si seguís en la misma sesión, vas a ver la subscription de HANA Cloud Central sin permisos o directamente inaccesible.

### 3.3 Crear la instancia de base de datos

1. Cockpit → **Instances and Subscriptions** → localizá la suscripción de SAP HANA Cloud creada en el paso 3.1 → **Go to Application**. Esto te lleva a **SAP HANA Cloud Central**.
2. Dentro de SAP HANA Cloud Central, ejecutar **Create instance**. El wizard tiene 6 pasos:
   1. **Instance Configuration**: elegir **Configure manually**, y como **Instance type** seleccionar **SAP HANA Database**.
   2. **General**: definir el **Instance Name** (cualquier nombre, ej. `my-hana-trial`) y la contraseña del usuario administrador **SYSTEM** — no la vas a usar directamente (CAP se conecta vía HDI container, sin host/usuario/password manual), pero queda como administrador de la instancia.
   3. **Compute & Memory**: dejar los valores por defecto, no hay nada que cambiar acá en el trial.
   4. **Network Access**: configurar como **All IP addresses** — sin esto, el HDI container que usa CAP no puede llegar a la instancia.
   5. **Additional Settings**: dejar los valores por defecto, no hay nada que cambiar acá.
   6. **Review and Create**: revisar el resumen y presionar **Review and Create** para confirmar.
3. El estado pasa de `CREATING` a `RUNNING`.

**Importante (gotcha real del trial):** las instancias HANA Cloud trial **se detienen automáticamente por inactividad** para ahorrar cuota. Antes de cualquier deploy o sesión de desarrollo contra HANA real, volvé a SAP HANA Cloud Central y verificá que el estado sea `RUNNING` — si no, dale **Start** y esperá unos minutos.

### Mapear la instancia al Space (Instance Mapping)

Para que `cf create-service hana hdi-shared ...` funcione, la instancia HANA tiene que estar mapeada al space de Cloud Foundry donde vas a desplegar:

1. Cockpit → tu subaccount → **Instances and Subscriptions** → la instancia HANA Cloud → **Instance Mapping**.
2. **Environment Instance ID** = el GUID de tu **space** de Cloud Foundry.
3. **Environment Group** = el GUID de tu **org** de Cloud Foundry.

#### Cómo obtener esos dos GUID

**Opción A — con la CLI de Cloud Foundry** (ya logueado con `cf login`, ver sección 5):

```bash
cf target
# muestra el nombre de tu org y tu space actuales, ej.:
#   org:    c4939d22trial
#   space:  dev

cf org <tu-org> --guid
# ejemplo: cf org c4939d22trial --guid
# devuelve algo como: d8c02e60-2ec9-4f92-bf6d-3ddf8db07490   ← Environment Group

cf space "<tu-space>" --guid
# ejemplo: cf space dev --guid
# devuelve algo como: 13ed2922-faec-4a73-8c51-2d35d03a4707   ← Environment Instance ID
```

(si el nombre del space tiene espacios, ponelo entre comillas, ej. `cf space "HANA Cloud" --guid`).

**Opción B — desde el Cockpit, sin la CLI:**

1. Subaccount → **Cloud Foundry → Spaces** → click en tu space → el **Space GUID** aparece en la pestaña de detalles / en la URL del navegador (`.../spaces/<GUID>/...`).
2. Subaccount → pestaña **Overview** → el **Org GUID** aparece junto a los datos de la org (también visible con `cf org <tu-org> --guid` si preferís no buscarlo a mano).

Sin este paso, cualquier intento de crear un HDI container falla con "no database available".

---

## 4. Preparar el Cloud Foundry Space

El trial te da un space `dev` por defecto. Podés usarlo directamente, o crear uno propio (en este proyecto real se usó un space llamado `HANA Cloud` para mantener todo agrupado). Si querés crear uno nuevo:

1. Cockpit → subaccount → **Cloud Foundry** → **Spaces** → **Create Space**.
2. Asignate a vos mismo como **Space Developer** (normalmente ya lo sos por ser el admin del trial).

Sea cual sea el space, anotá su nombre — lo vas a usar en `cf target`.

---

## 5. Instalar herramientas locales

En tu máquina (o en un Dev Space de **SAP Business Application Studio**, que ya trae todo esto preinstalado):

```bash
# Node.js 20+ (verificar con node -v)

# CLI de desarrollo CAP
npm install -g @sap/cds-dk

# CLI de Cloud Foundry
brew install cloudfoundry/tap/cf-cli@8        # macOS
# o el instalador oficial para Windows/Linux

# Plugin de Cloud Foundry para deploys multi-target (MTA)
cf install-plugin multiapps

# Herramienta de build de MTA
npm install -g mbt
```

Conectate a tu org/space:

```bash
cf login -a https://api.cf.<región>.hana.ondemand.com
# ejemplo: cf login -a https://api.cf.us10-001.hana.ondemand.com
```

Te va a pedir email/password (los mismos del Cockpit) y, si tenés más de un org/space, te deja elegir cuál.

> Nota sobre la región: el **endpoint de API de Cloud Foundry** suele tener un sufijo numérico distinto al de la región general (ej. región `us10` → API `us10-001`). El Cockpit te muestra el endpoint exacto en **Cloud Foundry → Spaces → tu space → detalles**.

---

## 6. Iniciar el proyecto CAP

```bash
mkdir my-first-cap && cd my-first-cap
cds init .
```

CAP 9.x no genera `package.json` con dependencias Node por defecto. Agregalas:

```bash
cds add nodejs
```

Esto te deja con una estructura base:

```javascript
my-first-cap/
  db/
  srv/
  app/
  package.json
```

---

## 7. Modelo de datos — `db/schema.cds`

```javascript
using { cuid, managed } from '@sap/cds/common';

namespace my.first;

entity Tasks : cuid, managed {
  key ID               : UUID;
      title            : String(100);
      description      : String(500);
      status           : TaskStatus default 'Open';
      rejectionComment : String(500) @readonly;
}

entity Statuses {
  key value : TaskStatus
}

type TaskStatus : String(20) enum {
  Open = 'Open';
  InProgress = 'InProgress';
  Done = 'Done';
  PendingApproval = 'PendingApproval';
  Rejected = 'Rejected';
}

type ApprovalStatus : String(20) enum {
  Pending = 'Pending';
  Approved = 'Approved';
  Rejected = 'Rejected';
}

entity ApprovalStatuses {
  key value : ApprovalStatus
}

entity ApprovalRequests : cuid, managed {
  taskID       : Association to Tasks;
  status       : ApprovalStatus default 'Pending';
  comment      : String(500);
  requestedBy  : String;
  approvedBy   : String;
  decidedAt    : Timestamp;
}
```

**Para qué sirve cada parte:**

- `cuid` (de `@sap/cds/common`) agrega automáticamente una clave `ID: UUID`. `managed` agrega `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` con valores que CAP rellena solo en cada INSERT/UPDATE.
- `Tasks.status` usa el enum `TaskStatus` con un valor por defecto `'Open'`. CDS guarda el enum como `String(20)` en la base — los nombres del enum (`Open`, `InProgress`, etc.) son solo para validación/documentación en el modelo, no generan una columna de tipo especial en HANA.
- `Tasks.rejectionComment` tiene `@readonly`: es una anotación nativa de CDS que le dice a los handlers genéricos de CRUD "este campo no se puede mandar en un INSERT/UPDATE desde afuera". Solo el código del servidor (vía consultas directas a la base, no vía el endpoint OData) puede escribirlo. Así, el usuario que ve la tarea en Task Manager no puede editar el motivo de rechazo, aunque sí puede **verlo**.
- `Statuses` y `ApprovalStatuses` son entidades de **referencia/lookup**: solo tienen una columna `value` (clave) con los valores fijos del enum correspondiente. Existen únicamente para que la UI pueda ofrecer un `<select>` con las opciones válidas (ver sección 13, `Common.ValueList`) — CDS no expone los `enum` directamente como una lista navegable por OData, así que se necesita una entidad real detrás.
- `ApprovalRequests.taskID` es una `Association` (FK) hacia `Tasks` — permite navegar (`taskID.title`, por ejemplo) desde una solicitud de aprobación hasta los datos de la tarea.
- Dos enums separados (`TaskStatus` con 5 valores, `ApprovalStatus` con 3) porque representan cosas distintas: el estado de la tarea en su ciclo de vida completo, vs. el estado de **una solicitud de aprobación puntual** dentro de ese ciclo.

---

## 8. Datos semilla — `db/data` vs `test/data`

CAP carga datos iniciales desde archivos CSV cuyo nombre sigue el patrón `{namespace}-{Entidad}.csv`. Pero **dónde** pongas ese CSV cambia drásticamente el comportamiento en producción:

| Carpeta           | Comportamiento                                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `db/data/*.csv`   | Se despliega y **se re-sincroniza en cada deploy**, en TODOS los targets, incluyendo HANA en producción. HDI trata el CSV como la fuente de verdad: en cada `cf deploy`, pisa cualquier fila existente cuya clave coincida con una fila del CSV. |
| `test/data/*.csv` | Solo siembra la base local (SQLite, `cds watch`). **Se excluye del build de producción para HANA** — no genera ningún `.hdbtabledata`.                                                                                                           |

**Regla de oro: cualquier entidad que la app modifique en tiempo real en producción (datos transaccionales) NO puede tener su CSV en db/data**, porque cada deploy futuro la resetearía a los valores del CSV, borrando lo que el usuario real hizo en la app. `db/data` es solo para **datos de referencia que nunca cambian** (como `Statuses` y `ApprovalStatuses`).

Por eso, en este proyecto:

```javascript
db/data/
  my.first-Statuses.csv          ← referencia fija, SÍ se re-sincroniza siempre
  my.first-ApprovalStatuses.csv  ← referencia fija, SÍ se re-sincroniza siempre

test/data/
  my.first-Tasks.csv             ← datos operacionales/demo, NO se toca en producción
  my.first-ApprovalRequests.csv  ← datos operacionales/demo, NO se toca en producción
```

**db/data/my.first-Statuses.csv:**

```javascript
value
Open
In Progress
Done
PendingApproval
Rejected
```

**db/data/my.first-ApprovalStatuses.csv:**

```javascript
value
Pending
Approved
Rejected
```

**test/data/my.first-Tasks.csv** (datos de demo para desarrollo local — en producción la tabla arranca vacía y se llena con uso real):

```javascript
ID,title,description,status,createdAt,createdBy,modifiedAt,modifiedBy
e1f2a3b4-0001-0000-0000-000000000001,Aprender CAP,Entender modelos y servicios,Open,2026-06-18T10:00:00Z,alice,2026-06-18T10:00:00Z,alice
e1f2a3b4-0002-0000-0000-000000000002,Conectar HANA Cloud,Configurar credenciales BTP,Open,2026-06-18T11:00:00Z,alice,2026-06-18T11:00:00Z,alice
```

(agregá las filas que quieras de prueba; el ID es cualquier UUID válido).

Verificá que la convención funciona corriendo `cds build --production` y revisando que solo aparezcan `.hdbtabledata` para `Statuses`/`ApprovalStatuses`, nunca para `Tasks`/`ApprovalRequests`.

---

## 9. Servicio de Tareas — `srv/task-service.*`

**srv/task-service.cds:**

```javascript
using my.first as mf from '../db/schema';

service TaskService {
  @odata.draft.enabled
  entity Tasks as projection on mf.Tasks;
  @readonly entity Statuses as select from mf.Statuses;
}
```

- `@odata.draft.enabled` es lo que habilita el ciclo completo de edición en Fiori Elements: botones **Create**, **Edit**, **Save/Discard**. Sin esto, la UI generada queda en modo solo-lectura aunque el resto de las anotaciones digan lo contrario — CAP genera automáticamente las tablas de borrador (`Tasks_drafts`) y las acciones OData `draftEdit`/`draftActivate` por debajo.
- `Statuses` se expone `@readonly` solo para que la UI pueda consultarla como fuente del `<select>` de status — nunca se inserta ni se modifica desde la UI.

**srv/task-service.js:**

```js
const cds = require('@sap/cds');

module.exports = class TaskService extends cds.ApplicationService {
  async init() {
    // After a task is updated (via draft activation or direct PATCH with bypass_draft),
    // auto-submit for approval if status = Done — runs in the same transaction as the
    // request so the response (and the Object Page) reflects PendingApproval right away.
    this.after('UPDATE', 'Tasks', async (results, req) => {
      if (!results || results.length === 0) return;

      const task = Array.isArray(results) ? results[0] : results;
      if (task.status !== 'Done') return;

      const tx = cds.transaction(req);

      const existing = await tx.run(
        SELECT.from('my.first.ApprovalRequests')
          .where({ taskID_ID: task.ID, status: 'Pending' })
      );
      if (existing.length > 0) return;

      await tx.run(
        INSERT.into('my.first.ApprovalRequests').entries({
          taskID_ID: task.ID,
          status: 'Pending',
          requestedBy: req.user?.id || 'anonymous'
        })
      );

      await tx.run(
        UPDATE('my.first.Tasks').where({ ID: task.ID }).set({ status: 'PendingApproval' })
      );

      task.status = 'PendingApproval';
    });

    return super.init();
  }
};
```

**Para qué sirve:** este es el "gatillo" automático del flujo de aprobación. `this.after('UPDATE', 'Tasks', ...)` es un handler de CAP que corre **después** de cualquier actualización exitosa de `Tasks` (incluyendo cuando el usuario activa un borrador en Fiori Elements). Si el nuevo status es `'Done'`:

1. Chequea si ya existe una solicitud `Pending` para esa tarea (evita duplicados si guardás dos veces).
2. Si no existe, crea una nueva `ApprovalRequest` y cambia el status de la tarea a `PendingApproval`.
3. **Punto clave de diseño**: usa `cds.transaction(req)` — esto **reutiliza la misma transacción del request actual**, no abre una transacción separada. Y al final hace `task.status = 'PendingApproval'`, mutando el objeto de resultado que CAP va a serializar en la respuesta HTTP. Gracias a esto, el cliente (la UI) recibe `PendingApproval` en la **misma respuesta** del PATCH, sin tener que recargar para verlo. Si en cambio se hiciera con una transacción separada y diferida (por ejemplo con `setImmediate`), la respuesta original ya habría salido con `'Done'` y la UI no se enteraría del cambio hasta refrescar.

---

## 10. Servicio de Aprobaciones — `srv/approval-service.*`

**srv/approval-service.cds:**

```javascript
using my.first as mf from '../db/schema';

service ApprovalService {
  @readonly entity Statuses as select from mf.Statuses;
  @readonly entity ApprovalStatuses as select from mf.ApprovalStatuses;
  entity ApprovalRequests as projection on mf.ApprovalRequests actions {
    action approve(comment: String) returns ApprovalRequests;
    action reject(comment: String) returns ApprovalRequests;
  };
  @readonly entity Tasks as projection on mf.Tasks;

  action submitForApproval(task: UUID) returns many ApprovalRequests;
}
```

- `approve`/`reject` son **bound actions** (`actions { ... }` dentro de la entidad): están ligadas a un registro específico de `ApprovalRequests`. Por eso en la UI aparecen como botones contextuales en el Object Page de cada solicitud (ver `UI.Identification` en la sección 13). Que `returns ApprovalRequests` (el mismo tipo que el binding parameter) es importante: según la especificación OData, cuando una bound action retorna el mismo tipo que su parámetro de binding, el cliente actualiza automáticamente esa entidad con la respuesta — así el Object Page se refresca solo, sin volver al List Report.
- `submitForApproval` es una **acción no ligada** (unbound, al nivel del servicio): no pertenece a ningún registro en particular, recibe el UUID de la tarea como parámetro.
- `Tasks` se expone de solo lectura acá para poder navegar `taskID.title` desde las anotaciones de UI de `ApprovalRequests` (ver sección 13).

**srv/approval-service.js:**

```js
const cds = require('@sap/cds');
const { createWorkflowEngine } = require('./workflow-engine');

module.exports = class ApprovalService extends cds.ApplicationService {
  async init() {
    const engine = createWorkflowEngine();

    // Unbound: submit a task for approval
    this.on('submitForApproval', async (req) => {
      const taskId = req.data.task;
      if (!taskId) return req.reject(400, 'Task UUID is required');

      const tx = cds.transaction(req);
      const [task] = await tx.run(SELECT.from('my.first.Tasks').where({ ID: taskId }));
      if (!task) return req.reject(404, `Task ${taskId} not found`);
      if (task.status !== 'Done') return req.reject(400, 'Task must be Done to submit for approval');

      const existing = await tx.run(
        SELECT.from('my.first.ApprovalRequests').where({ taskID_ID: taskId, status: 'Pending' })
      );
      if (existing.length > 0) return req.reject(409, 'Task already has a pending approval request');

      const [ar] = await tx.run(INSERT.into('my.first.ApprovalRequests').entries({
        taskID_ID: taskId,
        status: 'Pending',
        requestedBy: req.user?.id || 'anonymous'
      }));

      await tx.run(UPDATE('my.first.Tasks').where({ ID: taskId }).set({ status: 'PendingApproval' }));
      await engine.submit(taskId, req.user?.id || 'anonymous');

      return SELECT.from('my.first.ApprovalRequests').where({ ID: ar.ID });
    });

    // Action: approve an approval request (bound to entity)
    this.on('approve', 'ApprovalRequests', async (req) => {
      const id = req.params[0].ID || req.params[0];
      const { comment } = req.data;
      if (!id) return req.reject(400, 'ApprovalRequest ID is required');

      const tx = cds.transaction(req);
      const [request] = await tx.run(SELECT.from('my.first.ApprovalRequests').where({ ID: id }));
      if (!request) return req.reject(404, `ApprovalRequest ${id} not found`);

      if (request.status === 'Approved') return SELECT.from('my.first.ApprovalRequests').where({ ID: id });
      if (request.status === 'Rejected') return req.reject(400, 'Request was already rejected');
      if (request.status !== 'Pending') return req.reject(400, 'Request is not Pending');

      await tx.run(UPDATE('my.first.ApprovalRequests').where({ ID: id }).set({
        status: 'Approved', approvedBy: req.user?.id || 'anonymous',
        comment: comment || null, decidedAt: new Date().toISOString()
      }));
      await tx.run(UPDATE('my.first.Tasks').where({ ID: request.taskID_ID }).set({ status: 'Done' }));

      await engine.onApproved(request);
      return SELECT.from('my.first.ApprovalRequests').where({ ID: id });
    });

    // Action: reject an approval request (bound to entity)
    this.on('reject', 'ApprovalRequests', async (req) => {
      const id = req.params[0].ID || req.params[0];
      const { comment } = req.data;
      if (!id) return req.reject(400, 'ApprovalRequest ID is required');
      if (!comment?.trim()) return req.reject(400, 'Comment is required for rejection');

      const tx = cds.transaction(req);
      const [request] = await tx.run(SELECT.from('my.first.ApprovalRequests').where({ ID: id }));
      if (!request) return req.reject(404, `ApprovalRequest ${id} not found`);

      if (request.status === 'Rejected') return SELECT.from('my.first.ApprovalRequests').where({ ID: id });
      if (request.status === 'Approved') return req.reject(400, 'Request was already approved');
      if (request.status !== 'Pending') return req.reject(400, 'Request is not Pending');

      await tx.run(UPDATE('my.first.ApprovalRequests').where({ ID: id }).set({
        status: 'Rejected', approvedBy: req.user?.id || 'anonymous',
        comment, decidedAt: new Date().toISOString()
      }));
      await tx.run(UPDATE('my.first.Tasks').where({ ID: request.taskID_ID }).set({ status: 'Rejected', rejectionComment: comment }));

      await engine.onRejected(request, comment);
      return SELECT.from('my.first.ApprovalRequests').where({ ID: id });
    });

    return super.init();
  }
};
```

**Para qué sirve cada handler:**

- **submitForApproval**: validación manual (la tarea tiene que estar `Done`, no puede haber ya una solicitud `Pending`) + crea la `ApprovalRequest` + mueve la tarea a `PendingApproval` + notifica al motor de workflow. En la práctica, en este proyecto el disparador automático de `task-service.js` (sección 9) hace esto mismo solo al detectar `Done` — esta acción queda disponible para invocación manual/explícita si se la quisiera usar desde otro flujo.
- **approve**: valida que la solicitud esté `Pending` (si ya estaba `Approved`, responde 200 sin hacer nada — **idempotente**; si estaba `Rejected`, rechaza con 400, no se puede "reabrir" aprobando). Marca la solicitud como `Approved` y la tarea como `Done` definitivo.
- **reject**: exige un comentario (`if (!comment?.trim())`). Marca la solicitud como `Rejected` **y** la tarea como `status: 'Rejected'` guardando el motivo en `rejectionComment`. El dueño de la tarea ve claramente que fue rechazada y por qué, y la reabre manualmente cambiando el status a `Open` desde el mismo `<select>` que ya usa para editarla.
- `req.params[0].ID || req.params[0]` extrae el ID de la entidad sobre la que se invocó la bound action — la forma exacta del parámetro depende de si la entidad usa draft o no (acá `ApprovalRequests` no es draft-enabled, así que es directo).
- `cds.transaction(req)` en los tres handlers: todas las escrituras (insert/update sobre `ApprovalRequests` y `Tasks`) ocurren en la misma transacción del request — si algo falla a mitad de camino, todo se revierte junto.

---

## 11. Motor de Workflow — `srv/workflow-engine.js`

```js
const cds = require('@sap/cds');

/**
 * MockEngine — default implementation for local/dev.
 * All methods are no-ops; approval logic runs entirely in CAP handlers.
 */
class MockEngine {
  async submit(taskId, userId) {
    console.log(`[MockEngine] submit task ${taskId} by ${userId} — local mock, no-op`);
  }
  async onApproved(approvalRequest) {
    console.log(`[MockEngine] approved ${approvalRequest.ID} — local mock, no-op`);
  }
  async onRejected(approvalRequest, comment) {
    console.log(`[MockEngine] rejected ${approvalRequest.ID}: "${comment}" — local mock, no-op`);
  }
}

/**
 * BTPWorkflowEngine — stub for real SAP BTP Workflow integration.
 * Not implemented — reserved for production use.
 */
class BTPWorkflowEngine {
  constructor(credentials) {
    this.credentials = credentials;
  }
  async submit(taskId, userId) {
    throw new Error('BTPWorkflowEngine.submit is not yet implemented');
  }
  async onApproved(approvalRequest) {
    throw new Error('BTPWorkflowEngine.onApproved is not yet implemented');
  }
  async onRejected(approvalRequest, comment) {
    throw new Error('BTPWorkflowEngine.onRejected is not yet implemented');
  }
}

/**
 * Factory function that returns the appropriate engine based on
 * cds.env.requires.workflow.kind configuration.
 * Defaults to MockEngine if no config or kind !== 'btp'.
 */
function createWorkflowEngine() {
  const cfg = cds.env.requires && cds.env.requires.workflow;
  if (cfg && cfg.kind === 'btp') {
    return new BTPWorkflowEngine(cfg.credentials);
  }
  return new MockEngine();
}

module.exports = { createWorkflowEngine, MockEngine, BTPWorkflowEngine };
```

**Para qué sirve:** es un **patrón Strategy**. Toda la lógica de negocio (cambiar status, crear registros) ya vive en los handlers de `approval-service.js`; este motor es solo el punto de extensión para integrar un workflow REAL de SAP BTP Workflow Service más adelante (notificaciones, tareas en el inbox de Workflow, etc.) sin tocar el código de los handlers. Hoy usa `MockEngine` (no hace nada, solo loguea) porque `package.json` tiene `"workflow": { "kind": "mock" }`. El día que se quiera integrar el servicio real, se completa `BTPWorkflowEngine` y se cambia ese `kind` a `"btp"` — el resto del código no se toca.

---

## 12. Seguridad — `xs-security.json`

```json
{
  "xsappname": "my-first-cap",
  "tenant-mode": "dedicated",
  "oauth2-configuration": {
    "redirect-uris": [
      "https://*.cfapps.us10-001.hana.ondemand.com/**",
      "https://*.hana.ondemand.com/**"
    ]
  },
  "scopes": [
    { "name": "$XSAPPNAME.Tasks.Read", "description": "Read tasks" },
    { "name": "$XSAPPNAME.Tasks.Write", "description": "Create and update tasks" },
    { "name": "$XSAPPNAME.Approvals.Read", "description": "View approval requests" },
    { "name": "$XSAPPNAME.Approvals.Write", "description": "Approve or reject requests" }
  ],
  "attributes": [],
  "role-templates": [
    {
      "name": "Viewer",
      "description": "Can read tasks",
      "scope-references": ["$XSAPPNAME.Tasks.Read"]
    },
    {
      "name": "Editor",
      "description": "Can read and write tasks",
      "scope-references": ["$XSAPPNAME.Tasks.Read", "$XSAPPNAME.Tasks.Write"]
    },
    {
      "name": "Approver",
      "description": "Can read, approve, and reject approval requests",
      "scope-references": ["$XSAPPNAME.Approvals.Read", "$XSAPPNAME.Approvals.Write"]
    }
  ]
}
```

**Para qué sirve:**

- `xsappname` identifica esta app de seguridad ante XSUAA — todos los scopes se prefijan con `$XSAPPNAME.` (un placeholder que XSUAA reemplaza por este nombre en runtime).
- `tenant-mode: dedicated` — obligatorio para apps de un solo tenant (el modo `shared` es para apps multi-tenant, no aplica acá). **Importante**: si creás el servicio XSUAA con `shared` y después necesitás `dedicated` (o viceversa), `cf update-service` no te deja cambiarlo — hay que borrar el servicio y volver a crearlo.
- `redirect-uris`: los dominios a los que XSUAA puede redirigir después del login OAuth2. Tiene que incluir el dominio donde corre tu app (`*.cfapps.<región>.hana.ondemand.com`) **y** el dominio del launchpad de Work Zone (`*.hana.ondemand.com`) — si falta este último, el login desde Work Zone falla.
- `scopes`: los permisos atómicos que puede tener un usuario (leer tareas, escribir tareas, leer aprobaciones, escribir/decidir aprobaciones).
- `role-templates`: agrupan scopes en roles con nombre legible (`Viewer`, `Editor`, `Approver`). Estos son los que vas a ver en el Cockpit al crear **Role Collections** (sección 17) — no se asignan scopes sueltos a un usuario, se asignan roles, y los roles agrupan scopes.

> Este archivo define los permisos disponibles, pero por sí solo **no bloquea nada**: actualmente ningún servicio CDS tiene anotaciones `@requires` que exijan estos scopes para acceder a las entidades. Si en tu versión del proyecto querés exigirlos (por ejemplo, que solo alguien con `Approvals.Write` pueda invocar `approve`/`reject`), agregá `@requires: 'Approvals.Write'` sobre esas acciones en `approval-service.cds`.

---

## 13. Generar las UIs Fiori Elements

Con el backend corriendo localmente (`cds watch`), se generan las dos apps con el **Fiori Application Generator** (extensión de VS Code "SAP Fiori Tools", o `yo @sap/fiori` desde la terminal).

### App 1 — Task Manager (`app/tasks`)

Wizard del generador, paso a paso:

| Pantalla                                     | Opción a elegir                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Template Selection**                       | **List Report Page** — genera List Report + Object Page leyendo el metadata OData automáticamente |
| **Data Source**                              | **Use a Local CAP Project**                                                                       |
| **CAP Project**                              | el proyecto local (`my-first-cap`), detectado automáticamente                                     |
| **OData Service**                            | `TaskService`                                                                                     |
| **Main Entity**                              | `Tasks`                                                                                           |
| **Automatically add table columns**          | **Yes**                                                                                           |
| **Table Type**                               | **Responsive** (se adapta a desktop/tablet/móvil)                                                 |
| **Module Name**                              | `tasks`                                                                                           |
| **Application Title**                        | `Task Manager`                                                                                    |
| **Application Namespace**                    | `my.first`                                                                                        |
| **Enable TypeScript**                        | No                                                                                                |
| **Use Virtual Endpoints for Local Preview**  | Yes                                                                                               |
| **Configure Advanced Options**               | No                                                                                                |
| **Semantic Object** (Fiori Launchpad config) | `Tasks`                                                                                           |
| **Action**                                   | `display`                                                                                         |
| **Title**                                    | `Task Manager`                                                                                    |

### App 2 — Task Approvals (`app/approvals`)

Mismo wizard, mismas opciones, salvo:

| Pantalla              | Opción             |
| --------------------- | ------------------ |
| **OData Service**     | `ApprovalService`  |
| **Main Entity**       | `ApprovalRequests` |
| **Module Name**       | `approvals`        |
| **Application Title** | `Task Approvals`   |
| **Semantic Object**   | `Approvals`        |
| **Action**            | `display`          |

El generador crea `app/tasks/webapp` y `app/approvals/webapp` con `manifest.json`, `Component.js`, `index.html`, i18n, etc. — todo eso es boilerplate estándar de SAPUI5, no se edita a mano.

### Anotaciones — `app/tasks/annotations.cds`

```javascript
using TaskService as service from '../../srv/task-service';

annotate service.Tasks with @(
  Capabilities.InsertRestrictions: { Insertable: true },
  Capabilities.UpdateRestrictions: { Updatable: true },
  Capabilities.DeleteRestrictions: { Deletable: true },
  UI.HeaderInfo                : {
    TypeName      : 'Task',
    TypeNamePlural: 'Tasks',
    Title         : {Value: title},
    Description   : {Value: status}
  },
  UI.FieldGroup #GeneratedGroup: {
    $Type: 'UI.FieldGroupType',
    Data : [
      { $Type: 'UI.DataField', Label: 'title', Value: title },
      { $Type: 'UI.DataField', Label: 'description', Value: description },
      { $Type: 'UI.DataField', Label: 'status', Value: status },
      { $Type: 'UI.DataField', Label: 'rejection reason', Value: rejectionComment },
    ],
  },
  UI.Facets                    : [{
    $Type : 'UI.ReferenceFacet',
    ID    : 'GeneratedFacet1',
    Label : 'General Information',
    Target: '@UI.FieldGroup#GeneratedGroup',
  }],
  UI.LineItem                  : [
    { $Type: 'UI.DataField', Label: 'title', Value: title },
    { $Type: 'UI.DataField', Label: 'description', Value: description },
    { $Type: 'UI.DataField', Label: 'status', Value: status },
  ],
  UI.SelectionFields           : [status]
);

annotate service.Tasks with {
  status @(
    Common.ValueList               : {
      CollectionPath: 'Statuses',
      Parameters    : [{
        $Type            : 'Common.ValueListParameterOut',
        LocalDataProperty: status,
        ValueListProperty: 'value'
      }]
    },
    Common.ValueListWithFixedValues: true
  )
};
```

**Para qué sirve cada bloque:**

- `Capabilities.*Restrictions: true` — sin esto, sap.fe asume "no insertable/editable/borrable por default" y oculta los botones Create/Edit/Delete aunque el modelo lo permita.
- `UI.HeaderInfo` — define qué se muestra como título y subtítulo en el Object Page.
- `UI.FieldGroup` + `UI.Facets` — agrupan campos en una sección del Object Page ("General Information").
- `UI.LineItem` — define las columnas de la tabla del List Report.
- `UI.SelectionFields` — agrega ese campo como filtro en la barra de búsqueda del List Report.
- `Common.ValueList` sobre `status` — convierte el campo de texto libre en un `<select>`: le dice a la UI "los valores válidos vienen de la entidad `Statuses`, columna `value`". `Common.ValueListWithFixedValues: true` refuerza que es una lista cerrada (no autocompletar libre).

### Anotaciones — `app/approvals/annotations.cds`

```javascript
using ApprovalService as service from '../../srv/approval-service';

annotate service.ApprovalRequests with @(
  UI.HeaderInfo : {
    TypeName       : 'Approval',
    TypeNamePlural : 'Approvals',
    Title          : { Value: taskID.title },
    Description    : { Value: status }
  },
  UI.FieldGroup #General: {
    $Type: 'UI.FieldGroupType',
    Data : [
      { $Type: 'UI.DataField', Value: status, Label: 'Status' },
      { $Type: 'UI.DataField', Value: comment, Label: 'Comment' },
      { $Type: 'UI.DataField', Value: requestedBy, Label: 'Requested By' },
      { $Type: 'UI.DataField', Value: approvedBy, Label: 'Approved By' },
      { $Type: 'UI.DataField', Value: createdAt, Label: 'Created' },
      { $Type: 'UI.DataField', Value: decidedAt, Label: 'Decision Date' },
    ],
  },
  UI.Facets : [
    { $Type: 'UI.ReferenceFacet', ID: 'GeneralFacet', Label: 'General Information', Target: '@UI.FieldGroup#General' },
  ],
  UI.LineItem : [
    { $Type: 'UI.DataField', Value: taskID.title, Label: 'Task' },
    { $Type: 'UI.DataField', Value: status, Label: 'Status' },
    { $Type: 'UI.DataField', Value: requestedBy, Label: 'Requester' },
    { $Type: 'UI.DataField', Value: createdAt, Label: 'Created' },
  ],
  UI.SelectionFields : [status]
);

annotate service.ApprovalRequests with {
  status @(
    Common.ValueList               : {
      CollectionPath: 'ApprovalStatuses',
      Parameters    : [{
        $Type            : 'Common.ValueListParameterOut',
        LocalDataProperty: status,
        ValueListProperty: 'value'
      }]
    },
    Common.ValueListWithFixedValues: true
  )
};

annotate service.ApprovalRequests with @(
  UI.Identification : [
    { $Type: 'UI.DataFieldForAction', Action: 'ApprovalService.approve', Label: 'Approve' },
    { $Type: 'UI.DataFieldForAction', Action: 'ApprovalService.reject', Label: 'Reject' },
  ]
);
```

**Lo nuevo respecto a la app anterior:**

- `Title: { Value: taskID.title }` — el título del Object Page navega a través de la Association `taskID` hasta el campo `title` de `Tasks`. Esto funciona porque ese servicio también expone `Tasks` de solo lectura (sección 10), lo que hace navegable la asociación.
- `UI.LineItem` con `Value: taskID.title` — mismo mecanismo, pero como columna del List Report, para ver de qué tarea es cada solicitud sin entrar al detalle.
- `UI.Identification` con `UI.DataFieldForAction` — esto es lo que pone los botones **Approve** y **Reject** en el header del Object Page, ligados a las bound actions definidas en `approval-service.cds`.
- `Common.ValueList` apunta a `ApprovalStatuses` (no a `Statuses` — son listas de valores distintas, ver sección 7).

### `xs-app.json` (en cada app, ej. `app/tasks/xs-app.json`)

```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/(.*)$",
      "target": "/odata/$1",
      "destination": "srv-api",
      "authenticationType": "xsuaa",
      "csrfProtection": false
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

**Para qué sirve:** este archivo viaja DENTRO del paquete de la app en el HTML5 Application Repository. Define cómo el approuter (el de SAP Build Work Zone, gestionado, no uno propio en este proyecto) debe rutear los pedidos: todo lo que empiece con `/odata/` va al backend CAP a través del destination `srv-api`; todo lo demás (el HTML, JS, CSS de la app) se sirve desde el propio HTML5 repo (`html5-apps-repo-rt`). Se genera automáticamente al correr `fiori add deploy-config` (ver sección 14).

Se genera ejecutando, dentro de cada carpeta de app (`app/tasks`, `app/approvals`):

```bash
npx -p @sap/ux-ui5-tooling fiori add deploy-config cf
```

El wizard pregunta:

- **Destination name**: `srv-api`
- **Add deploy configuration to MTA**: `Yes`

Esto genera `ui5-deploy.yaml`, `xs-app.json`, agrega scripts `build:cf` al `package.json` de la app, y agrega los módulos correspondientes al `mta.yaml` (sección 14).

---

## 14. Empaquetado MTA — `mta.yaml`

```yaml
_schema-version: 3.3.0
ID: my-first-cap
description: A simple CAP project.
version: 1.0.0
modules:
- name: my-first-cap-srv
  type: nodejs
  path: gen/srv
  requires:
  - name: my-first-cap-xsuaa
  - name: my-first-cap-db
  provides:
  - name: srv-api
    properties:
      srv-url: ${default-url}
  parameters:
    buildpack: nodejs_buildpack
    instances: 1
  build-parameters:
    builder: npm-ci
- name: my-first-cap-db-deployer
  type: hdb
  path: gen/db
  requires:
  - name: my-first-cap-db
  parameters:
    buildpack: nodejs_buildpack
- name: my-first-cap-app-content
  type: com.sap.application.content
  path: .
  requires:
  - name: my-first-cap-repo-host
    parameters:
      content-target: true
  build-parameters:
    build-result: resources
    requires:
    - artifacts: [myfirsttasks.zip]
      name: myfirsttasks
      target-path: resources/
    - artifacts: [myfirstapprovals.zip]
      name: myfirstapprovals
      target-path: resources/
- name: myfirsttasks
  type: html5
  path: app/tasks
  build-parameters:
    build-result: dist
    builder: custom
    commands: [npm install, npm run build:cf]
    supported-platforms: []
- name: myfirstapprovals
  type: html5
  path: app/approvals
  build-parameters:
    build-result: dist
    builder: custom
    commands: [npm install, npm run build:cf]
    supported-platforms: []
- name: my-first-cap-destination-content
  type: com.sap.application.content
  requires:
  - name: my-first-cap-destination-service
    parameters: { content-target: true }
  - name: my-first-cap-repo-host
    parameters: { service-key: { name: my-first-cap-repo-host-key } }
  - name: my-first-cap-xsuaa
    parameters: { service-key: { name: my-first-cap-xsuaa-key } }
  parameters:
    content:
      instance:
        destinations:
        - Name: my_first_cap_repo_host
          ServiceInstanceName: my-first-cap-html5-service
          ServiceKeyName: my-first-cap-repo-host-key
          sap.cloud.service: my.first.cap
        - Name: my_first_cap_uaa
          Authentication: OAuth2UserTokenExchange
          ServiceInstanceName: my-first-cap-xsuaa
          ServiceKeyName: my-first-cap-xsuaa-key
          sap.cloud.service: my.first.cap
        existing_destinations_policy: ignore
  build-parameters:
    no-source: true
resources:
- name: my-first-cap-xsuaa
  type: org.cloudfoundry.existing-service
  parameters:
    service-name: my-first-cap-xsuaa
- name: my-first-cap-db
  type: com.sap.xs.hdi-container
  parameters:
    service: hana
    service-plan: hdi-shared
- name: my-first-cap-repo-host
  type: org.cloudfoundry.managed-service
  parameters:
    service: html5-apps-repo
    service-name: my-first-cap-html5-service
    service-plan: app-host
- name: my-first-cap-destination-service
  type: org.cloudfoundry.managed-service
  requires:
  - name: srv-api
  parameters:
    config:
      HTML5Runtime_enabled: true
      init_data:
        instance:
          destinations:
          - Name: srv-api
            URL: ~{srv-api/srv-url}
            Authentication: NoAuthentication
            Type: HTTP
            ProxyType: Internet
            HTML5.DynamicDestination: true
            HTML5.ForwardAuthToken: true
          - Name: ui5
            Authentication: NoAuthentication
            ProxyType: Internet
            Type: HTTP
            URL: https://ui5.sap.com
          existing_destinations_policy: update
      version: 1.0.0
    service: destination
    service-name: my-first-cap-destination-service
    service-plan: lite
```

**Para qué sirve cada pieza — modules:**

| Módulo                              | Para qué sirve                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `my-first-cap-srv`                  | El backend CAP compilado (`gen/srv`, generado por `cds build --production`). `provides: srv-api` expone su URL para que otros módulos la consuman.                                                                                                                                   |
| `my-first-cap-db-deployer`          | Tarea de un solo uso (`type: hdb`) que aplica el modelo de datos al HDI container — crea/actualiza tablas, vistas, y sincroniza los CSV de `db/data`.                                                                                                                                |
| `myfirsttasks` / `myfirstapprovals` | Buildean cada app Fiori (`npm install && npm run build:cf`) y empaquetan el resultado como `.zip`.                                                                                                                                                                                   |
| `my-first-cap-app-content`          | Sube esos `.zip` al HTML5 Application Repository.                                                                                                                                                                                                                                    |
| `my-first-cap-destination-content`  | Crea las **destinations** a nivel de subaccount que Work Zone necesita para descubrir y servir las apps: una apunta al HTML5 repo (`my_first_cap_repo_host`), otra al XSUAA para el intercambio de tokens (`my_first_cap_uaa`). Sin este módulo, Work Zone nunca encuentra las apps. |

**resources (servicios de Cloud Foundry):**

| Recurso                            | Tipo                               | Para qué sirve                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `my-first-cap-xsuaa`               | `existing-service`                 | **No lo crea el MTA** — solo se bindea a un servicio que ya tiene que existir (ver sección 15).                                                                                                                                                                                        |
| `my-first-cap-db`                  | `com.sap.xs.hdi-container`         | El contenedor HDI dentro de tu instancia HANA Cloud — se crea solo en el primer deploy.                                                                                                                                                                                                |
| `my-first-cap-repo-host`           | `html5-apps-repo`, plan `app-host` | Almacena el contenido de las apps (los `.zip`).                                                                                                                                                                                                                                        |
| `my-first-cap-destination-service` | `destination`, plan `lite`         | Define el destino `srv-api` (apunta a la URL real del backend, `${srv-api/srv-url}`, resuelta en tiempo de deploy) y `ui5` (CDN de SAPUI5). `HTML5Runtime_enabled: true` es lo que permite que Work Zone sirva contenido del HTML5 repo sin que tengas que correr tu propio approuter. |

> **my-first-cap-ui, approuter standalone, etc.** — si ves referencias a un módulo approuter propio en otra documentación de este mismo repo (`CURSO.md`), es una arquitectura **anterior** que ya no se usa. La arquitectura final (la de esta guía) no tiene approuter propio: Work Zone usa su approuter gestionado + `destination-content` + `html5-apps-repo`.

---

## 15. Crear el servicio XSUAA en Cloud Foundry

El `mta.yaml` declara `my-first-cap-xsuaa` como `existing-service` — el deploy **no lo crea**, solo se bindea a él. Tenés que crearlo una sola vez, manualmente, ANTES del primer deploy:

```bash
cf create-service xsuaa application my-first-cap-xsuaa -c xs-security.json
```

Si más adelante editás `xs-security.json` (por ejemplo, agregás un scope o un redirect-uri), no se vuelve a crear el servicio — se actualiza:

```bash
cf update-service my-first-cap-xsuaa -c xs-security.json
```

Todo lo demás (`my-first-cap-db`, `my-first-cap-repo-host`, `my-first-cap-destination-service`) lo crea automáticamente el primer `cf deploy` porque están declarados como `managed-service` o `hdi-container` en el `mta.yaml`.

---

## 16. Build y Deploy

`package.json` define los scripts de conveniencia:

```json
"scripts": {
  "build": "rimraf resources mta_archives && mbt build --mtar archive",
  "deploy": "cf deploy mta_archives/archive.mtar --retries 1"
}
```

Flujo completo desde cero:

```bash
# 1. Generar gen/db y gen/srv a partir del modelo CDS
npx cds build --production

# 2. Construir el archivo .mtar (build de las 2 UIs + empaquetado de todos los módulos)
npm run build

# 3. Verificar que tu HANA Cloud esté RUNNING (Cockpit → SAP HANA Cloud Central)

# 4. Login a Cloud Foundry si la sesión expiró
cf login -a https://api.cf.<región>.hana.ondemand.com

# 5. Deploy
npm run deploy
```

`cf deploy` sube el `.mtar`, y por dependencias declaradas en `mta.yaml` va: crea/actualiza los servicios → sube y arranca `my-first-cap-srv` → corre el `db-deployer` (aplica schema + sincroniza solo `db/data`, nunca `test/data`) → sube el contenido de las apps al HTML5 repo → crea las destinations.

Al final el log debe terminar en `Process finished.` (sin "Process failed"). Para verificar que el backend responde:

```bash
curl -i https://<tu-org>-<tu-space>-my-first-cap-srv.cfapps.<región>.hana.ondemand.com/odata/v4/task/\$metadata
# esperado: HTTP 401 (ruta sana, pide autenticación) — no 404 "route does not exist"
```

Un `404 Not Found: Requested route ('...') does not exist` casi siempre significa que la app está parada (`cf apps` para ver el estado) — normal en trial por inactividad, se arregla con `cf start my-first-cap-srv`.

---

## 17. Role Collections — dar permisos a tu usuario

Tener los scopes definidos en `xs-security.json` no le da permisos a nadie todavía. Hay que crear una **Role Collection** y asignártela:

1. Cockpit → tu subaccount → **Security → Role Collections → Create**.
2. Nombre, por ejemplo `TasksEditor`.
3. **Add Role** → buscar la app `my-first-cap` → agregar los roles `Viewer`, `Editor`, `Approver` (los definidos en `xs-security.json`, sección 12) según lo que quieras habilitar.
4. **Security → Users** → buscar tu usuario → **Assign Role Collection** → `TasksEditor`.

**Importante si usás un Identity Provider personalizado (IAS, necesario para Work Zone — ver sección 18):** tu mismo email puede aparecer **dos veces** en Security → Users: una entrada con origen `sap.default` (SAP ID Service) y otra con el origen de tu tenant IAS. Asigná la role collection a la entrada que tenga el **origen IAS** — Work Zone autentica a través de IAS, así que si la asignás solo a la entrada `sap.default`, vas a ver `403 lacking required roles` al abrir la app desde Work Zone aunque "ya le diste el rol".

Después de asignar roles, **abrí una ventana de incógnito** (o cerrá sesión completamente) — el JWT de una sesión activa ya tiene los scopes viejos cacheados.

---

## 18. SAP Build Work Zone, Standard Edition

### Prerrequisito: Cloud Identity Services (IAS)

Work Zone Standard Edition no acepta el trust SAML por defecto del trial — necesita un Identity Provider vía IAS.

1. Cockpit → **Service Marketplace** → buscar **Cloud Identity Services** → **Create/Subscribe** (plan `default`).
2. Esperar a que el tenant IAS se provisione.

### Suscribirse a Work Zone

1. Cockpit → **Service Marketplace** → buscar **SAP Build Work Zone, Standard Edition** → **Create/Subscribe** (plan `standard` o `free`, según disponibilidad en tu trial).
2. Cockpit → **Security → Users** → asignar el rol `Launchpad_Admin` a tu usuario (a la entrada con origen **IAS**, mismo cuidado que en la sección 17).
3. Abrir la subscription desde **Instances and Subscriptions** → te lleva al **Site Manager**.

---

## 19. Publicar las apps en Work Zone

Con el deploy del paso 16 ya hecho (que incluye `my-first-cap-destination-content`, indispensable para este paso):

1. **Site Manager → Channel Manager** → canal **HTML5 Apps** → **Refresh** (la primera sincronización puede tardar un par de minutos después de un deploy reciente; si se queda en "Actualizando..." con error, esperá y reintentá antes de asumir que algo está roto).
2. **Content Manager → Content Explorer → HTML5 Apps** → deberías ver `Task Manager` y `Task Approvals` listadas → seleccionalas → **Add**.
3. **Content Manager → rol "Everyone"** (o el rol que prefieras) → **Edit** → en la columna *Assignment Status* de cada app, activar el switch → **Save**.
4. **Site Directory** → tu site → **Site Settings** → **Edit** → **+ Search for items to assign** → buscar el rol que usaste en el paso anterior → asignarlo → **Save**.

Las apps ya deberían aparecer como tiles en tu site de Work Zone.

---

## 20. Verificación end-to-end

1. Abrí el site de Work Zone, entrá a **Task Manager**.
2. Creá una tarea nueva (botón Create) → guardala con status `Open`.
3. Editala, cambiá el status a `Done`, guardá → el status debería pasar a `PendingApproval` **en el mismo Object Page**, sin recargar.
4. Entrá a **Task Approvals** → debería aparecer una solicitud `Pending` con el título de esa tarea.
5. Abrí la solicitud → botón **Reject** → escribí un comentario → confirmá. La tarea en Task Manager debería mostrar `status: Rejected` y el comentario en "rejection reason" (de solo lectura).
6. Volvé a poner la tarea en `Open` → `Done` de nuevo → debería generar una **nueva** solicitud `Pending` (el ciclo se puede repetir).
7. Esta vez, en Task Approvals, **Approve** → la tarea queda en `Done` definitivo.

---

## 21. Problemas conocidos

- **Las apps/HANA del trial se detienen solas por inactividad.** Antes de desplegar o de reportar "no anda", correr `cf apps` y `cf start <app>` si están en `0/1`, y verificar el estado de la instancia en SAP HANA Cloud Central.
- **404 Not Found: Requested route (...) does not exist** = la app está parada (0 instancias), no un bug de código — ver punto anterior.
- **Nunca pongas CSV de datos transaccionales en db/data.** Cada deploy resetea esas filas a lo que diga el CSV. Usá `test/data` para todo lo que la app vaya a modificar en producción (ver sección 8).
- **mbt build falla con gen/srv path does not exist** → falta correr `npx cds build --production` antes (no lo hace `mbt build` solo).
- **Content Manager → Channel Manager se queda en "Actualizando..." con error genérico** → normalmente alcanza con esperar 2-3 minutos y reintentar; el job de sincronización es asíncrono y la UI no siempre lo comunica bien, sobre todo justo después de un deploy.
- **403 "lacking required roles" en Work Zone pero "ya le di el rol" en el Cockpit** → revisar a qué entrada de usuario (origen `sap.default` vs origen IAS) está asignada la Role Collection — ver sección 17.
- **tenant-mode de XSUAA no se puede cambiar con update-service** → hay que borrar el servicio (`cf delete-service-key` + `cf delete-service`) y recrearlo.
- Para el detalle completo de errores reales encontrados durante el desarrollo de este proyecto (mensajes exactos, stack traces, fixes aplicados en el momento), ver `CURSO.md`.
