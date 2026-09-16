export default async function handler(req, res) {
  const origin = process.env.NOVORA_ORIGIN;

  if (!origin) {
    return res.status(500).json({
      ok: false,
      error: "NOVORA_ORIGIN_NOT_CONFIGURED"
    });
  }

  const requestUrl = new URL(
    req.url,
    `https://${req.headers.host}`
  );

  const targetUrl = new URL(
    requestUrl.pathname + requestUrl.search,
    origin
  );

  try {
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (
        value &&
        ![
          "host",
          "connection",
          "content-length",
          "transfer-encoding",
          "upgrade"
        ].includes(key.toLowerCase())
      ) {
        headers.set(
          key,
          Array.isArray(value)
            ? value.join(", ")
            : value
        );
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
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

    const data = Buffer.from(
      await response.arrayBuffer()
    );

    return res.send(data);
  } catch (error) {
    console.error(error);

    return res.status(502).json({
      ok: false,
      error: "NOVORA_ORIGIN_UNAVAILABLE"
    });
  }
}
