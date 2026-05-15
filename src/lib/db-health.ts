import net from "node:net";

type DatabaseTarget = {
  host: string;
  port: number;
};

function parseDatabaseTarget(): DatabaseTarget {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return { host: "localhost", port: 5432 };
  }

  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname || "localhost",
      port: Number(url.port || 5432)
    };
  } catch {
    return { host: "localhost", port: 5432 };
  }
}

export function getDatabaseUnavailableMessage() {
  const target = parseDatabaseTarget();
  return `PostgreSQL is not reachable at ${target.host}:${target.port}. Start the database, then run npm run db:migrate.`;
}

export async function canReachDatabase(timeoutMs = 250): Promise<boolean> {
  const target = parseDatabaseTarget();

  return new Promise((resolve) => {
    const socket = net.createConnection(target);
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}
