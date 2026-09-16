export default async function handler(req, res) {
  const origin = process.env.NOVORA_ORIGIN;

  if (!origin) {
    return res.status(500).json({
      ok: false,
      error: "NOVORA_ORIGIN_NOT_CONFIGURED",
    });
  }

  try {
    const requestUrl = new URL(
      req.url || "/",
      `https://${req.headers.host || "localhost"}`
    );

    const targetUrl = new URL(
      requestUrl.pathname + requestUrl.search,
      origin
    );

    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers || {})) {
      if (!value) continue;

      const lower = key.toLowerCase();

      if (
        [
          "host",
          "connection",
          "content-length",
          "transfer-encoding",
          "upgrade",
          "x-vercel-id",
          "x-vercel-cache",
          "x-forwarded-host",
          "x-forwarded-proto",
          "x-forwarded-for",
        ].includes(lower)
      ) {
        continue;
      }

      headers.set(
        key,
        Array.isArray(value) ? value.join(", ") : value
      );
    }

    headers.set("x-novora-backup", "vercel");

    let body;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      req.body !== undefined &&
      req.body !== null
    ) {
      const contentType = String(
        req.headers["content-type"] || ""
      ).toLowerCase();

      if (Buffer.isBuffer(req.body)) {
        body = req.body;
      } else if (contentType.includes("application/json")) {
        body = JSON.stringify(req.body);
      } else if (
        contentType.includes(
          "application/x-www-form-urlencoded"
        )
      ) {
        body = new URLSearchParams(req.body).toString();
      } else if (typeof req.body === "string") {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }
    }

    console.log(
      `[proxy] ${req.method} ${requestUrl.pathname}${requestUrl.search} -> ${targetUrl}`
    );

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    res.status(response.status);

    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();

      if (
        [
          "connection",
          "keep-alive",
          "transfer-encoding",
          "upgrade",
        ].includes(lower)
      ) {
        return;
      }

      res.setHeader(key, value);
    });

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    );

    const data = Buffer.from(
      await response.arrayBuffer()
    );

    return res.send(data);
  } catch (error) {
    console.error(
      "[Novora Vercel Backup Proxy]",
      error
    );

    return res.status(502).json({
      ok: false,
      error: "NOVORA_ORIGIN_UNAVAILABLE",
    });
  }
}
