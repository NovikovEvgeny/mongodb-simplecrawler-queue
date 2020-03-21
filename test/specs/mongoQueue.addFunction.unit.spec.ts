/* eslint-disable import/order,import/first */
/* eslint-env jest */
import 'jest-extended';
import { mockMongoClient, mockProperty } from '../utils';

const mocks = mockMongoClient();
import { ObjectId } from 'mongodb';
import { MongoDbQueue, QueueError, QueueItemStatus } from '../../src';

describe('Mongo Queue unit tests', () => {
  // const testError = 'test error';
  let queue: MongoDbQueue;

  beforeEach(() => {
    queue = new MongoDbQueue({});
  });

  afterEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it('should add queueItem', async () => {
    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    const mockedDataBaseItem = { hello: 'world', _id: new ObjectId() };
    const findOneMock = jest.fn().mockResolvedValue(mockedDataBaseItem);

    const mockedQueueItem = { url: 'http://localhost:8080', id: 1 };
    const mockedResponse = { result: { ok: 1 }, upsertedId: { _id: mockedDataBaseItem._id }, upsertedCount: 1 };
    const updateOneMock = jest.fn().mockResolvedValue(mockedResponse);

    mockProperty(queue, 'collection', { updateOne: updateOneMock, findOne: findOneMock });

    // @ts-ignore
    await expect(queue.add(mockedQueueItem, false)).resolves.toEqual(mockedDataBaseItem);

    const expectedAddItem = {
      // can't use destruction here because "id" property is deleted - also test it here
      url: mockedQueueItem.url,
      modifiedBy: queue.config.crawlerName,
      modificationTimestamp: mockedTimestamp,
      status: QueueItemStatus.Queued,
    };
    expect(updateOneMock).toHaveBeenCalledWith(
      { url: mockedQueueItem.url },
      { $setOnInsert: expectedAddItem },
      { upsert: true },
    );

    expect(findOneMock).toHaveBeenCalledWith({ _id: mockedDataBaseItem._id });

    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should add queueItem and update private _id', async () => {
    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    const mockedDataBaseItem = { hello: 'world', _id: new ObjectId() };
    const findOneMock = jest.fn().mockResolvedValue(null);

    const mockedQueueItem = { url: 'http://localhost:8080', id: 1 };
    const mockedResponse = { result: { ok: 1 }, upsertedId: { _id: mockedDataBaseItem._id }, upsertedCount: 1 };
    const updateOneMock = jest.fn().mockResolvedValue(mockedResponse);

    mockProperty(queue, 'collection', { updateOne: updateOneMock, findOne: findOneMock });

    // @ts-ignore
    await expect(queue.add(mockedQueueItem, false))
      .rejects.toThrow('Resource already exists in queue');

    const expectedAddItem = {
      // can't use destruction here because "id" property is deleted - also test it here
      url: mockedQueueItem.url,
      modifiedBy: queue.config.crawlerName,
      modificationTimestamp: mockedTimestamp,
      status: QueueItemStatus.Queued,
    };
    expect(updateOneMock).toHaveBeenCalledWith(
      { url: mockedQueueItem.url },
      { $setOnInsert: expectedAddItem },
      { upsert: true },
    );

    expect(findOneMock).toHaveBeenCalledWith({ _id: mockedDataBaseItem._id });

    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should throw error on add if upsertedCount is 0 and force is false', async () => {
    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    const mockedDataBaseItem = { hello: 'world', _id: new ObjectId() };
    const findOneMock = jest.fn().mockResolvedValue(mockedDataBaseItem);

    const mockedQueueItem = { url: 'http://localhost:8080', id: 1 };
    const mockedResponse = { upsertedCount: 0 };
    const updateOneMock = jest.fn().mockResolvedValue(mockedResponse);

    mockProperty(queue, 'collection', { updateOne: updateOneMock, findOne: findOneMock });

    // @ts-ignore
    await expect(queue.add(mockedQueueItem, false))
      .rejects.toThrow(new QueueError('Resource already exists in queue!', 'DUPLICATE'));

    const expectedAddItem = {
      // can't use destruction here because "id" property is deleted - also test it here
      url: mockedQueueItem.url,
      modifiedBy: queue.config.crawlerName,
      modificationTimestamp: mockedTimestamp,
      status: QueueItemStatus.Queued,
    };
    expect(updateOneMock).toHaveBeenCalledWith(
      { url: mockedQueueItem.url },
      { $setOnInsert: expectedAddItem },
      { upsert: true },
    );

    expect(findOneMock).not.toHaveBeenCalled();

    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should throw an error on add if result in not OK', async () => {
    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    const mockedDataBaseItem = { hello: 'world', _id: new ObjectId() };
    const findOneMock = jest.fn().mockResolvedValue(mockedDataBaseItem);

    const mockedQueueItem = { url: 'http://localhost:8080', id: 1 };
    const mockedResponse = { result: { ok: 0 } };
    const updateOneMock = jest.fn().mockResolvedValue(mockedResponse);

    mockProperty(queue, 'collection', { updateOne: updateOneMock, findOne: findOneMock });

    // @ts-ignore
    await expect(queue.add(mockedQueueItem, false))
      .rejects.toThrow('Unexpected error happened');

    const expectedAddItem = {
      // can't use destruction here because "id" property is deleted - also test it here
      url: mockedQueueItem.url,
      modifiedBy: queue.config.crawlerName,
      modificationTimestamp: mockedTimestamp,
      status: QueueItemStatus.Queued,
    };
    expect(updateOneMock).toHaveBeenCalledWith(
      { url: mockedQueueItem.url },
      { $setOnInsert: expectedAddItem },
      { upsert: true },
    );

    expect(findOneMock).not.toHaveBeenCalled();

    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });


  it('should throw error when force is true and element exists', async () => {
    // @ts-ignore
    const addToQueueMock = jest.spyOn(queue, 'addToQueue').mockResolvedValue(null);

    const mockedQueueItem = { url: 'http://localhost:8080' };
    // @ts-ignore
    await expect(queue.add(mockedQueueItem, true))
      .rejects.toThrow('Can\'t add a queueItem instance twice. '
        + 'You may create a new one from the same URL however.');

    addToQueueMock.mockReset();
  });

  it('should throw error when force is true and element exists', async () => {
    const mockedResponse = { id: 1 };
    // @ts-ignore
    const addToQueueMock = jest.spyOn(queue, 'addToQueue').mockResolvedValue(mockedResponse);

    const mockedQueueItem = { url: 'http://localhost:8080' };
    // @ts-ignore
    await expect(queue.add(mockedQueueItem, true)).resolves.toEqual(mockedResponse)

    addToQueueMock.mockReset();
  });
});
