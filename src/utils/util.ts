export class Utils {
  public static async wait(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), ms);
    });
  }

  /*
  Helper to convert from ms to other time units
   */

}

export enum TimeUnit {
  SECOND = 1000,
  MINUTE = 1000 * 60,
}
