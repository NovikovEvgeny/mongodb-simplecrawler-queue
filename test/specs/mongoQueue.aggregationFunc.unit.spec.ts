/* eslint-disable import/order,import/first */
/* eslint-env jest */
import 'jest-extended';
import { mockMongoClient, mockProperty } from '../utils';

const mocks = mockMongoClient();
import { MongoDbQueue } from '../../src';

describe('Mongo Queue aggregation function unit tests', () => {
  const testError = 'test error';
  let queue: MongoDbQueue;

  beforeEach(() => {
    queue = new MongoDbQueue({});
  });

  afterEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  // max method
  it('should return max element', async () => {
    const nextMock = jest.fn().mockResolvedValue({ max: 15 });
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.max('actualDataSize')).resolves.toEqual(15);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          max: { $max: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should handle undefined on max element', async () => {
    const nextMock = jest.fn().mockResolvedValue(undefined);
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.max('actualDataSize')).resolves.toEqual(undefined);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          max: { $max: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });


  it('should rethrow error on max element', async () => {
    const nextMock = jest.fn().mockRejectedValue(testError);
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.max('actualDataSize')).rejects.toThrow(testError);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          max: { $max: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should throw "invalid statistic" error on max element', async () => {
    const aggregateMock = jest.fn();
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.max('invalid')).rejects.toThrow('Invalid statistic');
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  // min method
  it('should return min element', async () => {
    const nextMock = jest.fn().mockResolvedValue({ min: 15 });
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.min('actualDataSize')).resolves.toEqual(15);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          min: { $min: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should handle undefined on min element', async () => {
    const nextMock = jest.fn().mockResolvedValue(undefined);
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.min('actualDataSize')).resolves.toEqual(undefined);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          min: { $min: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should rethrow error on min element', async () => {
    const nextMock = jest.fn().mockRejectedValue(testError);
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.min('actualDataSize')).rejects.toThrow(testError);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          min: { $min: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should throw "invalid statistic" error on min element', async () => {
    const aggregateMock = jest.fn();
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.min('invalid')).rejects.toThrow('Invalid statistic');
    expect(aggregateMock).not.toHaveBeenCalled();
  });


  // avg method
  it('should return avg element', async () => {
    const nextMock = jest.fn().mockResolvedValue({ avg: 15 });
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.avg('actualDataSize')).resolves.toEqual(15);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          avg: { $avg: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should handle undefined on avg element', async () => {
    const nextMock = jest.fn().mockResolvedValue(undefined);
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.avg('actualDataSize')).resolves.toEqual(undefined);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          avg: { $avg: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });


  it('should rethrow error on avg element', async () => {
    const nextMock = jest.fn().mockRejectedValue(testError);
    const aggregateMock = jest.fn().mockReturnValue({ next: nextMock });
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.avg('actualDataSize')).rejects.toThrow(testError);

    const requestFilter = [
      { $match: { fetched: true, 'stateData.actualDataSize': { $type: ['number'] } } },
      {
        $group: {
          _id: 'stateData.actualDataSize',
          avg: { $avg: '$stateData.actualDataSize' },
        },
      },
    ];
    expect(aggregateMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should throw "invalid statistic" error on min element', async () => {
    const aggregateMock = jest.fn();
    mockProperty(queue, 'collection', { aggregate: aggregateMock });

    await expect(queue.avg('invalid')).rejects.toThrow('Invalid statistic');
    expect(aggregateMock).not.toHaveBeenCalled();
  });

});
