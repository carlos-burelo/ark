import { promises as fs } from 'node:fs'
import { join, basename, dirname } from 'node:path'

/**
 * Type definition for an async callback that takes no arguments and returns no value.
 */
export type Async = [() => void, (error: Error) => void] | null

/**
 * Type definition for a Promise that resolves to void or null.
 */
export type PromiseVoid = Promise<void> | null

/**
 * A class representing a JSON database.
 * @template T The type of the data stored in the database.
 */
export class Ark<T = object | Array<any>> {
  /**
   * The data stored in the database.
   */
  data: T | null = null

  /**
   * The path to the database file.
   */
  #path: string

  /**
   * The path to the temporary file used for atomic writes.
   */
  #temp: string

  /**
   * The callback to be called when the previous write operation completes successfully.
   */
  #prev: Async = null

  /**
   * The callback to be called when the next write operation completes.
   */
  #next: Async = null

  /**
   * Whether a write operation is currently in progress.
   */
  #locked: boolean = false

  /**
   * The Promise that resolves when the current write operation completes.
   */
  #promise: PromiseVoid = null

  /**
   * The data to be written in the next write operation.
   */
  #payload: string | null = null

  /**
   * Creates a new Ark instance.
   * @param db The path to the database file.
   */
  constructor (db: string) {
    this.#path = !db.includes('.json') ? `${db}.json` : db
    db = join(process.cwd(), this.#path)
    this.#temp = this.#tempPath(this.#path)
  }

  /**
   * Connects to the database and loads its contents into memory.
   */
  async connect () {
    let raw: string | null = null
    try { raw = await fs.readFile(this.#path, 'utf-8') }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.writeFile(this.#path, '{}')
        raw = '{}'
      } else {
        throw new Error(`Could not read file: ${this.#path}`)
      }
    }
    if (raw === null) this.data = null
    else this.data = JSON.parse(raw)
  }

  /**
   * Saves the current state of the database to disk.
   */
  async save () {
    await this.#write(JSON.stringify(this.data))
  }

  /**
   * Returns the path to the temporary file used for atomic writes.
   * @param file The path to the database file.
   * @returns The path to the temporary file.
   */
  #tempPath (file: string) {
    return join(dirname(file), '.' + basename(file) + '.tmp')
  }

  /**
   * Adds a write operation to the queue.
   * @param data The data to be written.
   * @returns A Promise that resolves when the write operation completes.
   */
  async #push (data: string) {
    this.#payload = data
    this.#promise ||= new Promise((ok, err) => {
      this.#next = [ok, err]
    })
    return new Promise((ok, err) => {
      this.#promise?.then(ok).catch(err)
    })
  }

  /**
   * Performs a write operation.
   * @param data The data to be written.
   */
  async #set (data: string) {
    this.#locked = true
    try {
      await fs.writeFile(this.#temp, data, 'utf-8')
      await fs.rename(this.#temp, this.#path)
      this.#prev?.[0]()
    }
    catch (err) {
      this.#prev?.[1](err as Error)
      throw err
    }
    finally {
      this.#locked = false
      this.#prev = this.#next
      this.#next = this.#promise = null
      if (this.#payload !== null) {
        const payload = this.#payload
        this.#payload = null
        await this.#write(payload)
      }
    }
  }

  /**
   * Writes data to the database.
   * @param data The data to be written.
   */
  async #write (data: string) {
    this.#locked ? this.#push(data) : this.#set(data)
  }
}