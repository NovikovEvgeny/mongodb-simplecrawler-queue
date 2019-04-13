/**
 * FetchQueueInterface is a typescript module based on original simplecrawler project
 * And rewritten on the TypeScript
 * Almost all documentation is copy-pasted from FetchQueue documentation
 * {@link https://github.com/simplecrawler/simplecrawler/blob/master/lib/queue.js}
 */

/**
 * QueueItem possible statuses
 * This enum contains everything what was found in original simplecrawler codebase
 */
export enum QueueItemStatus {
  Queued = 'queued',
  Spooled = 'spooled',
  Headers = 'headers',
  Downloaded = 'downloaded',
  Redirected = 'redirected',
  NotFound = 'notfound',
  Failed = 'failed',
  Created = 'created',
  Timeout = 'timeout',
  Downloadprevented = 'downloadprevented',
  /**
   * custom status for atomic operation of "add"
   */
  Pulled = 'pulled',
}

/**
 * List of allowed statistic metrics
 * Controls what properties can be operated on with the
 * {@link FetchQueue#min}, {@link FetchQueue#avg} and {@link FetchQueue#max}
 * methods.
 */
export enum AllowedStatistics {
  actualDataSize = 'actualDataSize',
  contentLength = 'contentLength',
  downloadTime = 'downloadTime',
  requestLatency = 'requestLatency',
  requestTime = 'requestTime',
}

/**
 * StateData is an object containing state data and other information about the request.
 */
export interface StateData {
  [key: string]: any;

  /**
   * The time (in ms) taken for headers to be received after the request was made
   */
  requestLatency: number;
  /**
   * The total time (in ms) taken for the request (including download time)
   */
  requestTime: number;
  /**
   * The total time (in ms) taken for the resource to be downloaded
   */
  downloadTime: number;
  /**
   * The length (in bytes) of the returned content. Calculated based on the `content-length` header
   */
  contentLength: number;
  /**
   * The MIME type of the content
   */
  contentType: string;
  /**
   * The HTTP status code returned for the request.
   * Note that this code is `600` if an error occurred in the client
   * and a fetch operation could not take place successfully
   */
  code: number;
  /**
   * An object containing the header information
   * returned by the server. This is the object node returns as part of the `response` object
   */
  headers: object;
  /**
   * The length (in bytes) of the returned content.
   * Calculated based on what is actually received, not the `content-length` header
   */
  actualDataSize: number;
  /**
   * True if the data length returned by the server
   * did not match what we were told to expect by the `content-length` header
   */
  sentIncorrectSize: boolean;
}

/**
 * QueueItem represent resources in the queue that have been fetched, or will be eventually.
 */
export interface QueueItem {
  /**
   * A unique ID assigned by the queue when the queue item is added
   */
  id: any;

  /**
   * The complete, canonical URL of the resource
   */
  url: string;
  /**
   * The protocol of the resource (http, https)
   */
  protocol: string;
  /**
   * The full domain/hostname of the resource
   */
  host: string;
  /**
   * The port of the resource
   */
  port: number;
  /**
   * The URL path, including the query string
   */
  path: string;
  /**
   * The URL path, excluding the query string
   */
  uriPath: string;
  /**
   * How many steps simplecrawler
   * has taken from the initial page (which is depth 1) to this resource.
   */
  depth: number;
  /**
   * The URL of the resource where the URL of this queue item was discovered
   */
  referrer: string;
  /**
   * Has the request for this item been completed? You can monitor this as requests are processed.
   */
  fetched: boolean;
  /**
   * The internal status of the item.
   */
  status: QueueItemStatus;
  /**
   * An object containing state data and other information about the request.
   */
  stateData: StateData;
}

/**
 * QueueError extends general Error object to have special field
 * @extends Error
 */
export class QueueError extends Error {
  code: string;

  constructor(m: string, c: string) {
    super(m);
    this.code = c;
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, QueueError.prototype);
  }
}

/**
 * FetchQueue handles {@link QueueItem}s and provides a few utility methods for querying them
 */
export interface FetchQueue {
  /**
   * Checks if a URL already exists in the queue. Returns true if URL already exists.
   * @param url URL to check the existence of in the queue
   * @return Promise<boolean> value of the promise is true if it exists, false otherwise
   */
  exists(url: string, callback: Function | null): Promise<boolean | void>;

  /**
   * Get a queue item by index
   * @param index The index of the queue item in the queue
   * @return Promise<QueueItem> with {@link QueueItem}.
   * If index is more than current length of the queue,
   * Promise will be rejected with 'out of range' value
   * @deprecated
   */
  get(index: number, callback: Function | null): Promise<QueueItem | void>;

  /**
   * Adds an item to the queue
   * @param queueItem Queue item that is to be added to the queue
   * @param [force=false] If true, the queue item will
   * be added regardless of whether it already exists in the queue
   * @return Promise<QueueItem> Promise with {@link QueueItem} value.
   * If the operation was successful, {@link QueueItem} will be the item
   * that was added to the queue. It's {@link QueueItem.status} property
   * will have changed to `{@link QueueItemStatus.Queued}.
   */
  add(queueItem: QueueItem, force: boolean, callback: Function | null): Promise<QueueItem | void>;

  /**
   * Updates a queue item in the queue.
   * @param id ID of the queue item that is to be updated
   * @param updates Object that will be deeply assigned (as in `Object.assign`)
   * to the queue item. That means that nested objects will also be resursively assigned.
   * @return Promise<QueueItem> with updated {@link QueueItem}
   */
  update(id: Number, updates: QueueItem, callback: Function | null): Promise<QueueItem | void>;

  /**
   * Gets the first unfetched item in the queue
   * @return Promise<QueueItem> Promise with {@link QueueItem}
   * If there are unfetched queue items left, {@link QueueItem} will be the oldest one found.
   * If not, value of the promise will be `null`.
   */
  oldestUnfetchedItem(callback: Function | null): Promise<QueueItem | null | void>;

  /**
   * Gets the maximum value of a stateData property from all the items in the
   * queue. This means you can eg. get the maximum request time, download size
   * etc.
   * @param statisticName Can be any of the strings in {@link AllowedStatistics}
   * @return Promise<Number> calculated value
   */
  max(statisticName: string, callback: Function | null): Promise<number | void>;

  /**
   * Gets the minimum value of a stateData property from all the items in the
   * queue. This means you can eg. get the minimum request time, download size
   * etc.
   * @param statisticName Can be any of the strings in {@link AllowedStatistics}
   * @return Promise<Number> calculated value
   */
  min(statisticName: string, callback: Function | null): Promise<number | void>;

  /**
   * Gets the average value of a stateData property from all the items in the
   * queue. This means you can eg. get the average request time, download size
   * etc.
   * @param statisticName Can be any of the strings in {@link AllowedStatistics}
   * @return Promise<Number> calculated value
   */
  avg(statisticName: string, callback: Function | null): Promise<number | void>;

  /**
   * Counts the items in the queue that match a selector
   * @param comparator Object Comparator object used to filter items.
   * Queue items that are counted need to match all the properties of this object.
   * @return Promise<Number> with value of calculated items
   */
  countItems(comparator: object, callback: Function | null): Promise<number | void>;

  /**
   * Filters and returns the items in the queue that match a selector
   * @param comparator Object Comparator object used to filter items.
   * Queue items that are returned need to match all the properties of this object.
   * @return Promise<Number> with value of calculated items
   */
  filterItems(comparator: object, callback: Function | null): Promise<QueueItem[] | void>;

  /**
   * Gets the total number of queue items in the queue
   * @return Promise<Number> total number of queued items
   */
  getLength(callback: Function | null): Promise<number | void>;

  /**
   * @deprecated
   */
  freeze(filename: string, callback: Function | null): Promise<boolean | void>;

  /**
   * @deprecated
   */
  defrost(filename: string, callback: Function | null): Promise<boolean | void>;

  /*
   * custom methods
   */
  init(config: any, callback: Function | null): Promise<any | void>;

  finalize(config: any, callback: Function | null): Promise<any | void>;
}
