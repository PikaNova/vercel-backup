export default async function handler(req, res) {
  const origin = process.env.NOVORA_ORIGIN;

  if (!origin) {
    return res.status(500).json({
      error: "NOVORA_ORIGIN_NOT_CONFIGURED"
    });
  }

  const requestUrl = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = new URL(
    requestUrl.pathname + requestUrl.search,
    origin
  );

  // WebSocket 不通过这个 HTTP Proxy
  if (
    req.headers.upgrade &&
    req.headers.upgrade.toLowerCase() === "websocket"
  ) {
    return res.status(426).json({
      error: "WEBSOCKET_NOT_SUPPORTED_BY_BACKUP_PROXY"
    });
  }

  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (
      ![
        "host",
        "connection",
        "content-length",
        "transfer-encoding",
        "upgrade"
      ].includes(key.toLowerCase())
    ) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else if (value != null) {
        headers.set(key, value);
      }
    }
  }

  headers.set("host", targetUrl.host);

  let body;

  if (!["GET", "HEAD"].includes(req.method)) {
    body = req.body;
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual"
    });

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (
        ![
          "connection",
          "keep-alive",
          "transfer-encoding",
          "upgrade"
        ].includes(key.toLowerCase())
      ) {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    return res.send(buffer);
  } catch (error) {
    console.error("NOVORA_PROXY_ERROR", error);

    return res.status(502).json({
      error: "NOVORA_ORIGIN_UNAVAILABLE"
    });
  }
}
