import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dns from "dns";

// Fix Node localhost DNS resolution
dns.setDefaultResultOrder("ipv4first");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Route for LINE Notify proxy
  app.post("/api/line-notify", async (req: express.Request, res: express.Response) => {
    try {
      const { message, token } = req.body;
      const lineToken = token || process.env.LINE_NOTIFY_TOKEN;

      if (!lineToken) {
        return res.status(400).json({ error: "Missing LINE Notify Token" });
      }
      if (!message) {
        return res.status(400).json({ error: "Missing message" });
      }

      const response = await fetch("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lineToken}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ message })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }

      const data = await response.json();
      return res.json({ success: true, data });
    } catch (error: any) {
      console.error("LINE Notify Proxy error:", error);
      return res.status(500).json({ error: error.message || "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
