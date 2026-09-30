/**
 * SoftNest Cleaners — Admin backend
 * Cloudflare Pages Function: POST /api/admin
 *
 * Lets admin.html add/delete reviews and add/delete gallery photos by
 * committing directly to this site's GitHub repo (reviews.json,
 * gallery.json, and the actual photo files under images/). If this
 * Cloudflare Pages project is Git-connected, every commit here triggers
 * an automatic redeploy — the live site updates within about a minute.
 *
 * SETUP (Cloudflare Pages project -> Settings -> Environment variables,
 * add to BOTH Production and Preview):
 *   GITHUB_TOKEN  - GitHub Personal Access Token, fine-grained, scoped
 *                   to only this repo, Contents: Read and write.
 *   GITHUB_REPO   - "SoftNestCleaners/SNC"
 *   GITHUB_BRANCH - "main"
 *   ADMIN_KEY     - a password you make up; admin.html asks for this
 *                   before it will change anything. The real GitHub
 *                   write access (GITHUB_TOKEN) never reaches the
 *                   browser, so this only needs to be good enough to
 *                   keep random visitors out.
 */

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    for (const name of ["GITHUB_TOKEN", "GITHUB_REPO", "ADMIN_KEY"]) {
      if (!env[name]) return json({ error: `Server is missing ${name}.` }, 500);
    }
    const branch = env.GITHUB_BRANCH || "main";

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Body must be JSON." }, 400);
    }

    if (!body || body.adminKey !== env.ADMIN_KEY) {
      return json({ error: "Wrong admin key." }, 401);
    }

    const gh = new GitHub(env.GITHUB_TOKEN, env.GITHUB_REPO, branch);

    switch (body.mode) {
      case "addReview":
        return await addReview(body, gh);
      case "deleteReview":
        return await deleteReview(body, gh);
      case "editReview":
        return await editReview(body, gh);
      case "addPhoto":
        return await addPhoto(body, gh);
      case "deletePhoto":
        return await deletePhoto(body, gh);
      default:
        return json({ error: "Unknown mode." }, 400);
    }
  } catch (err) {
    return json({ error: "Unhandled: " + (err && err.stack ? err.stack : String(err)) }, 502);
  }
}


export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "Use POST." }, 405);
}

/* ---------------- reviews ---------------- */

async function addReview(body, gh) {
  const name = (body.name || "").trim();
  const text = (body.text || "").trim();
  if (!name || !text) return json({ error: "Name and text are required." }, 400);

  const { content, sha } = await gh.getFile("reviews.json");
  const data = JSON.parse(content);
  const id = data.nextId || nextFrom(data.items, "id");
  data.items.push({ id, name, text });
  data.nextId = id + 1;

  await gh.putFile("reviews.json", jsonB64(data), `Add review from ${name}`, sha);
  return json({ ok: true, id }, 200);
}

async function editReview(body, gh) {
  const { id } = body;
  const name = (body.name || "").trim();
  const text = (body.text || "").trim();
  if (id === undefined || !name || !text) return json({ error: "id, name and text are required." }, 400);

  const { content, sha } = await gh.getFile("reviews.json");
  const data = JSON.parse(content);
  const r = data.items.find((x) => x.id === id);
  if (!r) return json({ error: "Review not found." }, 404);
  r.name = name;
  r.text = text;

  await gh.putFile("reviews.json", jsonB64(data), `Edit review #${id}`, sha);
  return json({ ok: true }, 200);
}

async function deleteReview(body, gh) {
  const { id } = body;
  if (id === undefined) return json({ error: "Missing id." }, 400);

  const { content, sha } = await gh.getFile("reviews.json");
  const data = JSON.parse(content);
  const before = data.items.length;
  data.items = data.items.filter((r) => r.id !== id);
  if (data.items.length === before) return json({ error: "Review not found." }, 404);

  await gh.putFile("reviews.json", jsonB64(data), `Delete review #${id}`, sha);
  return json({ ok: true }, 200);
}

/* ---------------- gallery photos ---------------- */

async function addPhoto(body, gh) {
  const { thumb, full } = body;
  const alt = (body.alt || "Cleaning result").trim();
  const cap = (body.cap || alt).trim();
  if (!thumb || !full || !thumb.startsWith("data:image/") || !full.startsWith("data:image/")) {
    return json({ error: "Missing/invalid thumb or full image data." }, 400);
  }

  const { content, sha } = await gh.getFile("gallery.json");
  const data = JSON.parse(content);
  const num = data.nextNum || nextFrom(data.items, "num");
  const padded = String(num).padStart(2, "0");

  const thumbB64 = thumb.slice(thumb.indexOf(",") + 1);
  const fullB64 = full.slice(full.indexOf(",") + 1);

  await gh.putFile(`images/work-${padded}.jpg`, thumbB64, `Add gallery photo ${padded} (thumb)`);
  await gh.putFile(`images/work-${padded}-full.jpg`, fullB64, `Add gallery photo ${padded} (full)`);

  data.items.push({ num, alt, cap, w: 300, h: 300 });
  data.nextNum = num + 1;
  await gh.putFile("gallery.json", jsonB64(data), `Update gallery.json for photo ${padded}`, sha);

  return json({ ok: true, num }, 200);
}

async function deletePhoto(body, gh) {
  const { num } = body;
  if (num === undefined) return json({ error: "Missing num." }, 400);
  const padded = String(num).padStart(2, "0");

  const { content, sha } = await gh.getFile("gallery.json");
  const data = JSON.parse(content);
  const before = data.items.length;
  data.items = data.items.filter((p) => p.num !== num);
  if (data.items.length === before) return json({ error: "Photo not found." }, 404);

  // Best-effort file deletes — if one is already missing, still finish
  // updating gallery.json so the listing doesn't stay stuck.
  for (const path of [`images/work-${padded}.jpg`, `images/work-${padded}-full.jpg`]) {
    try {
      const f = await gh.getFile(path);
      await gh.deleteFile(path, f.sha, `Delete gallery photo ${padded}`);
    } catch {
      /* file already gone — fine */
    }
  }

  await gh.putFile("gallery.json", jsonB64(data), `Remove gallery photo ${padded}`, sha);
  return json({ ok: true }, 200);
}

/* ---------------- helpers ---------------- */

function nextFrom(items, field) {
  if (!items || !items.length) return 1;
  return Math.max(...items.map((x) => x[field])) + 1;
}

function jsonB64(data) {
  return b64encode(JSON.stringify(data, null, 2) + "\n");
}

function b64encode(str) {
  // btoa only handles Latin1; this covers UTF-8 text like review text.
  return btoa(unescape(encodeURIComponent(str)));
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "(no body)";
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* ---------------- tiny GitHub Contents API client ---------------- */

class GitHub {
  constructor(token, repo, branch) {
    this.token = token;
    this.repo = repo; // "owner/name"
    this.branch = branch;
  }

  async getFile(path) {
    const res = await fetch(`https://api.github.com/repos/${this.repo}/contents/${path}?ref=${this.branch}`, {
      headers: this._headers(),
    });
    if (!res.ok) throw new Error(`GitHub read failed for ${path}: ${await safeText(res)}`);
    const data = await res.json();
    return { content: atob(data.content.replace(/\n/g, "")), sha: data.sha };
  }

  async deleteFile(path, sha, message) {
    const attempt = async () =>
      fetch(`https://api.github.com/repos/${this.repo}/contents/${path}`, {
        method: "DELETE",
        headers: this._headers(),
        body: JSON.stringify({ message, sha, branch: this.branch }),
      });

    let res = await attempt();
    let tries = 0;
    while (!res.ok && res.status === 409 && tries < 2) {
      const bodyText = await res.text();
      if (!/timed out validating rule/i.test(bodyText)) {
        throw new Error(`GitHub delete failed for ${path}: ${bodyText}`);
      }
      tries++;
      await new Promise((r) => setTimeout(r, 1200 * tries));
      res = await attempt();
    }
    if (!res.ok) throw new Error(`GitHub delete failed for ${path}: ${await safeText(res)}`);
    return res.json();
  }

  async putFile(path, base64Content, message, sha) {
    let currentSha = sha;
    const attempt = async () =>
      fetch(`https://api.github.com/repos/${this.repo}/contents/${path}`, {
        method: "PUT",
        headers: this._headers(),
        body: JSON.stringify({
          message,
          content: base64Content,
          branch: this.branch,
          ...(currentSha ? { sha: currentSha } : {}),
        }),
      });

    let res = await attempt();

    // GitHub occasionally times out evaluating a repo rule and asks the
    // caller to just retry (HTTP 409). Transient, not a real block.
    let tries = 0;
    while (!res.ok && res.status === 409 && tries < 2) {
      const bodyText = await res.text();
      if (!/timed out validating rule/i.test(bodyText)) {
        throw new Error(`GitHub write failed for ${path}: ${bodyText}`);
      }
      tries++;
      await new Promise((r) => setTimeout(r, 1200 * tries));
      res = await attempt();
    }

    // If a file already exists but we tried to create it without a sha,
    // GitHub returns 422 — fetch the current sha and retry as an update.
    if (!res.ok && res.status === 422 && !currentSha) {
      const bodyText = await res.text();
      if (/sha.*wasn.?t supplied/i.test(bodyText)) {
        const existing = await this.getFile(path);
        currentSha = existing.sha;
        res = await attempt();
      } else {
        throw new Error(`GitHub write failed for ${path}: ${bodyText}`);
      }
    }

    if (!res.ok) throw new Error(`GitHub write failed for ${path}: ${await safeText(res)}`);
    return res.json();
  }

  _headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "softnest-admin",
    };
  }
}
