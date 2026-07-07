import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function getLanUrls(portNumber, protocol = "http") {
  const networks = os.networkInterfaces();
  const urls = [];

  for (const addresses of Object.values(networks)) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        urls.push(`${protocol}://${address.address}:${portNumber}`);
      }
    }
  }

  return [...new Set(urls)];
}

export function getHttpsConfig(rootDir) {
  const pfxPath =
    process.env.KIDS_APP_HTTPS_PFX_PATH || path.join(rootDir, "certs", "lan-server.pfx");
  const pfxPassphrase = process.env.KIDS_APP_HTTPS_PFX_PASSWORD || "kidslan";
  const rootCertPath =
    process.env.KIDS_APP_ROOT_CERT_PATH || path.join(rootDir, "certs", "lan-root.cer");
  const keyPath =
    process.env.KIDS_APP_HTTPS_KEY_PATH || path.join(rootDir, "certs", "lan-key.pem");
  const certPath =
    process.env.KIDS_APP_HTTPS_CERT_PATH || path.join(rootDir, "certs", "lan-cert.pem");

  if (fs.existsSync(pfxPath)) {
    return {
      kind: "pfx",
      pfxPath,
      passphrase: pfxPassphrase,
      rootCertPath: fs.existsSync(rootCertPath) ? rootCertPath : null,
      pfx: fs.readFileSync(pfxPath),
    };
  }

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return null;
  }

  return {
    kind: "pem",
    keyPath,
    certPath,
    rootCertPath: fs.existsSync(rootCertPath) ? rootCertPath : null,
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

export function buildSystemInfo({
  hostname = os.hostname(),
  httpPort,
  httpsPort,
  httpsEnabled,
  rootCertAvailable = false,
}) {
  const lanUrls = getLanUrls(httpPort, "http");
  const lanHttpsUrls = httpsEnabled ? getLanUrls(httpsPort, "https") : [];

  return {
    appName: "Home Learning Web App",
    hostname,
    httpPort,
    httpsPort: httpsEnabled ? httpsPort : null,
    localUrl: `http://127.0.0.1:${httpPort}`,
    lanUrls,
    lanReady: lanUrls.length > 0,
    httpsEnabled,
    localHttpsUrl: httpsEnabled ? `https://127.0.0.1:${httpsPort}` : null,
    lanHttpsUrls,
    rootCertAvailable,
    rootCertUrl: rootCertAvailable ? "/downloads/lan-root.cer" : null,
    secureContextHint: httpsEnabled
      ? "HTTPS is available. Use the HTTPS LAN link on iPad for microphone access."
      : "HTTP works for basic use, but iPad microphone features usually need HTTPS.",
    installSteps: rootCertAvailable
      ? [
          "1. Open the root certificate link below on the iPad and install it.",
          "2. On iPad, go to Settings > General > About > Certificate Trust Settings.",
          "3. Enable trust for the new Kids Home Learning LAN Root certificate.",
          "4. Return here and open the HTTPS LAN link for microphone features.",
        ]
      : [],
    notes: [
      "Keep the iPad and computer on the same Wi-Fi network.",
      "This app stays inside your home network and stores data on this computer.",
      "It still works if the internet is down, as long as the local Wi-Fi network stays up.",
    ],
  };
}
