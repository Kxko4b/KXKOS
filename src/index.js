const ALLOWED_HOSTS = new Set([
  "example.com",
  "www.example.com",
  "kxko4b.github.io",
]);

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();

  return (
    ALLOWED_HOSTS.has(host) ||
    [...ALLOWED_HOSTS].some(
      allowed => host.endsWith("." + allowed)
    )
  );
}

function error(message, status = 400) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
    },
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (!ALLOWED_METHODS.has(request.method)) {
      return error("Method not allowed.", 405);
    }

    const incoming = new URL(request.url);
    const target = incoming.searchParams.get("url");

    if (!target) {
      return error("Missing ?url=https://example.com/");
    }

    let targetUrl;

    try {
      targetUrl = new URL(target);
    } catch {
      return error("Invalid URL.");
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return error("Only HTTP and HTTPS URLs are supported.");
    }

    if (!isAllowedHost(targetUrl.hostname)) {
      return error(
        "This domain is not enabled in KXEARCH Proxy yet.",
        403
      );
    }

    const upstream = await fetch(targetUrl.toString(), {
      method: request.method,
      redirect: "follow",
      headers: {
        "User-Agent": "KXEARCH/1.0",
        "Accept": request.headers.get("Accept") || "*/*",
      },
    });

    const headers = new Headers(upstream.headers);

    headers.delete("content-security-policy");
    headers.delete("content-security-policy-report-only");
    headers.delete("x-frame-options");

    for (const [key, value] of Object.entries(corsHeaders(origin))) {
      headers.set(key, value);
    }

    const contentType = headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      const response = new HTMLRewriter()
        .on("base", {
          element(element) {
            element.remove();
          },
        })
        .on("a", {
          element(element) {
            const href = element.getAttribute("href");

            if (!href) return;

            try {
              const absolute = new URL(href, targetUrl);

              if (isAllowedHost(absolute.hostname)) {
                element.setAttribute(
                  "href",
                  "/?url=" + encodeURIComponent(absolute.toString())
                );
              }
            } catch {}
          },
        })
        .transform(new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers,
        }));

      return response;
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};
