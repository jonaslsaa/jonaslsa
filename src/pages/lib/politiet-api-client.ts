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
  summary: z.string(),
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
  count: z.number(),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type MessageThread = z.infer<typeof messageThreadSchema>;
export type ThreadMessage = z.infer<typeof messageSchema>;

export class PolitietApiClient {
  private readonly baseUrl = 'https://politiloggen-vis-frontend.bks-prod.politiet.no/api/messagethread';
  private readonly headers = {
    'accept': 'application/json',
    'content-type': 'application/json; charset=UTF-8',
    'origin': 'https://www.politiet.no',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  };

  /**
   * Fetch message threads within a specific time range
   * @param from Start date (inclusive)
   * @param to End date (exclusive)
   * @returns Validated API response
   */
  async getTimeRangedData(from: Date, to: Date): Promise<ApiResponse> {
    const body = JSON.stringify({
      sortByEnum: 'LastMessageOn',
      sortByAsc: false,
      timeSpanType: 'Custom',
      dateTimeFrom: from.toISOString(),
      dateTimeTo: to.toISOString(),
      skip: 0,
      take: 10,
      category: [],
    });

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body,
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
}

// Usage example:
// const client = new PolitietApiClient();
// const data = await client.getLatest(new Date(Date.now() - 86400000)); // Last 24 hours
