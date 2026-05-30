import { check } from "k6";
import http from "k6/http";
import { Options } from "k6/options";

export const options: Options = {
  scenarios: {
    smoke: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<5000"],
  },
};

const SEARCH: string =
  __ENV.BASE_URL_SEARCH ?? "https://dev-blog.metalmental.net/opensearch-api";
const CHAT: string =
  __ENV.BASE_URL_CHAT ?? "https://dev-blog.metalmental.net/voicevox-api";

export default function (): void {
  check(http.get(`${SEARCH}/v1/health`), {
    "health: status 200": (r) => r.status === 200,
  });

  check(http.get(`${SEARCH}/v1/health/opensearch`), {
    "health/opensearch: status 200": (r) => r.status === 200,
  });

  const blogs = http.get(`${SEARCH}/v1/blogs?limit=5`);
  check(blogs, {
    "blogs: status 200": (r) => r.status === 200,
    "blogs: has data array": (r) =>
      r.body !== null && r.json("data") !== undefined,
  });

  const topics = http.get(`${SEARCH}/v1/topics`);
  check(topics, {
    "topics: status 200": (r) => r.status === 200,
    "topics: has data array": (r) =>
      r.body !== null && r.json("data") !== undefined,
  });

  check(http.get(`${CHAT}/v1/health`), {
    "voicevox health: status 200": (r) => r.status === 200,
  });

  const chat = http.post(
    `${CHAT}/v1/chat`,
    JSON.stringify({ messages: [{ role: "user", content: "こんにちは" }] }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(chat, {
    "chat: status 200": (r) => r.status === 200,
    "chat: has message field": (r) =>
      r.body !== null && r.json("message") !== undefined,
  });
}
