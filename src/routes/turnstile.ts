import { Hono } from "hono";
import { html, raw } from "hono/html";
import type { Env } from "../lib/types";

const turnstile = new Hono<{ Bindings: Env }>();

turnstile.get("/", async (c) => {
  const siteKey = c.env.TURNSTILE_SITE_KEY;

  if (!siteKey) {
    return c.text("Turnstile not configured", 500);
  }

  const script = `
    var SITE_KEY = "${siteKey}";

    function onloadTurnstileCallback() {
      turnstile.render("#turnstile-container", {
        sitekey: SITE_KEY,
        size: "invisible",
        callback: function (token) {
          if (window.parent) {
            window.parent.postMessage(
              { type: "turnstile-token", token: token },
              "*"
            );
          }
        },
        "error-callback": function (error) {
          if (window.parent) {
            window.parent.postMessage(
              { type: "turnstile-error", error: error },
              "*"
            );
          }
        },
      });
    }
  `;

  return c.html(html`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Verifying...</title>
        <script>
          ${raw(script)}
        </script>
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit"
          async
          defer
        ></script>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: transparent;
          }
        </style>
      </head>
      <body>
        <div id="turnstile-container"></div>
      </body>
    </html>`);
});

export default turnstile;
