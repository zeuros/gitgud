export class GitAuthor {
  static parse(nameAddr: string): GitAuthor | null {
    const m = nameAddr.match(/^(.*?)\s+<(.*?)>/)
    return m === null ? null : new GitAuthor(m[1], m[2])
  }

  constructor(
    public readonly name: string,
    public readonly email: string
  ) {
  }

  toString() {
    return `${this.name} <${this.email}>`
  }
}
