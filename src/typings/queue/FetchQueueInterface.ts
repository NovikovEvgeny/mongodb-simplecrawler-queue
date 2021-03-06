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
import { MongoDbQueueConfig } from './MongoDBQueueConfig';

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
   * @param callback if defined - Gets two parameters, `error` and `count`.
   *  If the operation was successful, `error` will be `null`.
   * @return Promise<boolean> value of the promise is true if it exists, false otherwise. if callback is not defined
   */
  exists(url: string, callback?: Function): Promise<boolean | void>;

  /**
   * Get a queue item by index
   * @param index The index of the queue item in the queue
   * @param callback if defined - Gets two parameters, `error` and `queueItem`.
   * If the operation was successful, `error` will be `null`.
   * @return Promise<QueueItem> with {@link QueueItem}. if callback is not defined
   * If index is more than current length of the queue,
   * Promise will be rejected with 'out of range' value
   * @deprecated
   */
  get(index: number, callback?: Function): Promise<QueueItem | void>;

  /**
   * Adds an item to the queue
   * @param queueItem Queue item that is to be added to the queue
   * @param [force=false] If true, the queue item will
   * be added regardless of whether it already exists in the queue
   *
   * @param callback if defined - Gets two parameters, `error` and `queueItem`. If the operation was successful,
   * error` will be `null` and `queueItem` will be the item that was added to the queue. It's status property
   * will have changed to `"queued"`.
   * @return Promise<QueueItem> if callback is not defined. Promise with {@link QueueItem} value.
   * If the operation was successful, {@link QueueItem} will be the item
   * that was added to the queue. It's {@link QueueItem.status} property
   * will have changed to `{@link QueueItemStatus.Queued}.
   */
  add(queueItem: QueueItem, force: boolean, callback?: Function): Promise<QueueItem | void>;

  /**
   * Updates a queue item in the queue.
   * @param id ID of the queue item that is to be updated
   * @param updates Object that will be deeply assigned (as in `Object.assign`)
   * to the queue item. That means that nested objects will also be resursively assigned.
   * @param callback if defined - Gets two parameters, `error` and `queueItem`.
   * If the operation was successful, `error` will be `null`.
   * @return Promise<QueueItem> with updated {@link QueueItem} if callback is not defined
   */
  update(id: Number, updates: QueueItem, callback?: Function): Promise<QueueItem | void>;

  /**
   * Gets the first unfetched item in the queue
   * @param callback if defined - Gets two parameters, `error` and `queueItem`. If the operation was successful, `error`
   * will be `null`. If there are unfetched queue items left, `queueItem` will be the oldest one found.
   * If not, `queueItem` will be `null`.
   * @return Promise<QueueItem> Promise with {@link QueueItem} if callback is not defined
   * If there are unfetched queue items left, {@link QueueItem} will be the oldest one found.
   * If not, value of the promise will be `null`.
   */
  oldestUnfetchedItem(callback?: Function): Promise<QueueItem | null | void>;

  /**
   * Gets the maximum value of a stateData property from all the items in the
   * queue. This means you can eg. get the maximum request time, download size
   * etc.
   * @param statisticName Can be any of the strings in {@link AllowedStatistics}
   * @param callback if defined - Gets two parameters, `error` and `max`.
   * If the operation was successful, `error` will be `null`.
   * @return Promise<Number> calculated value if callback is undefined
   */
  max(statisticName: string, callback?: Function): Promise<number | void>;

  /**
   * Gets the minimum value of a stateData property from all the items in the
   * queue. This means you can eg. get the minimum request time, download size
   * etc.
   * @param statisticName Can be any of the strings in {@link AllowedStatistics}
   * @param callback if defined - Gets two parameters, `error` and `min`.
   * If the operation was successful, `error` will be `null`.
   * @return Promise<Number> calculated value if callback is undefined
   */
  min(statisticName: string, callback?: Function): Promise<number | void>;

  /**
   * Gets the average value of a stateData property from all the items in the
   * queue. This means you can eg. get the average request time, download size
   * etc.
   * @param statisticName Can be any of the strings in {@link AllowedStatistics}
   * @param callback if defined - Gets two parameters, `error` and `avg`.
   * If the operation was successful, `error` will be `null`.
   * @return Promise<Number> calculated value if callback is undefined
   */
  avg(statisticName: string, callback?: Function): Promise<number | void>;

  /**
   * Counts the items in the queue that match a selector
   * @param comparator Object Comparator object used to filter items.
   * Queue items that are counted need to match all the properties of this object.
   * @param callback if defined - Gets two parameters, `error` and `items`.
   * If the operation was successful, `error` will be `null` and `items` will be an array of QueueItems.
   * @return Promise<Number> with value of calculated items. If callback is undefined
   */
  countItems(comparator: object, callback?: Function): Promise<number | void>;

  /**
   * Filters and returns the items in the queue that match a selector
   * @param comparator Object Comparator object used to filter items.
   * Queue items that are returned need to match all the properties of this object.
   * @param callback - if defined - Gets two parameters, `error` and `items`. If the operation was successful,
   * `error` will be `null` and `items` will be an array of QueueItems.
   * @return Promise<Number> with value of calculated items. If callback if undefined.
   */
  filterItems(comparator: object, callback?: Function): Promise<QueueItem[] | void>;

  /**
   * Gets the total number of queue items in the queue
   * @param callback if defined - Gets two parameters, `error` and `length`.
   * If the operation was successful, `error` will be `null`.
   * @return Promise<Number> total number of queued items. If callback is undefined
   */
  getLength(callback?: Function): Promise<number | void>;

  /**
   * @deprecated
   */
  freeze(filename: string, callback?: Function): Promise<boolean | void>;

  /**
   * @deprecated
   */
  defrost(filename: string, callback?: Function): Promise<boolean | void>;

  /*
   * custom methods
   */
  /**
   * Initialization function - open a connection
   *
   * @param config MongoDBQueueConfig
   * @param callback callback function
   * @returns Promise<void> if no callback is defined
   */
  init(config: MongoDbQueueConfig | any, callback?: Function): Promise<any | void>;

  /**
   * Finalize method - close a connection
   *
   * @param config MongoDBQueueConfig
   * @param callback callback function
   * @returns Promise<void> if no callback is defined
   */
  finalize(config: MongoDbQueueConfig | any, callback?: Function): Promise<any | void>;
}
