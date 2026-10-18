/**
 * TEST GLOBAL de la API de la discoteca.
 *
 * Ejecuta la coleccion de Postman COMPLETA en orden, replicando la
 * semantica del sandbox de Postman (prerequest + request + test) con
 * una implementacion minima de `pm.*` sobre Node fetch. Sirve como
 * bateria E2E unica: si termina en 0, toda la API responde como
 * espera la evidencia de Postman.
 *
 * Requiere el servidor corriendo (npm start) en el puerto 3000.
 * Uso:  npm run test:e2e   (equivale a node tests/e2e-corrida-global.js)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

// ------------------------------------------------------------------
// Expect minimo (subconjunto de chai usado por la coleccion)
// ------------------------------------------------------------------
function expect(valor) {
  const raiz = {};
  const falla = (msg) => {
    throw new Error(msg);
  };
  const cadena = {
    get to() {
      return raiz;
    },
    get and() {
      return raiz;
    },
    get exist() {
      if (!valor) falla('se esperaba truthy, vino: ' + repr(valor));
      return raiz;
    },
    // Cadena de idioma de chai: .an('array').of.length(2)
    get of() {
      return raiz;
    },
    length(n) {
      const l = valor === null || valor === undefined ? undefined : valor.length;
      if (l !== n) falla(`longitud ${repr(l)}, se esperaba ${n}`);
      return raiz;
    },
    get be() {
      return {
        get true() {
          if (valor !== true) falla('se esperaba true, vino: ' + repr(valor));
          return raiz;
        },
        get false() {
          if (valor !== false) falla('se esperaba false, vino: ' + repr(valor));
          return raiz;
        },
        a(tipo) {
          if (typeof valor !== tipo) falla(`se esperaba tipo ${tipo}, vino ${typeof valor}`);
          return raiz;
        },
        an(tipo) {
          if (tipo === 'array' && !Array.isArray(valor)) falla('se esperaba un array');
          else if (tipo === 'object' && (valor === null || Array.isArray(valor) || typeof valor !== 'object'))
            falla('se esperaba un objeto');
          else if (tipo !== 'array' && tipo !== 'object') this.a(tipo);
          return raiz;
        },
        get at() {
          return {
            least(n) {
              if (!(valor >= n)) falla(`${repr(valor)} no es >= ${n}`);
              return raiz;
            }
          };
        },
        get null() {
          if (valor !== null) falla('se esperaba null, vino: ' + repr(valor));
          return raiz;
        }
      };
    },
    get have() {
      return {
        status(n) {
          falla('have.status es de pm.response, no de expect');
        },
        get length() {
          return {
            above(n) {
              const l = valor === null || valor === undefined ? undefined : valor.length;
              if (!(l > n)) falla(`length ${l} no es > ${n}`);
              return raiz;
            },
            least(n) {
              const l = valor === null || valor === undefined ? undefined : valor.length;
              if (!(l >= n)) falla(`length ${l} no es >= ${n}`);
              return raiz;
            }
          };
        }
      };
    },
    equal(esperado) {
      if (valor !== esperado) falla(`${repr(valor)} !== ${repr(esperado)}`);
      return raiz;
    },
    contain(parte) {
      const ok = typeof valor === 'string' ? valor.includes(parte) : Array.isArray(valor) && valor.includes(parte);
      if (!ok) falla(`${repr(valor)} no contiene ${repr(parte)}`);
      return raiz;
    },
    match(re) {
      if (!re.test(String(valor))) falla(`${repr(valor)} no matchea ${re}`);
      return raiz;
    },
    get not() {
      return {
        contain(parte) {
          const ok = typeof valor === 'string' && valor.includes(parte);
          if (ok) falla(`${repr(valor)} NO deberia contener ${repr(parte)}`);
          return raiz;
        },
        get exist() {
          if (valor) falla('se esperaba falsy, vino: ' + repr(valor));
          return raiz;
        }
      };
    }
  };
  Object.assign(raiz, cadena);
  return raiz;
}

function repr(v) {
  if (typeof v === 'string') return `'${v}'`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ------------------------------------------------------------------
// Sustitucion de {{variables}}
// ------------------------------------------------------------------
function sustituir(texto, vars) {
  return String(texto).replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in vars)) {
      console.log(`   [aviso] variable {{${k}}} sin definir (queda vacia)`);
      return '';
    }
    return String(vars[k]);
  });
}

// ------------------------------------------------------------------
// Ejecucion de un script de la coleccion con el sandbox pm minimo
// ------------------------------------------------------------------
function correrScript(bloqueScript, ambiente) {
  if (!bloqueScript || !bloqueScript.exec) return;
  const codigo = bloqueScript.exec.join('\n');
  const sandbox = vm.createContext({ pm: ambiente.pm, console });
  // IIFE: evita que `const` de un script contaminen al siguiente.
  vm.runInContext(`(function () {\n'use strict';\n${codigo}\n})();`, sandbox, {
    filename: 'script-coleccion.js'
  });
}

// ------------------------------------------------------------------
// Motor principal
// ------------------------------------------------------------------
async function main() {
  const rutaColeccion =
    process.argv[2] ||
    path.join(__dirname, '..', 'docs', 'postman', 'Discoteca.postman_collection.json');
  const baseUrlRespaldo = process.argv[3] || 'http://localhost:3000';

  const coleccion = JSON.parse(fs.readFileSync(rutaColeccion, 'utf8'));
  const vars = {};
  for (const v of coleccion.variable || []) vars[v.key] = v.value;
  if (!vars.base_url) vars.base_url = baseUrlRespaldo;

  let peticiones = 0;
  let peticionesFallidas = 0;
  let afirmaciones = 0;
  let afirmacionesFallidas = 0;
  const fallos = [];

  for (const carpeta of coleccion.item) {
    console.log(`\n=== ${carpeta.name} ===`);
    for (const item of carpeta.item || []) {
      if (!item.request) continue;
      peticiones++;
      const nombre = item.name;
      const metodo = item.request.method || 'GET';
      const erroresDeEstaPeticion = [];

      const pm = {
        collectionVariables: {
          get: (k) => vars[k],
          set: (k, val) => {
            vars[k] = val;
          }
        },
        test: (titulo, fn) => {
          afirmaciones++;
          try {
            fn();
          } catch (e) {
            afirmacionesFallidas++;
            erroresDeEstaPeticion.push(`${titulo}: ${e.message}`);
          }
        },
        expect,
        response: null
      };

      try {
        // 1. prerequest
        const pre = (item.event || []).find((e) => e.listen === 'prerequest');
        if (pre) correrScript(pre.script, { pm });

        // 2. construir peticion
        const url = sustituir(item.request.url.raw, vars);
        const metodo = item.request.method || 'GET';
        const opciones = { method: metodo, headers: {} };
        for (const h of item.request.header || []) {
          if (h && h.key) opciones.headers[h.key] = sustituir(h.value, vars);
        }
        if (item.request.body && item.request.body.mode === 'raw') {
          opciones.body = sustituir(item.request.body.raw, vars);
        }

        // 3. ejecutar
        let respuesta;
        try {
          respuesta = await fetch(url, opciones);
        } catch (e) {
          throw new Error('fallo de red contra ' + url + ': ' + e.message);
        }
        const texto = await respuesta.text();
        let json = null;
        try {
          json = texto ? JSON.parse(texto) : null;
        } catch {
          json = null;
        }

        const encabezados = {};
        respuesta.headers.forEach((val, k) => {
          encabezados[k.toLowerCase()] = val;
        });

        pm.response = {
          code: respuesta.status,
          status: respuesta.status,
          headers: encabezados,
          json() {
            if (json === null) throw new Error('la respuesta no es JSON: ' + texto.slice(0, 120));
            return json;
          },
          text: () => texto,
          to: {
            have: {
              status(n) {
                if (respuesta.status !== n)
                  throw new Error(`status ${respuesta.status} != ${n} (${texto.slice(0, 140)})`);
              },
              header(k) {
                if (!(k.toLowerCase() in encabezados)) throw new Error('falta el header ' + k);
              }
            }
          }
        };

        // 4. tests
        const test = (item.event || []).find((e) => e.listen === 'test');
        if (test) correrScript(test.script, { pm });

        if (erroresDeEstaPeticion.length === 0) {
          console.log(`  [OK] ${metodo} ${nombre}`);
        } else {
          peticionesFallidas++;
          console.log(`  [FALLO] ${metodo} ${nombre}`);
          erroresDeEstaPeticion.forEach((m) => console.log(`      - ${m}`));
          fallos.push({ carpeta: carpeta.name, nombre, errores: erroresDeEstaPeticion });
        }
      } catch (e) {
        peticionesFallidas++;
        console.log(`  [ERROR] ${metodo ?? item.request.method} ${nombre}`);
        console.log(`      - ${e.message}`);
        fallos.push({ carpeta: carpeta.name, nombre, errores: [e.message] });
      }
    }
  }

  console.log('\n================ RESUMEN GLOBAL ================');
  console.log(`Peticiones:    ${peticiones}  | fallidas: ${peticionesFallidas}`);
  console.log(`Afirmaciones:  ${afirmaciones}  | fallidas: ${afirmacionesFallidas}`);
  if (fallos.length) {
    console.log('--- fallos ---');
    for (const f of fallos) {
      console.log(`* [${f.carpeta}] ${f.nombre}`);
      f.errores.forEach((m) => console.log(`    - ${m}`));
    }
  }
  process.exit(fallos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
