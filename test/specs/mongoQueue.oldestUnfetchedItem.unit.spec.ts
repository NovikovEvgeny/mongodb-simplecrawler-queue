/* eslint-disable import/order,import/first */
/* eslint-env jest */
import 'jest-extended';
import { mockMongoClient, mockProperty } from '../utils';

const mocks = mockMongoClient();
import { ObjectId } from 'mongodb';
import { MongoDbQueue, QueueItemStatus } from '../../src';

describe('Mongo Queue oldestUnfetchedItem function unit tests', () => {
  const testError = 'test error';
  let queue: MongoDbQueue;

  beforeEach(() => {
    queue = new MongoDbQueue({});
  });

  afterEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it('should return oldestUnfetchedItem', async () => {
    const mockedQueueItem = { queue: 'item', _id: new ObjectId() };
    const mockedResponse = { ok: 1, value: mockedQueueItem };
    const findOneAndUpdateMock = jest.fn().mockResolvedValue(mockedResponse);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    await expect(queue.oldestUnfetchedItem()).resolves.toEqual({
      ...mockedQueueItem,
      id: mockedQueueItem._id,
    });

    const requestFilter = {
      $set: {
        status: QueueItemStatus.Pulled,
        modificationTimestamp: mockedTimestamp,
        modifiedBy: queue.config.crawlerName,
      },
    };
    expect(findOneAndUpdateMock).toHaveBeenCalledWith({ status: QueueItemStatus.Queued }, requestFilter);
    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should return oldestUnfetchedItem even without _id property', async () => {
    const mockedQueueItem = { queue: 'item' };
    const mockedResponse = { ok: 1, value: mockedQueueItem };
    const findOneAndUpdateMock = jest.fn().mockResolvedValue(mockedResponse);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    await expect(queue.oldestUnfetchedItem()).resolves.toEqual(mockedQueueItem);

    const requestFilter = {
      $set: {
        status: QueueItemStatus.Pulled,
        modificationTimestamp: mockedTimestamp,
        modifiedBy: queue.config.crawlerName,
      },
    };
    expect(findOneAndUpdateMock).toHaveBeenCalledWith({ status: QueueItemStatus.Queued }, requestFilter);
    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should return oldestUnfetchedItem even if it is undefined', async () => {
    const mockedResponse = { ok: 1, value: undefined };
    const findOneAndUpdateMock = jest.fn().mockResolvedValue(mockedResponse);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    await expect(queue.oldestUnfetchedItem()).resolves.toEqual(undefined);

    const requestFilter = {
      $set: {
        status: QueueItemStatus.Pulled,
        modificationTimestamp: mockedTimestamp,
        modifiedBy: queue.config.crawlerName,
      },
    };
    expect(findOneAndUpdateMock).toHaveBeenCalledWith({ status: QueueItemStatus.Queued }, requestFilter);
    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should throw error in oldestUnfetchedItem if result is not ok', async () => {
    const mockedResponse = { ok: 0 };
    const findOneAndUpdateMock = jest.fn().mockResolvedValue(mockedResponse);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    await expect(queue.oldestUnfetchedItem()).rejects.toThrow('Error occurred during getting an item');

    const requestFilter = {
      $set: {
        status: QueueItemStatus.Pulled,
        modificationTimestamp: mockedTimestamp,
        modifiedBy: queue.config.crawlerName,
      },
    };
    expect(findOneAndUpdateMock).toHaveBeenCalledWith({ status: QueueItemStatus.Queued }, requestFilter);
    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should rethrow error from oldestUnfetchedItem', async () => {
    const findOneAndUpdateMock = jest.fn().mockRejectedValue(testError);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    await expect(queue.oldestUnfetchedItem()).rejects.toThrow(testError);

    const requestFilter = {
      $set: {
        status: QueueItemStatus.Pulled,
        modificationTimestamp: mockedTimestamp,
        modifiedBy: queue.config.crawlerName,
      },
    };
    expect(findOneAndUpdateMock).toHaveBeenCalledWith({ status: QueueItemStatus.Queued }, requestFilter);
    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });
});
