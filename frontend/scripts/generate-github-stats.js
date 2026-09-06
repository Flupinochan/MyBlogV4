import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Octokit } from "octokit";

const GITHUB_OWNER = "flupinochan";
const TARGET_LANGUAGES = ["TypeScript", "Dart", "Python", "C#", "Rust"];
const DEFAULT_COLOR = "purple";
const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/components/home/charts/githubStats.mock.json",
);
const DOTENV_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.env",
);

async function loadDotEnv(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=");
          if (idx === -1) return [null, null];
          const key = line.slice(0, idx).trim();
          let value = line.slice(idx + 1).trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          return [key, value];
        })
        .filter((entry) => entry[0] !== null),
    );
  } catch {
    return {};
  }
}

const env = await loadDotEnv(DOTENV_PATH);
const token = process.env.GITHUB_TOKEN ?? env.GITHUB_TOKEN;
if (!token) {
  throw new Error(
    "GITHUB_TOKEN is required. Set it in frontend/.env or your environment.",
  );
}

const octokit = new Octokit({ auth: token });

async function getRepositoryCountByLanguage() {
  const response = await octokit.graphql(
    `
    query getRepositoryCountByLanguage($owner: String!) {
      user(login: $owner) {
        repositories(first: 100, ownerAffiliations: OWNER) {
          nodes {
            primaryLanguage {
              name
              color
            }
          }
        }
      }
    }
    `,
    { owner: GITHUB_OWNER },
  );

  const nodes = response.user?.repositories?.nodes ?? [];
  const languageStats = {};

  for (const node of nodes) {
    const lang = node?.primaryLanguage;
    if (!lang || !TARGET_LANGUAGES.includes(lang.name)) continue;
    const color = lang.color ?? DEFAULT_COLOR;
    languageStats[lang.name] ??= { name: lang.name, count: 0, color };
    languageStats[lang.name].count += 1;
  }

  return Object.values(languageStats).sort((a, b) => b.count - a.count);
}

async function getGitHubLanguageBytesStats() {
  const response = await octokit.graphql(
    `
    query getLanguageBytes($owner: String!) {
      user(login: $owner) {
        repositories(first: 100, ownerAffiliations: OWNER) {
          nodes {
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
    `,
    { owner: GITHUB_OWNER },
  );

  const nodes = response.user?.repositories?.nodes ?? [];
  const languageStats = {};

  for (const repoNode of nodes) {
    for (const edge of repoNode?.languages?.edges ?? []) {
      if (!edge?.node) continue;
      const { name, color } = edge.node;
      const bytes = edge.size;
      if (!TARGET_LANGUAGES.includes(name)) continue;
      languageStats[name] ??= {
        name,
        bytes: 0,
        color: color ?? DEFAULT_COLOR,
      };
      languageStats[name].bytes += bytes;
    }
  }

  return Object.values(languageStats).sort((a, b) => b.bytes - a.bytes);
}

async function getAccountCreatedAt() {
  const response = await octokit.graphql(
    `
    query ($owner: String!) {
      user(login: $owner) {
        createdAt
      }
    }
    `,
    { owner: GITHUB_OWNER },
  );

  if (!response.user) {
    throw new Error("User not found");
  }

  return new Date(response.user.createdAt);
}

async function getGitHubCommitStats() {
  const accountCreatedAt = await getAccountCreatedAt();
  const now = new Date();

  const periods = [];
  let cursor = new Date(accountCreatedAt);

  while (cursor < now) {
    const from = new Date(cursor);
    const to = new Date(from);
    to.setFullYear(to.getFullYear() + 1);
    if (to > now) to.setTime(now.getTime());
    const alias = `y${from.getFullYear()}_${from.getMonth()}`;
    periods.push({ alias, from: from.toISOString(), to: to.toISOString() });
    cursor = to;
  }

  const fields = periods
    .map(
      ({ alias, from, to }) => `
      ${alias}: contributionsCollection(from: "${from}", to: "${to}") {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }`,
    )
    .join("\n");

  const response = await octokit.graphql(
    `query ($owner: String!) { user(login: $owner) { ${fields} } }`,
    { owner: GITHUB_OWNER },
  );

  const map = new Map();
  for (const { alias } of periods) {
    const weeks = response.user?.[alias]?.contributionCalendar?.weeks ?? [];
    for (const week of weeks) {
      for (const day of week.contributionDays) {
        if (map.has(day.date)) continue;
        const date = new Date(day.date);
        if (date >= accountCreatedAt && date <= now) {
          map.set(day.date, day.contributionCount);
        }
      }
    }
  }

  const sortedCommits = Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let runningTotal = 0;
  return sortedCommits.map((commit) => ({
    ...commit,
    total: (runningTotal += commit.count),
  }));
}

async function main() {
  const repositoryCountByLanguage = await getRepositoryCountByLanguage();
  const languageBytes = await getGitHubLanguageBytesStats();
  const commitStats = await getGitHubCommitStats();

  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      { repositoryCountByLanguage, languageBytes, commitStats },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
