import type { User } from "@octokit/graphql-schema";
import { GITHUB_TOKEN } from "astro:env/server";
import { Octokit } from "octokit";
import type {
  GitHubCommitCount,
  LanguageRepositoryBytes,
  LanguageRepositoryCount,
} from "./github.types";

const GITHUB_OWNER = "flupinochan";
const TARGET_LANGUAGES = ["TypeScript", "Dart", "Python", "C#", "Rust"];
const DEFAULT_COLOR = "purple";

let octokit: Octokit | null = null;
function getOctokit(): Octokit {
  if (octokit) return octokit;

  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is missing in .env file");
  }

  octokit = new Octokit({ auth: GITHUB_TOKEN });
  return octokit;
}

export async function getRepositoryCountByLanguage(): Promise<
  LanguageRepositoryCount[]
> {
  const response = await getOctokit().graphql<{ user: User | null }>(
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
    {
      owner: GITHUB_OWNER,
    },
  );

  const nodes = response.user?.repositories.nodes;
  if (!nodes) {
    throw new Error("Failed to fetch repositories for the user.");
  }

  const languageStats: Record<string, LanguageRepositoryCount> = {};
  for (const node of nodes) {
    const lang = node?.primaryLanguage;
    if (lang && TARGET_LANGUAGES.includes(lang.name)) {
      languageStats[lang.name] ??= {
        name: lang.name,
        count: 0,
        color: lang.color || DEFAULT_COLOR,
      };
      const stat = languageStats[lang.name];
      if (stat === undefined) throw new Error(`Language stat not found: ${lang.name}`);
      stat.count += 1;
    }
  }

  if (Object.keys(languageStats).length === 0) {
    throw new Error("No language data found for the specified languages.");
  }

  return Object.values(languageStats).sort((a, b) => b.count - a.count);
}

export async function getGitHubLanguageBytesStats(): Promise<
  LanguageRepositoryBytes[]
> {
  const response = await getOctokit().graphql<{ user: User | null }>(
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
    {
      owner: GITHUB_OWNER,
    },
  );

  const nodes = response.user?.repositories.nodes;
  if (!nodes) {
    throw new Error("Failed to fetch repository language bytes.");
  }

  const languageStats: Record<string, LanguageRepositoryBytes> = {};

  for (const repoNode of nodes) {
    repoNode?.languages?.edges?.forEach((edge) => {
      if (!edge || !edge.node) return;

      const { name, color } = edge.node;
      const bytes = edge.size;

      if (TARGET_LANGUAGES.includes(name)) {
        languageStats[name] ??= {
          name,
          bytes: 0,
          color: color || DEFAULT_COLOR,
        };
        languageStats[name].bytes += bytes;
      }
    });
  }

  if (Object.keys(languageStats).length === 0) {
    throw new Error("No language byte data found.");
  }

  return Object.values(languageStats).sort((a, b) => b.bytes - a.bytes);
}

// アカウント作成日を取得
async function getAccountCreateAt(): Promise<Date> {
  const res = await getOctokit().graphql<{
    user: { createdAt: string } | null;
  }>(
    `
    query ($owner: String!) {
      user(login: $owner) {
        createdAt
      }
    }
    `,
    { owner: GITHUB_OWNER },
  );

  if (!res.user) throw new Error("User not found");
  return new Date(res.user.createdAt);
}

export async function getGitHubCommitStats(): Promise<GitHubCommitCount[]> {
  const accountCreateAt = await getAccountCreateAt();
  const now = new Date();

  const periods: { alias: string; from: string; to: string }[] = [];
  let cursor = new Date(accountCreateAt);
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

  const res = await getOctokit().graphql<any>(
    `query ($owner: String!) { user(login: $owner) { ${fields} } }`,
    { owner: GITHUB_OWNER },
  );

  const map = new Map<string, number>();
  for (const { alias } of periods) {
    const weeks = res.user?.[alias]?.contributionCalendar?.weeks ?? [];
    for (const week of weeks) {
      for (const day of week.contributionDays) {
        if (map.has(day.date)) continue;
        const date = new Date(day.date);
        if (date >= accountCreateAt && date <= now) {
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
