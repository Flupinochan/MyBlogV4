import createClient from "openapi-fetch";
import type { components, paths } from "../../../types/api-voicevox.generated";
import { ApiError } from "../../../lib/apiError";

export type ContactRequest = components["schemas"]["ContactRequest"];
export type ContactResponse = components["schemas"]["ContactResponse"];

const client = createClient<paths>({ baseUrl: "/voicevox-api" });

export async function sendContact(
  request: ContactRequest,
): Promise<ContactResponse> {
  const { data, error, response } = await client.POST("/v1/contact", { body: request });
  if (error) throw new ApiError(response.status, "contact request failed");
  return data;
}
