export class MockSerializer {

  /**
   * Serialize
   *
   * @param data
   */
  serialize(data: any): string {
    return JSON.stringify(data)
  }

  /**
   * Unserialize
   *  if cannot unserialize return data untouched
   *
   * @param data
   */
  unSerialize(data: any): any {
    try {
      return JSON.parse(data)
    } catch (e) {
      return data;
    }
  }
}
