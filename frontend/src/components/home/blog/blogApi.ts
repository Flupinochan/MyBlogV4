import createClient from "openapi-fetch";
import type { components, paths } from "../../../types/api-opensearch.generated";

export type BlogListItem = components["schemas"]["BlogSearchResultItem"];
export type TopicBucket = components["schemas"]["TopicBucket"];
export type BlogListResponse = components["schemas"]["ListBlogsBody"];
export type TopicsResponse = components["schemas"]["ListTopicsOutputBody"];

const client = createClient<paths>({ baseUrl: "/api" });

export async function fetchBlogs(params: {
  limit: number;
  cursor?: unknown;
  query?: string;
  topic?: string;
  search_mode?: "fulltext" | "vector" | "hybrid";
  search_pipeline?: string;
}): Promise<BlogListResponse> {
  const { data, error } = await client.GET("/v1/blogs", {
    params: {
      query: {
        limit: params.limit,
        cursor:
          params.cursor != null ? JSON.stringify(params.cursor) : undefined,
        query: params.query,
        topic: params.topic,
        search_mode: params.search_mode,
        search_pipeline: params.search_pipeline,
      },
    },
  });
  if (error !== undefined) throw new Error("Failed to fetch blogs");
  return data;
}

export async function fetchTopics(): Promise<TopicsResponse> {
  const { data, error } = await client.GET("/v1/topics", {});
  if (error !== undefined) throw new Error("Failed to fetch topics");
  return data;
}
