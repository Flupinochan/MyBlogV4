import type {
  GitHubCommitCount,
  LanguageRepositoryBytes,
  LanguageRepositoryCount,
} from "./github.types";
import mockJson from "./githubStats.mock.json";

export async function getRepositoryCountByLanguage(): Promise<
  LanguageRepositoryCount[]
> {
  return mockJson.repositoryCountByLanguage as LanguageRepositoryCount[];
}

export async function getGitHubLanguageBytesStats(): Promise<
  LanguageRepositoryBytes[]
> {
  return mockJson.languageBytes as LanguageRepositoryBytes[];
}

export async function getGitHubCommitStats(): Promise<GitHubCommitCount[]> {
  return mockJson.commitStats as GitHubCommitCount[];
}
