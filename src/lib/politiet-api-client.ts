import { z } from 'zod';

const messageSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdOn: z.coerce.date(),
  updatedOn: z.coerce.date(),
  hasImage: z.boolean(),
  previouslyIncludedImage: z.boolean(),
  type: z.string(),
});

const messageThreadSchema = z.object({
  id: z.string(),
  district: z.string(),
  districtId: z.number(),
  summary: z.string().optional().default(''),
  category: z.string(),
  municipality: z.string(),
  area: z.string(),
  createdOn: z.coerce.date(),
  updatedOn: z.coerce.date(),
  lastMessageOn: z.coerce.date(),
  isActive: z.boolean(),
  messages: z.array(messageSchema),
});

const apiResponseSchema = z.object({
  messageThreads: z.array(messageThreadSchema),
  // Politiloggen replaced `count` with `hasMoreResults` around 2026-08-23.
  count: z.number().optional(),
  hasMoreResults: z.boolean().optional(),
});

const messageThreadResponseSchema = messageThreadSchema;

export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type MessageThread = z.infer<typeof messageThreadSchema>;
export type ThreadMessage = z.infer<typeof messageSchema>;

export class PolitietApiClient {
  private readonly baseUrl = 'https://www.politiet.no/politiloggen/api';
  private readonly headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  };

  /**
   * Fetch message threads within a specific time range
   * @param from Start date (inclusive)
   * @param to End date (exclusive)
   * @returns Validated API response
   */
  async getTimeRangedData(from: Date, to: Date, take = 512, maxPages = 10): Promise<ApiResponse> {
    const messageThreads: MessageThread[] = [];
    for (let page = 0; page < maxPages; page++) {
      const response = await this.getTimeRangedPage(from, to, page * take, take);
      messageThreads.push(...response.messageThreads);
      if (!response.hasMoreResults || response.messageThreads.length === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return { messageThreads, count: messageThreads.length, hasMoreResults: false };
  }

  private async getTimeRangedPage(from: Date, to: Date, skip: number, take: number): Promise<ApiResponse> {
    const url = new URL(`${this.baseUrl}/messagethreads`);
    url.searchParams.set('skip', String(skip));
    url.searchParams.set('take', String(take));
    url.searchParams.set('sortByEnum', 'LastMessageOn');
    url.searchParams.set('sortByAsc', 'false');
    url.searchParams.set('timeSpanType', 'Custom');
    url.searchParams.set('dateTimeFrom', from.toISOString());
    url.searchParams.set('dateTimeTo', to.toISOString());

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return apiResponseSchema.parse(data);
    } catch (error) {
      throw new Error(`Failed to fetch police data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get latest messages from specified start date until now
   * @param from Start date (inclusive)
   * @returns Validated API response
   */
  async getLatest(from: Date): Promise<ApiResponse> {
    return this.getTimeRangedData(from, new Date());
  }

  /**
   * Fetch a specific message thread by its ID
   * @param id Thread ID to fetch
   * @returns Validated message thread
   */
  async getThreadById(id: string): Promise<MessageThread> {
    const url = new URL(`${this.baseUrl}/messagethread/${id}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return messageThreadResponseSchema.parse(data);
    } catch (error) {
      throw new Error(`Failed to fetch thread ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Usage example:
// const client = new PolitietApiClient();
// const data = await client.getLatest(new Date(Date.now() - 86400000)); // Last 24 hours
