# Ark

Ark is a simple and fast JSON object storage system written in Typescript with a focus on simplicity and performance for persistence of information stored in the file system.

## Installation

```bash
# NPM
npm install @coatl/ark

# Yarn
yarn add @coatl/ark

# PNPM
pnpm add @coatl/ark
```

## Usage

```typescript
import { Ark } from '@coatl/ark'

interface User {
  name: string
  age: number
}

const db = new Ark('users')

await db.connect()

// Add a user
await db.data.push({
  id: '123',
  name: 'John Doe',
  age: 20
})

await db.save()

// Get all users
const users = await db.data

// Get a user by id
const user = await db.data.find((user: User) => user.id === '123')

// Update a user
await db.data.map((user: User) => {
  if (user.id === '123') {
    user.age = 21
  }
})

await db.save()

// Delete a user
await db.data.filter((user: User) => user.id !== '123')

await db.save()

// Delete all users

await db.data.splice(0, db.data.length)

await db.save()
```