import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";

const PORT = 3101;
const baseUrl = `http://127.0.0.1:${PORT}`;

let server: ChildProcess;
let serverLogs = "";

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`${baseUrl}/resources`);

      if (response.status < 500) {
        return;
      }
    } catch {
      // serveur pas encore prêt
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Le serveur de test n'a pas démarré.\n${serverLogs}`,
  );
}

before(async () => {
  server = spawn(
    process.execPath,
    ["dist/main.js"],
    {
      env: {
        ...process.env,
        PORT: String(PORT),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  server.stdout?.on("data", (data) => {
    serverLogs += data.toString();
  });

  server.stderr?.on("data", (data) => {
    serverLogs += data.toString();
  });

  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    server.kill("SIGTERM");
  }
});

test("GET /resources retourne les ressources", async () => {
  const response = await fetch(`${baseUrl}/resources`);

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.ok(Array.isArray(data));
  assert.equal(data.length, 10);
});

test("GET /districts retourne les 5 districts", async () => {
  const response = await fetch(`${baseUrl}/districts`);

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.ok(Array.isArray(data));
  assert.equal(data.length, 5);
});

test("GET /districts/X/neighbors retourne les voisins de Xeno", async () => {
  const response = await fetch(
    `${baseUrl}/districts/X/neighbors`,
  );

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.ok(Array.isArray(data));
  assert.equal(data.length, 4);
});

test("district inexistant retourne 404", async () => {
  const response = await fetch(
    `${baseUrl}/districts/Q`,
  );

  assert.equal(response.status, 404);
});

test("GET disponibilité Apex fonctionne", async () => {
  const response = await fetch(
    `${baseUrl}/resources/district/A/availability`,
  );

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.equal(data.district.code, "A");
  assert.ok(Array.isArray(data.resources));
  assert.equal(data.resources.length, 10);
});
