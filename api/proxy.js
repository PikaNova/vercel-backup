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

    // 当前请求：
    // /api/proxy/api/health
    //
    // 实际转发：
    // https://exam.pikachu2026.space/api/health
    //
    // 如果以后使用 vercel.json 把 /api/* 映射到 proxy，
    // 这里也可以直接处理实际路径。

    let targetPath = requestUrl.pathname;

    // 如果请求通过 /api/proxy/xxx 进入，则去掉 /api/proxy
    if (targetPath.startsWith("/api/proxy")) {
      targetPath = targetPath.slice("/api/proxy".length) || "/";
    }

    const targetUrl = new URL(
      targetPath + requestUrl.search,
      origin
    );

    // -----------------------------
    // 请求头
    // -----------------------------

    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers || {})) {
      if (!value) continue;

      const lower = key.toLowerCase();

      // 不把 Vercel / 客户端连接信息直接转发给源站
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

    // 告诉源站这是经过备用入口访问的
    headers.set("x-novora-backup", "vercel");

    // -----------------------------
    // 请求体
    // -----------------------------

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
      } else if (
        contentType.includes("application/json")
      ) {
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

    // -----------------------------
    // 转发
    // -----------------------------

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    // -----------------------------
    // 响应状态
    // -----------------------------

    res.status(response.status);

    // -----------------------------
    // 响应头
    // -----------------------------

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

      // 源站如果返回 Location，
      // 暂时保持原始地址，后面可以再做重定向处理。
      res.setHeader(key, value);
    });

    // 防止备用入口产生缓存
    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    );

    // -----------------------------
    // 返回响应
    // -----------------------------

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
