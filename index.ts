import { promises as fs } from 'node:fs'
import { join, basename, dirname } from 'node:path'

export type Async = [() => void, (error: Error) => void] | null
export type PromiseVoid = Promise<void> | null

export class Ark<T = object | Array<any>> {
  data: T | null = null
  #path: string
  #temp: string
  #prev: Async = null
  #next: Async = null
  #locked: boolean = false
  #promise: PromiseVoid = null
  #payload: string | null = null

  constructor (db: string) {
    this.#path = !db.includes('.json') ? `${db}.json` : db
    db = join(process.cwd(), this.#path)
    this.#temp = this.#tempPath(this.#path)
  }
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
  async save () {
    await this.#write(JSON.stringify(this.data))
  }
  #tempPath (file: string) {
    return join(dirname(file), '.' + basename(file) + '.tmp')
  }
  async #push (data: string) {
    this.#payload = data
    this.#promise ||= new Promise((ok, err) => {
      this.#next = [ok, err]
    })
    return new Promise((ok, err) => {
      this.#promise?.then(ok).catch(err)
    })
  }
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
  async #write (data: string) {
    this.#locked ? this.#push(data) : this.#set(data)
  }
}